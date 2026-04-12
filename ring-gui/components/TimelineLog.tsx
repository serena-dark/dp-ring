import type { SessionLogEntry } from "@ring-gui/types/api";
import { formatDateTime, titleize } from "@ring-gui/lib/format";

export function TimelineLog({
  entries,
}: {
  entries: SessionLogEntry[];
}) {
  if (entries.length === 0) {
    return <p className="subtle">No log.</p>;
  }

  const sortedEntries = [...entries].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );

  return (
    <ol className="timeline">
      {sortedEntries.map((entry, index) => (
        <li key={`${entry.timestamp}-${entry.event}-${index}`} className="timeline-item">
          <div className="timeline-dot" />
          <div className="timeline-card">
            <div className="timeline-head">
              <strong>{titleize(entry.event)}</strong>
              <span>{formatDateTime(entry.timestamp)}</span>
            </div>
            <p className="subtle">
              {entry.from && entry.to
                ? `${titleize(entry.from)} -> ${titleize(entry.to)}`
                : "No transition"}
              {entry.actor ? ` by ${entry.actor}` : ""}
            </p>
            {entry.detail ? <p>{entry.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
