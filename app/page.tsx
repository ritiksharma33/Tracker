"use client";

import { useMemo, useState } from "react";
import { PROJECTS } from "@/lib/projects";
import StatusBadge from "./StatusBadge";

type Submission = {
  index: string;
  submissionId: string;
  createdAt: string;
  folderName: string;
  assignmentState: string;
  paymentStatus: string;
};

type FetchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "success";
      submissions: Submission[];
      command: string;
      projectLabel: string;
    };

const PAGE_SIZE = 20;

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Click to copy"
      style={{
        background: "none",
        border: "none",
        padding: "2px 6px",
        borderRadius: "4px",
        cursor: "pointer",
        fontFamily: "monospace",
        fontSize: "0.8em",
        color: copied ? "var(--status-accepted, #4ade80)" : "inherit",
        transition: "color 0.2s",
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {copied ? "Copied!" : id}
    </button>
  );
}

export default function Page() {
  const [projectId, setProjectId] = useState(PROJECTS[0]?.id ?? "");
  const [category, setCategory] = useState("SUBMISSION");
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<FetchState>({ phase: "idle" });
  const [currentPage, setCurrentPage] = useState(1);

  const selectedProject = useMemo(
    () => PROJECTS.find((p) => p.id === projectId),
    [projectId]
  );

  const cmdCategory = category.toLowerCase() + "s";
  const previewCommand = selectedProject
    ? `stb ${cmdCategory} list --project-name "${selectedProject.name}"`
    : `stb ${cmdCategory} list --project-name "…"`;

  async function handleFetch() {
    if (!projectId || !apiKey.trim()) {
      setState({ phase: "error", message: "Pick a project and enter your API key first." });
      return;
    }

    setState({ phase: "loading" });
    setCurrentPage(1);

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, apiKey: apiKey.trim(), category }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState({ phase: "error", message: data.error || "Something went wrong." });
        return;
      }

      setState({
        phase: "success",
        submissions: data.submissions,
        command: data.command,
        projectLabel: data.project.label,
      });
    } catch {
      setState({
        phase: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  const summary = useMemo(() => {
    if (state.phase !== "success") return null;
    const counts: Record<string, number> = {};
    for (const s of state.submissions) {
      const key = s.assignmentState || "UNKNOWN";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [state]);

  const totalPages =
    state.phase === "success"
      ? Math.ceil(state.submissions.length / PAGE_SIZE)
      : 1;

  const pagedSubmissions =
    state.phase === "success"
      ? state.submissions.slice(
          (currentPage - 1) * PAGE_SIZE,
          currentPage * PAGE_SIZE
        )
      : [];

  return (
    <main className="page">
      <p className="eyebrow">Snorkel · Terminal-Bench</p>
      <h1 className="title">
        {category === "SUBMISSION" ? "Submission" : category === "REVIEW" ? "Review" : "Adjudication"} <em>board</em>
      </h1>

      <section className="panel">
        <div className="controls">
          <div className="field">
            <label htmlFor="project">Project</label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {PROJECTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="SUBMISSION">Submissions</option>
              <option value="REVIEW">Reviews</option>
              <option value="ADJUDICATION">Adjudications</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="apiKey">Snorkel API key</label>
            <input
              id="apiKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
            />
          </div>

          <button
            className="fetch-btn"
            onClick={handleFetch}
            disabled={state.phase === "loading"}
          >
            {state.phase === "loading" ? "Fetching…" : "Fetch status"}
          </button>
        </div>

        <div className="command-bar">
          <span className="prompt">$</span>
          <span className="cmd">{previewCommand}</span>
        </div>

        {state.phase === "error" && <p className="status-line error">{state.message}</p>}
      </section>

      {state.phase === "success" && (
        <>
          <div className="summary">
            {Object.entries(summary || {}).map(([key, count]) => (
              <span className="chip" key={key}>
                <StatusBadge value={key} />
                <span className="n">{count}</span>
              </span>
            ))}
          </div>

          <div className="board-wrap">
            {state.submissions.length === 0 ? (
              <div className="empty-state">
                <p className="big">Nothing here yet</p>
                <p>No {category.toLowerCase()}s found for {state.projectLabel}.</p>
              </div>
            ) : (
              <>
                <table className="board">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Task ID</th>
                      <th>Folder</th>
                      <th>Created</th>
                      <th>Assignment</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubmissions.map((s) => (
                      <tr key={s.submissionId}>
                        <td className="idx">{s.index}</td>
                        <td className="task-id">
                          <CopyableId id={s.submissionId} />
                        </td>
                        <td className={`folder ${s.folderName ? "" : "empty"}`}>
                          {s.folderName || "—"}
                        </td>
                        <td className="created">{s.createdAt}</td>
                        <td>
                          <StatusBadge value={s.assignmentState} />
                        </td>
                        <td>
                          <StatusBadge value={s.paymentStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="page-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((c) => c - 1)}
                    >
                      ← Previous
                    </button>
                    <span className="page-info">
                      Page {currentPage} of {totalPages} &nbsp;·&nbsp; {state.submissions.length} {category.toLowerCase()}s
                    </span>
                    <button
                      className="page-btn"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((c) => c + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
