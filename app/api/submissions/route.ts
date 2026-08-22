import { NextRequest, NextResponse } from "next/server";
import { fetchSubmissions } from "@/lib/stb";
import { PROJECTS } from "@/lib/projects";

// Runs on the Node runtime (fetch is available in both Node and Edge,
// but keeping Node for consistency with the rest of the app).
export const runtime = "nodejs";

// Tell Vercel to allow up to 30 seconds for this function.
// Stays well within the Hobby tier's 10 s default? No – but the new
// implementation calls the Snorkel REST API directly (no CLI), so it
// should complete in 1–3 seconds, comfortably within any tier.
export const maxDuration = 30;

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
      { error: result.message },
      { status: 502 }
    );
  }

  return NextResponse.json({
    project: { id: project.id, name: project.name, label: project.label },
    command: `stb submissions list --project-name "${project.name}"`,
    submissions: result.submissions,
    total: result.submissions.length,
  });
}
