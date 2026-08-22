import { NextRequest, NextResponse } from "next/server";
import { fetchSubmissions } from "@/lib/stb";
import { parseSubmissions } from "@/lib/parseSubmissions";
import { PROJECTS } from "@/lib/projects";

// This route shells out to a CLI binary, so it must run on the Node
// runtime (not the Edge runtime, which has no child_process/filesystem).
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { projectId?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const { projectId, apiKey } = body;

  if (!projectId || !apiKey) {
    return NextResponse.json(
      { error: "Pick a project and enter your API key first." },
      { status: 400 }
    );
  }

  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Unknown project." }, { status: 400 });
  }

  const result = await fetchSubmissions(project.name, apiKey);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, detail: result.detail },
      { status: 502 }
    );
  }

  const parsed = parseSubmissions(result.stdout);

  return NextResponse.json({
    project: { id: project.id, name: project.name, label: project.label },
    command: `stb submissions list --project-name "${project.name}"`,
    submissions: parsed.submissions,
    total: parsed.submissions.length,
  });
}
