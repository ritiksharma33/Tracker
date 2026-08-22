/**
 * Direct HTTP client for the Snorkel DaaS API.
 *
 * Replaces the `stb` CLI shell invocation so the app runs on any platform
 * (Vercel, Netlify, etc.) without requiring a Python binary.
 *
 * Auth: every request sends the user's Snorkel API key in the `x-key` header.
 * Base URL: https://experts.snorkel-ai.com/api/v1 (production)
 *
 * Endpoints used:
 *   GET /users/me                        – resolves project name → UUID
 *   GET /assignments?project_id=&task=&assignee=&use_cursor=true&limit=100
 *                                        – paginated assignment list
 *
 * State remappings mirror what the stb CLI applies:
 *   READY_TO_PACKAGE / READY_TO_DELIVER / DELIVERED → ACCEPTED
 *   COMPLETED → REVIEW_PENDING
 *   WONT_PAY  → REJECTED
 */

const BASE_URL = "https://experts.snorkel-ai.com/api/v1";

// Mirrors ASSIGNMENT_REMAPPINGS in stb's constants.py
const ASSIGNMENT_REMAPPINGS: Record<string, string> = {
  READY_TO_PACKAGE: "ACCEPTED",
  READY_TO_DELIVER: "ACCEPTED",
  DELIVERED: "ACCEPTED",
  COMPLETED: "REVIEW_PENDING",
};

const PAYMENT_REMAPPINGS: Record<string, string> = {
  WONT_PAY: "REJECTED",
};

export type Submission = {
  index: string;
  submissionId: string;
  createdAt: string;
  folderName: string;
  assignmentState: string;
  paymentStatus: string;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function headers(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-key": apiKey,
    "User-Agent": "snorkel-tracker/1.0",
  };
}

async function daas<T>(
  path: string,
  apiKey: string,
  method = "GET"
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(apiKey),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = "";
    try {
      detail = JSON.parse(text)?.detail ?? text;
    } catch {
      detail = text;
    }
    throw new Error(
      `Snorkel API error ${res.status} on ${path}: ${detail || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── project resolution ───────────────────────────────────────────────────────

async function resolveProjectId(
  projectName: string,
  apiKey: string
): Promise<string> {
  const me = await daas<{ attribute_data?: { assigned_projects?: { project_id?: { id?: string }; name?: string }[] } }>("/users/me", apiKey);

  const projects: { id: string; name: string }[] = (
    me?.attribute_data?.assigned_projects ?? []
  ).map((p: { project_id?: { id?: string }; name?: string }) => ({
    id: p?.project_id?.id ?? "",
    name: p?.name ?? "",
  }));

  const match = projects.find(
    (p) => p.name.toLowerCase() === projectName.toLowerCase()
  );

  if (!match) {
    const available = projects.map((p) => p.name).join(", ");
    throw new Error(
      `Project "${projectName}" not found in your assigned projects. Available: ${available || "(none)"}`
    );
  }

  return match.id;
}

// ─── task-type resolution ─────────────────────────────────────────────────────

async function getSubmissionTaskType(
  projectId: string,
  apiKey: string
): Promise<string> {
  const project = await daas<{ task_infos?: { task_category?: string; task_type?: string }[] }>(
    `/projects/${projectId}`,
    apiKey
  );

  const info = (project?.task_infos ?? []).find(
    (t) => t.task_category === "SUBMISSION"
  );

  if (!info?.task_type) {
    throw new Error(
      `Project ${projectId} has no SUBMISSION task type configured.`
    );
  }

  return info.task_type;
}

// ─── paginated assignments ────────────────────────────────────────────────────

async function fetchAllAssignments(
  projectId: string,
  taskType: string,
  assigneeEmail: string,
  apiKey: string
): Promise<Record<string, unknown>[]> {
  const base = `/assignments?project_id=${projectId}&task=${encodeURIComponent(taskType)}&assignee=${encodeURIComponent(assigneeEmail)}`;

  const all: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  while (true) {
    let path = `${base}&use_cursor=true&limit=100`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;

    const page = await daas<{
      assignments?: Record<string, unknown>[];
      next_cursor?: string;
      has_more?: boolean;
    }>(path, apiKey);

    const assignments = page?.assignments ?? [];

    for (const a of assignments) {
      if (a.status === "REJECTED") continue;
      all.push(a);
    }

    cursor = page.next_cursor ?? null;
    if (!page.has_more || !cursor) break;
  }

  return all;
}

// ─── timestamp formatting ─────────────────────────────────────────────────────

function formatCompactTimestamp(iso: unknown): string {
  if (!iso || typeof iso !== "string") return "";
  try {
    const d = new Date(iso);
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${mo}/${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

function extractId(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v)
    return String((v as { id: unknown }).id);
  return "";
}

// ─── public API ──────────────────────────────────────────────────────────────

export type FetchResult =
  | { ok: true; submissions: Submission[] }
  | { ok: false; message: string; detail?: string };

export async function fetchSubmissions(
  projectName: string,
  apiKey: string
): Promise<FetchResult> {
  try {
    // 1. Who am I? (also validates the key)
    const me = await daas<{ email?: string; attribute_data?: { assigned_projects?: unknown[] } }>(
      "/users/me",
      apiKey
    );
    const email = me?.email ?? "";
    if (!email) throw new Error("Could not read user email from /users/me");

    // 2. Resolve project name → UUID
    const projectId = await resolveProjectId(projectName, apiKey);

    // 3. Get the submission task-type string for this project
    const taskType = await getSubmissionTaskType(projectId, apiKey);

    // 4. Fetch all paginated assignments
    const assignments = await fetchAllAssignments(
      projectId,
      taskType,
      email,
      apiKey
    );

    // 5. Shape into Submission objects
    const submissions: Submission[] = assignments.map((a, idx) => {
      const rawState = String(a.status ?? "");
      const rawPayment = String(a.payment_status ?? "");

      return {
        index: String(idx + 1),
        submissionId:
          extractId(a.submission_id) || extractId(a.task_id),
        createdAt: formatCompactTimestamp(a.created_at),
        folderName: "",
        assignmentState: ASSIGNMENT_REMAPPINGS[rawState] ?? rawState,
        paymentStatus: PAYMENT_REMAPPINGS[rawPayment] ?? rawPayment,
      };
    });

    return { ok: true, submissions };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return { ok: false, message: msg };
  }
}
