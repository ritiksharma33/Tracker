export type Submission = {
  index: string;
  submissionId: string;
  createdAt: string;
  folderName: string;
  assignmentState: string;
  paymentStatus: string;
};

export type ParsedSubmissions = {
  projectLine: string | null;
  submissions: Submission[];
  raw: string;
};

/**
 * `stb submissions list` prints a box-drawing table, e.g.:
 *
 * ┌─────┬──────────────┬ ... ┐
 * │  #  │ Submission ID│ ... │
 * ├─────┼──────────────┼ ... ┤
 * │  1  │ 053e3f1a-... │ ... │
 * └─────┴──────────────┴ ... ┘
 *
 * This walks the raw stdout line by line and pulls out data rows,
 * ignoring border/rule lines. It's intentionally tolerant of column
 * width changes, since `stb` right-pads columns to fit content.
 */
export function parseSubmissions(stdout: string): ParsedSubmissions {
  const lines = stdout.split("\n");

  const projectLineMatch = stdout.match(/^Project:.*$/m);
  const projectLine = projectLineMatch ? projectLineMatch[0].trim() : null;

  const dataRows: string[][] = [];
  let headerSeen = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("│")) continue;

    const cells = line
      .split("│")
      .map((c) => c.trim())
      .filter((_, i, arr) => !(i === 0 || i === arr.length - 1)); // drop empty edge cells from split

    if (cells.length === 0) continue;

    // First real row of cells is the header ("#", "Submission ID", ...)
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }

    dataRows.push(cells);
  }

  const submissions: Submission[] = dataRows
    .filter((cells) => cells.length >= 6 && cells[0] !== "")
    .map((cells) => ({
      index: cells[0],
      submissionId: cells[1],
      createdAt: cells[2],
      folderName: cells[3],
      assignmentState: cells[4],
      paymentStatus: cells[5],
    }));

  return { projectLine, submissions, raw: stdout };
}
