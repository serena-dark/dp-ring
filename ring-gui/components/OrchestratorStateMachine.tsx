import { useEffect, useState } from "react";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatDateTime, formatPercent, titleize } from "@ring-gui/lib/format";
import {
  getCurrentDispatch,
  getCurrentDocument,
  getCurrentStageLabel,
} from "@ring-gui/lib/orchestrator";
import { AppLink } from "@ring-gui/lib/router";
import type { OrchestratorJob } from "@ring-gui/types/api";

const REQUIREMENT_STATES = [
  "queued",
  "requirement_dispatched",
  "requirement_document_in_progress",
  "requirement_ready_for_audit",
  "requirement_auditing",
] as const;

const MILESTONE_STATES = [
  "milestone_dispatched",
  "milestone_document_in_progress",
  "milestone_ready_for_finalize",
  "milestones_ready",
] as const;

const READINESS_STATES = [
  "milestones_ready",
  "post_milestone_dispatched",
  "post_milestone_in_progress",
  "workflow_dispatched",
] as const;

const WORKFLOW_STATES = [
  "workflow_dispatched",
  "workflow_in_progress",
  "waiting_for_session_dispatch",
] as const;

const SESSION_STATES = [
  "waiting_for_session_dispatch",
  "session_dispatched",
] as const;

const BRANCH_STATES = [
  "requirement_rework_required",
  "milestone_rework_required",
  "post_milestone_rework_required",
  "workflow_rework_required",
  "failed",
] as const;

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

function stateTone(job: OrchestratorJob, status: string) {
  if (job.status === status) {
    return "current";
  }

  const visited = job.history.some(
    (entry) => entry.to === status || entry.from === status,
  );
  if (visited) {
    return "visited";
  }

  const reachable = (job.state_machine[job.status] ?? []).includes(status);
  return reachable ? "reachable" : "pending";
}

function transitionTone(job: OrchestratorJob, from: string, to: string) {
  if (job.history.some((entry) => entry.from === from && entry.to === to)) {
    return "visited";
  }

  const currentTransitions = job.state_machine[job.status] ?? [];
  if (job.status === from && currentTransitions.includes(to)) {
    return "current";
  }

  return "pending";
}

