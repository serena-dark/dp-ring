import type { ReactNode } from "react";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatDateTime, formatPercent, titleize } from "@ring-gui/lib/format";
import { getCurrentDispatch } from "@ring-gui/lib/orchestrator";
import { AppLink } from "@ring-gui/lib/router";
import type { OrchestratorJob } from "@ring-gui/types/api";

function MachineSidecarBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="machine-sidecar-block">
      <p className="eyebrow">{title}</p>
      {children}
    </div>
  );
}

export function OrchestratorMachineSidebar({
  job,
  onResolveIntervention,
  resolvingInterventionId = null,
  onDispatchFollowup,
  onCreateFollowupRequirement,
  followupAction = null,
}: {
  job: OrchestratorJob;
  onResolveIntervention?: (jobId: string, interventionId: string) => void;
  resolvingInterventionId?: string | null;
  onDispatchFollowup?: (jobId: string) => void;
  onCreateFollowupRequirement?: (jobId: string) => void;
  followupAction?: string | null;
}) {
  const currentDispatch = getCurrentDispatch(job);
  const historyEntries = [...job.history].reverse().slice(0, 8);
  const recentSpans = [...job.trace.spans].reverse().slice(0, 8);
  const openInterventions = job.interventions.filter(
    (intervention) => intervention.status === "open",
  );
  const requirementAuditScore =
    job.requirement_document.audit.score == null
      ? "--"
      : formatPercent(job.requirement_document.audit.score);

  return (
    <div className="machine-sidecar">
      <MachineSidecarBlock title="Current packet">
        <p className="machine-sidecar-title">
          {currentDispatch.packet?.subject ?? "Waiting for packet"}
        </p>
        <p className="subtle">
          Last dispatched {formatDateTime(currentDispatch.last_dispatched_at)}
        </p>
        {currentDispatch.packet ? (
          <p className="subtle">
            {currentDispatch.packet.protocol_version} · trace{" "}
            {currentDispatch.packet.trace_id}
          </p>
        ) : null}
        {currentDispatch.packet?.recipient_card ? (
          <p className="subtle">
            Recipient {currentDispatch.packet.recipient_card.display_name} ·{" "}
            {currentDispatch.packet.recipient_card.role}
          </p>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Routing policy">
        <div className="badge-list">
          <StatusBadge value={job.routing.mode} />
          <StatusBadge value={job.routing.post_milestone_strategy} />
          <StatusBadge value={job.routing.workflow_strategy} />
        </div>
        <p className="subtle">
          Complexity {job.routing.complexity_score} · Human review{" "}
          {titleize(job.routing.human_review_level)}
        </p>
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Requirement review">
        <div className="badge-list">
          <StatusBadge value={job.requirement_document.audit.status} />
          {job.requirement_document.audit.verdict ? (
            <StatusBadge value={job.requirement_document.audit.verdict} />
          ) : null}
        </div>
        <p className="subtle">
          Score {requirementAuditScore}.{" "}
          {job.requirement_document.audit.findings.length > 0
            ? `${job.requirement_document.audit.findings.filter((finding) => finding.passed).length}/${job.requirement_document.audit.findings.length} checks passed`
            : "No findings."}
        </p>
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Milestone output">
        <div className="badge-list">
          <StatusBadge value={job.milestone_plan.status} />
        </div>
        <p className="subtle">
          {job.milestone_plan.generated_milestone_ids.length > 0
            ? `${job.milestone_plan.generated_milestone_ids.length} milestones created`
            : "No milestones."}
        </p>
        {job.milestone_plan.parse_error ? (
          <p className="machine-history-note">{job.milestone_plan.parse_error}</p>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Prerequisite analysis">
        <div className="badge-list">
          <StatusBadge value={job.post_milestone.prerequisite_analysis.status} />
        </div>
        <p className="subtle">
          Ready groups {job.post_milestone.prerequisite_analysis.ready_groups.length}.{" "}
          Blocked groups {job.post_milestone.prerequisite_analysis.blocked_groups.length}.{" "}
          Feedback {job.post_milestone.prerequisite_analysis.distillation.feedback_ids.length}.
        </p>
        <p className="subtle">
          <code>{job.post_milestone.prerequisite_analysis.document.path}</code>
        </p>
        {job.post_milestone.prerequisite_analysis.parse_error ? (
          <p className="machine-history-note">
            {job.post_milestone.prerequisite_analysis.parse_error}
          </p>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Task dispatch">
        <div className="badge-list">
          <StatusBadge value={job.post_milestone.task_dispatch.status} />
        </div>
        <p className="subtle">
          Tasks {job.post_milestone.task_dispatch.generated_task_ids.length}.{" "}
          Documents {job.post_milestone.task_dispatch.task_document_paths.length}.
        </p>
        <p className="subtle">
          <code>{job.post_milestone.task_dispatch.document.path}</code>
        </p>
        {job.post_milestone.task_dispatch.parse_error ? (
          <p className="machine-history-note">
            {job.post_milestone.task_dispatch.parse_error}
          </p>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Workflow preparation">
        <div className="badge-list">
          <StatusBadge value={job.workflow_preparation.status} />
        </div>
        <p className="subtle">
          Waiting tasks {job.workflow_preparation.waiting_tasks.length}. Reused{" "}
          {job.workflow_preparation.reused_workflow_ids.length}. Custom{" "}
          {job.workflow_preparation.generated_workflow_ids.length}.
        </p>
        <p className="subtle">
          <code>{job.workflow_preparation.document.path}</code>
        </p>
        {job.workflow_preparation.parse_error ? (
          <p className="machine-history-note">
            {job.workflow_preparation.parse_error}
          </p>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Waiting area / session">
        <div className="badge-list">
          <StatusBadge value={job.session_dispatch.status} />
          {job.session_dispatch.session_id ? (
            <StatusBadge value="session_live" />
          ) : null}
        </div>
        <p className="subtle">
          Waiting {job.session_dispatch.waiting_task_ids.length}. Runs{" "}
          {job.session_dispatch.workflow_run_ids.length}.
        </p>
        <p className="subtle">Session {job.session_dispatch.session_id ?? "--"}</p>
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Open interventions">
        {openInterventions.length > 0 ? (
          <ol className="machine-history">
            {openInterventions.map((intervention) => (
              <li key={intervention.id}>
                <div className="machine-history-head">
                  <strong>{titleize(intervention.stage)}</strong>
                  <span>{formatDateTime(intervention.created_at)}</span>
                </div>
                <p className="subtle">
                  {titleize(intervention.severity)} · {intervention.source}
                </p>
                <p className="machine-history-note">{intervention.reason}</p>
                <p className="subtle">{intervention.recommendation}</p>
                {onResolveIntervention ? (
                  <div className="button-row">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      disabled={resolvingInterventionId === intervention.id}
                      onClick={() => {
                        onResolveIntervention(job.id, intervention.id);
                      }}
                    >
                      {resolvingInterventionId === intervention.id
                        ? "Resolving..."
                        : "Resolve"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="subtle">No interventions.</p>
        )}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Follow-up loop">
        <div className="badge-list">
          <StatusBadge value={job.followup.status} />
        </div>
        <p className="subtle">
          Source interventions {job.followup.source_intervention_ids.length}
        </p>
        <p className="subtle">
          <code>{job.followup.document.path}</code>
        </p>
        {job.followup.generated_requirement_id ? (
          <p className="subtle">
            Requirement{" "}
            <AppLink
              to={`/requirements/${job.followup.generated_requirement_id}`}
              className="record-link"
            >
              {job.followup.generated_requirement_id}
            </AppLink>
          </p>
        ) : null}
        {job.followup.generated_job_id ? (
          <p className="subtle">Job {job.followup.generated_job_id}</p>
        ) : null}
        {job.followup.parse_error ? (
          <p className="machine-history-note">{job.followup.parse_error}</p>
        ) : null}
        {onDispatchFollowup || onCreateFollowupRequirement ? (
          <div className="button-row">
            {onDispatchFollowup ? (
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={followupAction === "dispatch"}
                onClick={() => {
                  onDispatchFollowup(job.id);
                }}
              >
                {followupAction === "dispatch"
                  ? "Drafting..."
                  : "Draft Follow-up"}
              </button>
            ) : null}
            {onCreateFollowupRequirement ? (
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={
                  followupAction === "create" ||
                  ["pending", "completed"].includes(job.followup.status)
                }
                onClick={() => {
                  onCreateFollowupRequirement(job.id);
                }}
              >
                {followupAction === "create"
                  ? "Creating..."
                  : "Create Follow-up Requirement"}
              </button>
            ) : null}
          </div>
        ) : null}
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Recent trace spans">
        <ol className="machine-history">
          {recentSpans.map((span) => (
            <li key={span.id}>
              <div className="machine-history-head">
                <strong>{titleize(span.stage)}</strong>
                <span>{formatDateTime(span.started_at)}</span>
              </div>
              <p className="subtle">
                {titleize(span.kind)} · {span.agent_id} · {titleize(span.status)}
              </p>
              {span.note ? <p className="machine-history-note">{span.note}</p> : null}
            </li>
          ))}
        </ol>
      </MachineSidecarBlock>

      <MachineSidecarBlock title="Recent history">
        <ol className="machine-history">
          {historyEntries.map((entry) => (
            <li key={`${entry.timestamp}:${entry.reason}`}>
              <div className="machine-history-head">
                <strong>{titleize(entry.to)}</strong>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
              <p className="subtle">
                {entry.from ? `${titleize(entry.from)} -> ` : ""}
                {titleize(entry.to)} · {titleize(entry.reason)} · {entry.actor}
              </p>
              {entry.note ? <p className="machine-history-note">{entry.note}</p> : null}
            </li>
          ))}
        </ol>
      </MachineSidecarBlock>
    </div>
  );
}
