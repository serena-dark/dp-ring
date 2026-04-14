import { DetailGrid } from "@ring-gui/components/DetailGrid";
import { formatDateTime, titleize } from "@ring-gui/lib/format";
import {
  getCurrentDocument,
  getCurrentStageLabel,
} from "@ring-gui/lib/orchestrator";
import type { OrchestratorJob } from "@ring-gui/types/api";

function formatCountdown(timestamp: string | null, now: number): string {
  if (!timestamp) {
    return "--";
  }

  const target = new Date(timestamp).getTime();
  if (Number.isNaN(target)) {
    return "--";
  }

  const deltaSeconds = Math.round((target - now) / 1000);
  if (Math.abs(deltaSeconds) <= 1) {
    return "now";
  }

  if (deltaSeconds > 0) {
    return `in ${deltaSeconds}s`;
  }

  return `${Math.abs(deltaSeconds)}s late`;
}

export function OrchestratorMachineSummary({
  job,
  now,
}: {
  job: OrchestratorJob;
  now: number;
}) {
  const currentDocument = getCurrentDocument(job);
  const nextTransitions = (job.state_machine[job.status] ?? []).map(titleize);

  return (
    <DetailGrid
      className="machine-summary-grid"
      items={[
        {
          key: "current-stage",
          label: "Current stage",
          value: getCurrentStageLabel(job),
        },
        {
          key: "next-scheduler-poll",
          label: "Next scheduler poll",
          value: (
            <>
              {formatDateTime(job.runtime.next_poll_at)}
              <span className="machine-inline-note">
                {formatCountdown(job.runtime.next_poll_at, now)}
              </span>
            </>
          ),
        },
        {
          key: "active-document",
          label: "Active document",
          value: <code>{currentDocument.path}</code>,
        },
        {
          key: "last-document-activity",
          label: "Last document activity",
          value: formatDateTime(currentDocument.last_activity_at),
        },
        {
          key: "completion-signal",
          label: "Completion signal",
          value: currentDocument.completion_reason
            ? titleize(currentDocument.completion_reason)
            : "--",
        },
        {
          key: "allowed-next",
          label: "Allowed next",
          value: nextTransitions.length > 0 ? nextTransitions.join(", ") : "--",
        },
      ]}
    />
  );
}