function renderFlow(
  job: OrchestratorJob,
  statuses: readonly string[],
  currentStatus: string,
) {
  return statuses.map((status, index) => (
    <div key={status} className="machine-flow-segment">
      <div className={`machine-node is-${stateTone(job, status)}`}>
        <span className="machine-node-label">{titleize(status)}</span>
        <span className="machine-node-meta">
          {currentStatus === status ? "Current" : "Stage"}
        </span>
      </div>
      {index < statuses.length - 1 ? (
        <div
          className={`machine-arrow is-${transitionTone(
            job,
            status,
            statuses[index + 1],
          )}`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  ));
}

export function OrchestratorStateMachine({
  job,
  onResolveIntervention,
  resolvingInterventionId = null,
  onDispatchFollowup,
  onCreateFollowupRequirement,
  followupAction = null,
}: {
  job: OrchestratorJob | null;
  onResolveIntervention?: (jobId: string, interventionId: string) => void;
  resolvingInterventionId?: string | null;
  onDispatchFollowup?: (jobId: string) => void;
  onCreateFollowupRequirement?: (jobId: string) => void;
  followupAction?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  if (!job) {
    return (
      <article className="panel state-panel">
        <h3>State machine</h3>
      </article>
    );
  }

  const currentDocument = getCurrentDocument(job);
  const currentDispatch = getCurrentDispatch(job);
  const historyEntries = [...job.history].reverse().slice(0, 8);
  const recentSpans = [...job.trace.spans].reverse().slice(0, 8);
  const openInterventions = job.interventions.filter(
    (intervention) => intervention.status === "open",
  );
  const nextTransitions = (job.state_machine[job.status] ?? []).map(titleize);
  const requirementAuditScore =
    job.requirement_document.audit.score == null
      ? "--"
      : formatPercent(job.requirement_document.audit.score);

  return (
    <article className="panel orchestrator-machine-panel">
      <div className="panel-header">
        <div>
          <h3>{job.requirement_name}</h3>
          <p className="subtle">
            {job.id} · {getCurrentStageLabel(job)} · agent{" "}
            {currentDispatch.agent_id}
          </p>
        </div>
        <StatusBadge value={job.status} />
      </div>

      <div className="detail-grid machine-summary-grid">
        <div className="detail-item">
          <dt>Current stage</dt>
          <dd>{getCurrentStageLabel(job)}</dd>
        </div>
        <div className="detail-item">
          <dt>Next scheduler poll</dt>
          <dd>
            {formatDateTime(job.runtime.next_poll_at)}
            <span className="machine-inline-note">
              {formatCountdown(job.runtime.next_poll_at, now)}
            </span>
          </dd>
        </div>
        <div className="detail-item">
          <dt>Active document</dt>
          <dd>
            <code>{currentDocument.path}</code>
          </dd>
        </div>
        <div className="detail-item">
          <dt>Last document activity</dt>
          <dd>{formatDateTime(currentDocument.last_activity_at)}</dd>
        </div>
        <div className="detail-item">
          <dt>Completion signal</dt>
          <dd>
            {currentDocument.completion_reason
              ? titleize(currentDocument.completion_reason)
              : "--"}
          </dd>
        </div>
        <div className="detail-item">
          <dt>Allowed next</dt>
          <dd>{nextTransitions.length > 0 ? nextTransitions.join(", ") : "--"}</dd>
        </div>
      </div>

      <div className="machine-layout">
        <div className="machine-diagram">
          <div className="machine-track">
            <p className="eyebrow">Requirement Document</p>
            <div className="machine-mainline">
              {renderFlow(job, REQUIREMENT_STATES, job.status)}
            </div>
          </div>

          <div className="machine-track">
            <p className="eyebrow">Milestone Planning</p>
            <div className="machine-mainline machine-mainline-milestone">
              {renderFlow(job, MILESTONE_STATES, job.status)}
            </div>
          </div>

          <div className="machine-track">
            <p className="eyebrow">Readiness Routing</p>
            <div className="machine-mainline machine-mainline-milestone">
              {renderFlow(job, READINESS_STATES, job.status)}
            </div>
          </div>

          <div className="machine-track">
            <p className="eyebrow">Workflow Preparation</p>
            <div className="machine-mainline machine-mainline-milestone">
              {renderFlow(job, WORKFLOW_STATES, job.status)}
            </div>
          </div>

          <div className="machine-track">
            <p className="eyebrow">Batch Session Launch</p>
            <div className="machine-mainline machine-mainline-milestone">
              {renderFlow(job, SESSION_STATES, job.status)}
            </div>
          </div>

          <div className="machine-terminal-row">
            {BRANCH_STATES.map((status) => (
              <div
                key={status}
                className={`machine-node machine-terminal is-${stateTone(job, status)}`}
              >
                <span className="machine-node-label">{titleize(status)}</span>
                <span className="machine-node-meta">
                  {status === "failed"
                    ? "Operator retry"
                    : status === "requirement_rework_required"
                      ? "Rewrite requirement doc"
                      : status === "milestone_rework_required"
                        ? "Rewrite milestone plan"
                        : status === "post_milestone_rework_required"
                          ? "Rewrite readiness outputs"
                          : "Rewrite workflow plan"}
                </span>
              </div>
            ))}
          </div>

          <div className="machine-branch-legend">
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "requirement_auditing",
                "milestone_dispatched",
              )}`}
            >
              Requirement approved
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "requirement_auditing",
                "requirement_rework_required",
              )}`}
            >
              Requirement rework
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "milestone_ready_for_finalize",
                "milestones_ready",
              )}`}
            >
              Milestones materialized
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "milestones_ready",
                "post_milestone_dispatched",
              )}`}
            >
              Readiness branches dispatched
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "post_milestone_in_progress",
                "workflow_dispatched",
              )}`}
            >
              Tasks and feedback emitted
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "workflow_in_progress",
                "waiting_for_session_dispatch",
              )}`}
            >
              Waiting
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "waiting_for_session_dispatch",
                "session_dispatched",
              )}`}
            >
              Launched
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "milestone_ready_for_finalize",
                "milestone_rework_required",
              )}`}
            >
              Milestone rework
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "post_milestone_in_progress",
                "post_milestone_rework_required",
              )}`}
            >
              Readiness rework
            </span>
            <span
              className={`machine-branch-pill is-${transitionTone(
                job,
                "workflow_in_progress",
                "workflow_rework_required",
              )}`}
            >
              Workflow rework
            </span>
          </div>
        </div>

        <div className="machine-sidecar">
          <div className="machine-sidecar-block">
            <p className="eyebrow">Current packet</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Routing policy</p>
            <div className="badge-list">
              <StatusBadge value={job.routing.mode} />
              <StatusBadge value={job.routing.post_milestone_strategy} />
              <StatusBadge value={job.routing.workflow_strategy} />
            </div>
            <p className="subtle">
              Complexity {job.routing.complexity_score} · Human review{" "}
              {titleize(job.routing.human_review_level)}
            </p>
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Requirement review</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Milestone output</p>
            <div className="badge-list">
              <StatusBadge value={job.milestone_plan.status} />
            </div>
            <p className="subtle">
              {job.milestone_plan.generated_milestone_ids.length > 0
                ? `${job.milestone_plan.generated_milestone_ids.length} milestones created`
                : "No milestones."}
            </p>
            {job.milestone_plan.parse_error ? (
              <p className="machine-history-note">
                {job.milestone_plan.parse_error}
              </p>
            ) : null}
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Prerequisite analysis</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Task dispatch</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Workflow preparation</p>
            <div className="badge-list">
              <StatusBadge value={job.workflow_preparation.status} />
            </div>
            <p className="subtle">
              Waiting tasks {job.workflow_preparation.waiting_tasks.length}.{" "}
              Reused {job.workflow_preparation.reused_workflow_ids.length}.{" "}
              Custom {job.workflow_preparation.generated_workflow_ids.length}.
            </p>
            <p className="subtle">
              <code>{job.workflow_preparation.document.path}</code>
            </p>
            {job.workflow_preparation.parse_error ? (
              <p className="machine-history-note">
                {job.workflow_preparation.parse_error}
              </p>
            ) : null}
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Waiting area / session</p>
            <div className="badge-list">
              <StatusBadge value={job.session_dispatch.status} />
              {job.session_dispatch.session_id ? (
                <StatusBadge value="session_live" />
              ) : null}
            </div>
            <p className="subtle">
              Waiting {job.session_dispatch.waiting_task_ids.length}.{" "}
              Runs {job.session_dispatch.workflow_run_ids.length}.
            </p>
            <p className="subtle">
              Session {job.session_dispatch.session_id ?? "--"}
            </p>
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Open interventions</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Follow-up loop</p>
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
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Recent trace spans</p>
            <ol className="machine-history">
              {recentSpans.map((span) => (
                <li key={span.id}>
                  <div className="machine-history-head">
                    <strong>{titleize(span.stage)}</strong>
                    <span>{formatDateTime(span.started_at)}</span>
                  </div>
                  <p className="subtle">
                    {titleize(span.kind)} · {span.agent_id} ·{" "}
                    {titleize(span.status)}
                  </p>
                  {span.note ? (
                    <p className="machine-history-note">{span.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="machine-sidecar-block">
            <p className="eyebrow">Recent history</p>
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
          </div>
        </div>
      </div>
    </article>
  );
}
