export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge tone-${toneFor(value)}`}>{value}</span>;
}

function toneFor(value: string) {
  if (
    ["done", "accepted", "approved", "resolved", "published", "online", "succeeded"].includes(
      value,
    )
  ) {
    return "success";
  }
  if (
    ["failed", "rejected", "dismissed", "timed_out", "offline", "abandoned", "critical"].includes(
      value,
    )
  ) {
    return "danger";
  }
  if (["reviewing", "review_pending", "degraded", "major"].includes(value)) {
    return "warning";
  }
  if (["executing", "running", "active", "leased", "pending"].includes(value)) {
    return "info";
  }
  return "neutral";
}
