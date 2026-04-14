export function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <strong className="metric-value">{value}</strong>
      {note ? <p className="metric-note">{note}</p> : null}
    </article>
  );
}
