"use client";

const STATE_STYLES: Record<string, { fg: string; bg: string }> = {
  ACCEPTED: { fg: "var(--status-accepted)", bg: "var(--status-accepted-bg)" },
  NEEDS_REVISION: { fg: "var(--status-revision)", bg: "var(--status-revision-bg)" },
  REVIEW_PENDING: { fg: "var(--status-review)", bg: "var(--status-review-bg)" },
  EVALUATION_PENDING: { fg: "var(--status-eval)", bg: "var(--status-eval-bg)" },
  PAYOUT_SUBMITTED: { fg: "var(--status-payout)", bg: "var(--status-payout-bg)" },
  PENDING: { fg: "var(--status-pending)", bg: "var(--status-pending-bg)" },
};

function humanize(label: string) {
  return label
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default function StatusBadge({ value }: { value: string }) {
  const key = value?.trim().toUpperCase() || "PENDING";
  const style = STATE_STYLES[key] || STATE_STYLES.PENDING;

  return (
    <span className="badge" style={{ color: style.fg, background: style.bg }}>
      {humanize(key)}
    </span>
  );
}
