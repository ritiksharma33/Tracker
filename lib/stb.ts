import { spawn } from "child_process";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

const STB_BINARY = process.env.STB_BINARY || "stb";
const COMMAND_TIMEOUT_MS = 60_000;

type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
};

function runOnce(
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(STB_BINARY, args, { env, cwd });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, code });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: String(err), code: null });
    });
  });
}

/**
 * Authenticates and lists submissions for one project, using a per-request
 * temp directory as $HOME so `stb`'s local config/session file never
 * leaks between concurrent users of this dashboard.
 *
 * ⚠️ UNVERIFIED ASSUMPTION — read before deploying for a team:
 * This calls `stb login --token <credential>`, assuming a non-interactive
 * login flag exists. That flag name is a guess; it was not documented
 * anywhere accessible to generate this code from. Before you rely on this,
 * run `stb login --help` and `stb keys --help` yourself and confirm the
 * real way to authenticate non-interactively (it may be a different flag,
 * or an environment variable your CLI reads, e.g. something set via
 * `stb keys`). If it's an env var instead of a flag, delete the
 * `login` step below and instead add it to the `env` object passed to
 * `runOnce` for the submissions call.
 */
export async function fetchSubmissions(projectName: string, credential: string) {
  const isolatedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    SNORKEL_API_KEY: credential, // Passing auth non-interactively!
  };

  const list = await runOnce(
    ["submissions", "list", "--project-name", projectName],
    isolatedEnv,
    process.cwd()
  );

  if (!list.ok) {
    return {
      ok: false as const,
      stage: "list" as const,
      message: "Fetching submissions failed. The API key might be invalid or you might not have access to this project.",
      detail: list.stderr || list.stdout,
    };
  }

  return { ok: true as const, stdout: list.stdout };
}
