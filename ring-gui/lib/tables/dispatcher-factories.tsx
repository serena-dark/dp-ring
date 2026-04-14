import { AppLink } from "@ring-gui/lib/router";
import {
  createDateTimeColumn,
  createRenderColumn,
  createStackColumn,
  createStatusBadgeColumn,
  createTextColumn,
} from "@ring-gui/lib/tables/column-factories";
import { createTableFactory } from "@ring-gui/lib/tables/core";
import {
  getCurrentDocument,
  getCurrentStageLabel,
  isAwaitingAgent,
  isRetryable,
} from "@ring-gui/lib/orchestrator";
import { titleize } from "@ring-gui/lib/format";
import type {
  DispatchBundleRecord,
  DispatchProtocolDescriptor,
  OrchestratorJob,
} from "@ring-gui/types/api";

function formatJobOutput(job: OrchestratorJob): string {
  if (job.status === "session_dispatched") {
    return `${job.session_dispatch.session_id ?? "--"} / ${job.session_dispatch.workflow_run_ids.length} runs`;
  }

  if (job.status === "waiting_for_session_dispatch") {
    return `${job.session_dispatch.waiting_task_ids.length} waiting / next tick launches batch`;
  }

  if (job.status === "workflow_rework_required") {
    return job.workflow_preparation.parse_error ?? "Workflow plan needs rework";
  }

  if (job.status.startsWith("workflow_")) {
    return `${job.workflow_preparation.waiting_tasks.length} ready tasks / ${job.workflow_preparation.generated_workflow_ids.length} custom workflows`;
  }

  if (job.status === "post_milestone_rework_required") {
    return [
      job.post_milestone.prerequisite_analysis.parse_error,
      job.post_milestone.task_dispatch.parse_error,
    ]
      .filter(Boolean)
      .join(" / ") || "Readiness routing needs rework";
  }

  if (job.status === "milestone_rework_required") {
    return job.milestone_plan.parse_error ?? "Plan needs rework";
  }

  if (
    job.status.startsWith("post_milestone_") ||
    job.status === "milestones_ready"
  ) {
    return `${job.post_milestone.prerequisite_analysis.distillation.feedback_ids.length} feedback / ${job.post_milestone.task_dispatch.generated_task_ids.length} tasks`;
  }

  return job.requirement_document.audit.verdict
    ? titleize(job.requirement_document.audit.verdict)
    : "--";
}

export function createDispatcherProtocolsTableFactory() {
  return createTableFactory<DispatchProtocolDescriptor>({
    getRowKey: (protocol) => protocol.id,
    columns: [
      createTextColumn({
        key: "protocol",
        header: "Protocol",
        value: (protocol) => protocol.id,
      }),
      createStatusBadgeColumn({
        key: "support",
        header: "Support",
        value: (protocol) => protocol.support_level,
      }),
      createTextColumn({
        key: "required-fields",
        header: "Required fields",
        value: (protocol) => protocol.required_fields.join(", "),
      }),
      createTextColumn({
        key: "transport",
        header: "Transport",
        value: (protocol) => protocol.transport_support.join(", "),
      }),
    ],
  });
}

export function createDispatcherJobsTableFactory({
  selectedJobId,
  onSelectJob,
  jobAction,
  onMarkAgentComplete,
  onRetryJob,
}: {
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  jobAction: string | null;
  onMarkAgentComplete: (jobId: string) => void;
  onRetryJob: (jobId: string) => void;
}) {
  return createTableFactory<OrchestratorJob>({
    getRowKey: (job) => job.id,
    getRowClassName: (job) =>
      selectedJobId === job.id ? "is-selected" : undefined,
    onRowClick: (job) => onSelectJob(job.id),
    columns: [
      createTextColumn({
        key: "job",
        header: "Job",
        value: (job) => job.id,
      }),
      createStackColumn({
        key: "requirement",
        header: "Requirement",
        primary: (job) => (
          <AppLink
            to={`/requirements/${job.requirement_id}`}
            className="record-link"
          >
            {job.requirement_name}
          </AppLink>
        ),
        secondary: (job) => job.requirement_id,
      }),
      createTextColumn({
        key: "stage",
        header: "Stage",
        value: (job) => getCurrentStageLabel(job),
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (job) => job.status,
      }),
      createTextColumn({
        key: "document",
        header: "Document",
        value: (job) => <code>{getCurrentDocument(job).path}</code>,
      }),
      createDateTimeColumn({
        key: "last-activity",
        header: "Last activity",
        value: (job) => getCurrentDocument(job).last_activity_at,
      }),
      createTextColumn({
        key: "completion-signal",
        header: "Completion signal",
        value: (job) => {
          const completionReason = getCurrentDocument(job).completion_reason;
          return completionReason ? titleize(completionReason) : "--";
        },
      }),
      createTextColumn({
        key: "output",
        header: "Output",
        value: (job) => formatJobOutput(job),
      }),
      createRenderColumn({
        key: "actions",
        header: "Actions",
        render: (job) => {
          const interventionCount = job.interventions.filter(
            (intervention) => intervention.status === "open",
          ).length;

          return (
            <div className="button-row">
              {interventionCount > 0 ? (
                <span className="subtle">
                  {interventionCount} intervention
                  {interventionCount === 1 ? "" : "s"}
                </span>
              ) : null}
              {isAwaitingAgent(job) ? (
                <button
                  type="button"
                  className="button button-ghost button-small"
                  disabled={jobAction === `complete:${job.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectJob(job.id);
                    onMarkAgentComplete(job.id);
                  }}
                >
                  {jobAction === `complete:${job.id}`
                    ? "Reporting..."
                    : "Agent Complete"}
                </button>
              ) : null}
              {isRetryable(job) ? (
                <button
                  type="button"
                  className="button button-ghost button-small"
                  disabled={jobAction === `retry:${job.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectJob(job.id);
                    onRetryJob(job.id);
                  }}
                >
                  {jobAction === `retry:${job.id}`
                    ? "Retrying..."
                    : "Redispatch"}
                </button>
              ) : null}
            </div>
          );
        },
      }),
    ],
  });
}

export function createDispatcherBundlesTableFactory() {
  return createTableFactory<DispatchBundleRecord>({
    getRowKey: (bundle) => bundle.id,
    columns: [
      createTextColumn({
        key: "bundle",
        header: "Bundle",
        value: (bundle) => bundle.id,
      }),
      createTextColumn({
        key: "protocol",
        header: "Protocol",
        value: (bundle) => `${bundle.bundle_protocol}@${bundle.bundle_version}`,
      }),
      createStatusBadgeColumn({
        key: "status",
        header: "Status",
        value: (bundle) => bundle.status,
      }),
      createTextColumn({
        key: "goal",
        header: "Goal",
        value: (bundle) => bundle.canonical?.goal.title ?? "--",
      }),
      createTextColumn({
        key: "tasks",
        header: "Tasks",
        value: (bundle) => bundle.planning.planned_task_ids.length,
      }),
      createTextColumn({
        key: "session",
        header: "Session",
        value: (bundle) => bundle.batching.session_id ?? "--",
      }),
    ],
  });
}
