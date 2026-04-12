import type {
  OrchestratorDispatch,
  OrchestratorDocumentState,
  OrchestratorJob,
} from "@ring-gui/types/api";

const waitingForAgentStatuses = new Set([
  "requirement_dispatched",
  "requirement_document_in_progress",
  "milestone_dispatched",
  "milestone_document_in_progress",
  "workflow_dispatched",
  "workflow_in_progress",
]);

const retryableStatuses = new Set([
  "requirement_rework_required",
  "milestone_rework_required",
  "post_milestone_rework_required",
  "workflow_rework_required",
  "failed",
]);

const finalStatuses = new Set([
  "session_dispatched",
  "failed",
  "requirement_rework_required",
  "milestone_rework_required",
  "post_milestone_rework_required",
  "workflow_rework_required",
]);

export function isMilestoneStage(job: OrchestratorJob): boolean {
  return (
    job.current_stage === "milestone_plan" ||
    job.status.startsWith("milestone_") ||
    job.status === "milestones_ready"
  );
}

export function isPostMilestoneStage(job: OrchestratorJob): boolean {
  return (
    job.current_stage === "post_milestone_orchestration" ||
    job.status.startsWith("post_milestone_") ||
    job.status === "milestones_ready"
  );
}

export function isWorkflowStage(job: OrchestratorJob): boolean {
  return (
    job.current_stage === "workflow_preparation" ||
    job.status.startsWith("workflow_")
  );
}

export function isSessionDispatchStage(job: OrchestratorJob): boolean {
  return (
    job.current_stage === "session_dispatch" ||
    job.current_stage === "completed" ||
    job.status === "waiting_for_session_dispatch" ||
    job.status === "session_dispatched"
  );
}

export function getCurrentDocument(job: OrchestratorJob): OrchestratorDocumentState {
  if (isSessionDispatchStage(job) || isWorkflowStage(job)) {
    return job.workflow_preparation.document;
  }
  if (isPostMilestoneStage(job)) {
    return job.post_milestone.prerequisite_analysis.status !== "completed"
      ? job.post_milestone.prerequisite_analysis.document
      : job.post_milestone.task_dispatch.document;
  }
  return isMilestoneStage(job)
    ? job.milestone_plan.document
    : job.requirement_document.document;
}

export function getCurrentDispatch(job: OrchestratorJob): OrchestratorDispatch {
  if (isSessionDispatchStage(job)) {
    return job.session_dispatch.dispatch;
  }
  if (isWorkflowStage(job)) {
    return job.workflow_preparation.dispatch;
  }
  if (isPostMilestoneStage(job)) {
    return job.post_milestone.prerequisite_analysis.status !== "completed"
      ? job.post_milestone.prerequisite_analysis.dispatch
      : job.post_milestone.task_dispatch.dispatch;
  }
  return isMilestoneStage(job)
    ? job.milestone_plan.dispatch
    : job.requirement_document.dispatch;
}

export function getCurrentStageLabel(job: OrchestratorJob): string {
  if (job.current_stage === "completed") {
    return "Session Dispatched";
  }
  if (isSessionDispatchStage(job)) {
    return "Batch Session Launch";
  }
  if (isWorkflowStage(job)) {
    return "Workflow Preparation";
  }
  if (isPostMilestoneStage(job)) {
    return "Readiness Routing";
  }
  return isMilestoneStage(job) ? "Milestone Planning" : "Requirement Document";
}

export function isAwaitingAgent(job: OrchestratorJob): boolean {
  return waitingForAgentStatuses.has(job.status);
}

export function isRetryable(job: OrchestratorJob): boolean {
  return retryableStatuses.has(job.status);
}

export function isJobActive(job: OrchestratorJob): boolean {
  return !finalStatuses.has(job.status);
}
