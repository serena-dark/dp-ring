import { titleize } from "@ring-gui/lib/format";
import {
  toneForPriority,
  toneForSeverity,
  toneForStatus,
} from "@ring-gui/lib/state";

function BadgeIcon({
  tone,
}: {
  tone: "neutral" | "info" | "success" | "warning" | "danger" | "muted";
}) {
  switch (tone) {
    case "success":
      return (
        <svg
          className="badge-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6.4 11.2 3.6 8.4l-1.1 1.1 3.9 3.9 7.1-7.1-1.1-1.1z"
            fill="currentColor"
          />
        </svg>
      );
    case "warning":
      return (
        <svg
          className="badge-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 1.8 14.5 13H1.5L8 1.8zm0 3.1a.8.8 0 0 0-.8.8v3.3a.8.8 0 1 0 1.6 0V5.7A.8.8 0 0 0 8 4.9zm0 6a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9z"
            fill="currentColor"
          />
        </svg>
      );
    case "danger":
      return (
        <svg
          className="badge-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="m4.5 4.5 7 7m0-7-7 7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "info":
      return (
        <svg
          className="badge-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8zm0 3a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9zm1 6.1H7.4V7.1H9v3.8z"
            fill="currentColor"
          />
        </svg>
      );
    case "muted":
    case "neutral":
    default:
      return (
        <svg
          className="badge-icon"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 8h8"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}

export function StatusBadge({
  value,
  kind = "status",
}: {
  value: string | null | undefined;
  kind?: "status" | "severity" | "priority";
}) {
  const normalizedValue = value ?? "n/a";
  const label = titleize(normalizedValue);

  const tone =
    kind === "severity"
      ? toneForSeverity(normalizedValue)
      : kind === "priority"
        ? toneForPriority(normalizedValue)
        : toneForStatus(normalizedValue);

  return (
    <span
      className={`badge badge-${tone} badge-icon-only`}
      aria-label={label}
      title={label}
    >
      <BadgeIcon tone={tone} />
    </span>
  );
}
