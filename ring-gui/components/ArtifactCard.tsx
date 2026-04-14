import type { ReactNode } from "react";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatPercent } from "@ring-gui/lib/format";

function confidencePriority(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "medium";
  }

  return "low";
}

export function ArtifactCard({
  kind,
  confidence,
  summary,
  context,
  applicableWhen,
  applicableWhenTone = "default",
  footer,
}: {
  kind: string;
  confidence: number;
  summary: ReactNode;
  context?: ReactNode;
  applicableWhen?: ReactNode;
  applicableWhenTone?: "default" | "subtle";
  footer?: ReactNode;
}) {
  return (
    <div className="panel">
      <div className="badge-list">
        <StatusBadge value={kind} />
        <StatusBadge value={confidencePriority(confidence)} kind="priority" />
      </div>
      <h3>{summary}</h3>
      {context ? <p className="subtle">{context}</p> : null}
      {applicableWhen ? (
        <p className={applicableWhenTone === "subtle" ? "subtle" : undefined}>
          {applicableWhen}
        </p>
      ) : null}
      {footer ? <p>{footer}</p> : null}
    </div>
  );
}

export function ArtifactConfidenceLine({ confidence }: { confidence: number }) {
  return <>Confidence {formatPercent(confidence)}</>;
}
