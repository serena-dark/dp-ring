import { titleize } from "@ring-gui/lib/format";
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

const BRANCH_PILLS = [
  ["requirement_auditing", "milestone_dispatched", "Requirement approved"],
  ["requirement_auditing", "requirement_rework_required", "Requirement rework"],
  ["milestone_ready_for_finalize", "milestones_ready", "Milestones materialized"],
  ["milestones_ready", "post_milestone_dispatched", "Readiness branches dispatched"],
  ["post_milestone_in_progress", "workflow_dispatched", "Tasks and feedback emitted"],
  ["workflow_in_progress", "waiting_for_session_dispatch", "Waiting"],
  ["waiting_for_session_dispatch", "session_dispatched", "Launched"],
  ["milestone_ready_for_finalize", "milestone_rework_required", "Milestone rework"],
  ["post_milestone_in_progress", "post_milestone_rework_required", "Readiness rework"],
  ["workflow_in_progress", "workflow_rework_required", "Workflow rework"],
] as const;

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

function terminalMeta(status: (typeof BRANCH_STATES)[number]) {
  switch (status) {
    case "failed":
      return "Operator retry";
    case "requirement_rework_required":
      return "Rewrite requirement doc";
    case "milestone_rework_required":
      return "Rewrite milestone plan";
    case "post_milestone_rework_required":
      return "Rewrite readiness outputs";
    case "workflow_rework_required":
    default:
      return "Rewrite workflow plan";
  }
}

function MachineTrack({
  label,
  statuses,
  job,
  baseLine = false,
}: {
  label: string;
  statuses: readonly string[];
  job: OrchestratorJob;
  baseLine?: boolean;
}) {
  return (
    <div className="machine-track">
      <p className="eyebrow">{label}</p>
      <div className={baseLine ? "machine-mainline" : "machine-mainline machine-mainline-milestone"}>
        {renderFlow(job, statuses, job.status)}
      </div>
    </div>
  );
}

export function OrchestratorMachineDiagram({ job }: { job: OrchestratorJob }) {
  return (
    <div className="machine-diagram">
      <MachineTrack
        label="Requirement Document"
        statuses={REQUIREMENT_STATES}
        job={job}
        baseLine
      />
      <MachineTrack label="Milestone Planning" statuses={MILESTONE_STATES} job={job} />
      <MachineTrack label="Readiness Routing" statuses={READINESS_STATES} job={job} />
      <MachineTrack label="Workflow Preparation" statuses={WORKFLOW_STATES} job={job} />
      <MachineTrack label="Batch Session Launch" statuses={SESSION_STATES} job={job} />

      <div className="machine-terminal-row">
        {BRANCH_STATES.map((status) => (
          <div
            key={status}
            className={`machine-node machine-terminal is-${stateTone(job, status)}`}
          >
            <span className="machine-node-label">{titleize(status)}</span>
            <span className="machine-node-meta">{terminalMeta(status)}</span>
          </div>
        ))}
      </div>

      <div className="machine-branch-legend">
        {BRANCH_PILLS.map(([from, to, label]) => (
          <span
            key={`${from}:${to}`}
            className={`machine-branch-pill is-${transitionTone(job, from, to)}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
