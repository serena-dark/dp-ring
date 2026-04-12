import type { ArtifactType } from "@ring-gui/types/api";

export const requirementStatuses = [
  "draft",
  "analyzing",
  "ready",
  "in_progress",
  "completed",
  "archived",
] as const;

export const milestoneStatuses = [
  "draft",
  "active",
  "blocked",
  "satisfied",
  "archived",
] as const;

export const taskStatuses = [
  "pending",
  "ready",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

export const workflowStatuses = [
  "active",
  "deprecated",
  "archived",
] as const;

export const sessionStatuses = [
  "gate_pending",
  "preparing",
  "executing",
  "reviewing",
  "closing",
  "closed",
  "failed",
] as const;

export const feedbackStatuses = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "wont_fix",
] as const;

export const requirementPriorities = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const feedbackSeverities = [
  "critical",
  "major",
  "minor",
  "info",
] as const;

export const feedbackCategories = [
  "requirement_gap",
  "implementation_bug",
  "workflow_flaw",
  "tooling_issue",
  "process_issue",
] as const;

export const executionModes = ["serial", "parallel"] as const;

type TransitionMap = Record<string, string[]>;

const transitionsByType: Partial<Record<ArtifactType, TransitionMap>> = {
  requirement: {
    draft: ["analyzing", "archived"],
    analyzing: ["ready", "draft"],
    ready: ["in_progress", "analyzing"],
    in_progress: ["completed", "ready"],
    completed: ["archived"],
    archived: ["draft"],
  },
  milestone: {
    draft: ["active"],
    active: ["blocked", "satisfied"],
    blocked: ["active"],
    satisfied: ["archived"],
    archived: ["draft"],
  },
  task: {
    pending: ["ready", "cancelled"],
    ready: ["in_progress", "cancelled"],
    in_progress: ["completed", "failed"],
    completed: [],
    failed: ["pending"],
    cancelled: [],
  },
  workflow: {
    active: ["deprecated", "archived"],
    deprecated: ["active", "archived"],
    archived: ["active"],
  },
  session: {
    gate_pending: ["preparing", "failed"],
    preparing: ["executing", "failed"],
    executing: ["reviewing", "failed"],
    reviewing: ["closing", "executing"],
    closing: ["closed"],
    closed: [],
    failed: ["gate_pending"],
  },
  feedback: {
    open: ["acknowledged", "resolved", "wont_fix"],
    acknowledged: ["in_progress", "resolved", "wont_fix"],
    in_progress: ["resolved", "wont_fix", "open"],
    resolved: ["open"],
    wont_fix: ["open"],
  },
  distillation: {
    draft: ["published"],
    published: ["archived"],
    archived: ["draft"],
  },
};

export function validNextStatuses(type: ArtifactType, status: string): string[] {
  return transitionsByType[type]?.[status] ?? [];
}

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted";

const statusTones: Record<string, BadgeTone> = {
  draft: "muted",
  analyzing: "info",
  ready: "info",
  in_progress: "warning",
  completed: "success",
  archived: "muted",
  active: "success",
  blocked: "danger",
  satisfied: "success",
  pending: "muted",
  planning: "info",
  preparing: "info",
  dispatching: "warning",
  waiting: "info",
  dispatched: "success",
  session_live: "success",
  cancelled: "muted",
  deprecated: "warning",
  gate_pending: "warning",
  executing: "warning",
  reviewing: "info",
  closing: "warning",
  closed: "success",
  healthy: "success",
  degraded: "warning",
  offline: "danger",
  unmanaged: "muted",
  requirement_dispatched: "info",
  requirement_document_in_progress: "warning",
  requirement_ready_for_audit: "info",
  requirement_auditing: "info",
  requirement_rework_required: "danger",
  milestone_dispatched: "info",
  milestone_document_in_progress: "warning",
  milestone_ready_for_finalize: "info",
  milestone_rework_required: "danger",
  milestones_ready: "success",
  post_milestone_dispatched: "info",
  post_milestone_in_progress: "warning",
  post_milestone_rework_required: "danger",
  workflow_dispatched: "info",
  workflow_in_progress: "warning",
  workflow_rework_required: "danger",
  waiting_for_session_dispatch: "info",
  session_dispatched: "success",
  bundle_received: "info",
  bundle_normalized: "info",
  bundle_validated: "info",
  materials_staged: "warning",
  task_planning: "warning",
  workflow_resolving: "warning",
  ready_queued: "info",
  session_batched: "warning",
  session_launched: "success",
  validation_failed: "danger",
  material_stage_failed: "danger",
  task_planning_failed: "danger",
  workflow_resolution_failed: "danger",
  launch_failed: "danger",
  full: "success",
  limited: "warning",
  verifying_scope: "warning",
  scope_failed: "danger",
  build_failed: "danger",
  cleanup_failed: "danger",
  awaiting_judgement: "info",
  approved: "success",
  rejected: "danger",
  passed: "success",
  skipped: "muted",
  failed: "danger",
  open: "danger",
  acknowledged: "warning",
  resolved: "success",
  wont_fix: "muted",
  published: "success",
};

const severityTones: Record<string, BadgeTone> = {
  critical: "danger",
  major: "warning",
  minor: "info",
  info: "neutral",
};

const priorityTones: Record<string, BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

export function toneForStatus(value: string): BadgeTone {
  return statusTones[value] ?? "neutral";
}

export function toneForSeverity(value: string): BadgeTone {
  return severityTones[value] ?? "neutral";
}

export function toneForPriority(value: string): BadgeTone {
  return priorityTones[value] ?? "neutral";
}
