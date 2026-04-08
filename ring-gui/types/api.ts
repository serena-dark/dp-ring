/**
 * Ring API types — the contract between ring-gui (frontend) and ring (backend).
 *
 * The backend (ring/server.mjs) serves these endpoints.
 * The frontend (ring-gui/) consumes them via ring-gui/api/client.ts.
 *
 * Every artifact shares a common Envelope shape. The `data` field is type-specific.
 */

// ---------------------------------------------------------------------------
// Common Envelope
// ---------------------------------------------------------------------------

export interface Envelope<TData = unknown> {
  id: string;
  type: ArtifactType;
  version: number;
  created_at: string; // ISO-8601
  updated_at: string;
  created_by: string;
  session_id: string | null;
  status: string;
  data: TData;
}

export type ArtifactType =
  | "requirement"
  | "milestone"
  | "task"
  | "workflow"
  | "workflow-run"
  | "session"
  | "evaluation"
  | "feedback"
  | "distillation";

// ---------------------------------------------------------------------------
// Data payloads (per artifact type)
// ---------------------------------------------------------------------------

export interface AcceptanceCriterion {
  id: string;
  description: string;
  satisfied: boolean;
}

export interface RequirementData {
  name: string;
  description: string;
  acceptance_criteria: AcceptanceCriterion[];
  milestone_ids?: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface Prerequisite {
  id: string;
  description: string;
  check_type: "automated" | "human" | "reference";
  check: Record<string, unknown>;
  status: "satisfied" | "unsatisfied" | "unknown";
  last_checked: string | null;
}

export interface MilestoneData {
  name: string;
  requirement_id: string;
  description: string;
  acceptance_checks?: Array<{
    id: string;
    description: string;
    checked: boolean;
  }>;
  prerequisites: Prerequisite[];
}

export interface TaskData {
  name: string;
  description: string;
  task_type: string;
  requirement_id: string;
  milestone_id: string;
  workflow_template_id?: string | null;
  workflow_run_id?: string | null;
  execution_mode?: "serial" | "parallel" | null;
  acceptance_criteria: AcceptanceCriterion[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  inputs?: string[];
  outputs?: string[];
}

export interface WorkflowData {
  name: string;
  description: string;
  applicable_to: string[];
  steps: WorkflowStep[];
  quality_history?: {
    usage_count: number;
    avg_composite_score: number | null;
    recent_scores: Array<{
      session_id: string;
      composite_score: number;
    }>;
  };
}

export interface WorkflowRunStepStatus {
  step_id: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at: string | null;
  ended_at: string | null;
  outputs: Record<string, unknown>;
  notes: string | null;
}

export interface WorkflowRunData {
  workflow_template_id: string;
  workflow_template_version: number;
  task_id: string;
  current_step_index: number;
  steps: WorkflowRunStepStatus[];
}

export interface SessionLogEntry {
  timestamp: string;
  event: string;
  from?: string;
  to?: string;
  actor?: string;
  detail?: string;
}

export interface SessionData {
  requirement_id: string;
  milestone_id: string;
  task_ids: string[];
  workflow_run_ids: string[];
  evaluation_id: string | null;
  distillation_id: string | null;
  context_injected?: {
    workflow_template: string | null;
    distillations_applied: string[];
    registry_rank_at_selection: number | null;
  };
  execution_log: SessionLogEntry[];
}

export interface QualityScores {
  correctness: number;
  completeness: number;
  efficiency: number;
  adherence: number;
  reusability: number;
}

export interface EvaluationEvidence {
  tests_passed?: number;
  tests_failed?: number;
  build_status?: "success" | "failure" | "skipped";
  lint_errors?: number;
  criteria_satisfied?: string[];
  criteria_unsatisfied?: string[];
  total_tokens?: number;
  wall_clock_seconds?: number;
  retry_count?: number;
  human_interventions?: number;
  assets_formalized?: string[];
}

export interface EvaluationData {
  session_id: string;
  outcome: "success" | "failure" | "partial";
  scores: QualityScores;
  composite_score: number;
  score_weights: QualityScores;
  evidence: EvaluationEvidence;
  evaluator: "automated" | "human" | "hybrid";
  notes: string | null;
}

export interface FeedbackData {
  source_session_id?: string | null;
  severity: "critical" | "major" | "minor" | "info";
  category:
    | "requirement_gap"
    | "implementation_bug"
    | "workflow_flaw"
    | "tooling_issue"
    | "process_issue";
  target: { type: string; id: string; field?: string | null };
  description: string;
  proposed_action?: string | null;
  resolution_session_id?: string | null;
}

export interface DistillationArtifact {
  kind:
    | "lesson"
    | "pattern"
    | "anti-pattern"
    | "tool-config"
    | "prompt-template";
  summary: string;
  context: string;
  applicable_when: string;
  confidence: number;
  source_sessions: string[];
}

export interface DistillationData {
  source_session_id: string;
  artifacts: DistillationArtifact[];
}

// ---------------------------------------------------------------------------
// Typed artifact aliases
// ---------------------------------------------------------------------------

export type Requirement = Envelope<RequirementData>;
export type Milestone = Envelope<MilestoneData>;
export type Task = Envelope<TaskData>;
export type Workflow = Envelope<WorkflowData>;
export type WorkflowRun = Envelope<WorkflowRunData>;
export type Session = Envelope<SessionData>;
export type Evaluation = Envelope<EvaluationData>;
export type Feedback = Envelope<FeedbackData>;
export type Distillation = Envelope<DistillationData>;

// ---------------------------------------------------------------------------
// Registry / Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  workflow_id: string;
  avg_score: number;
  usage_count: number;
  last_used: string;
}

export interface Leaderboard {
  updated_at: string;
  rankings: Record<string, LeaderboardEntry[]>;
}

// ---------------------------------------------------------------------------
// Gate evaluation result
// ---------------------------------------------------------------------------

export interface PrerequisiteResult {
  id: string;
  satisfied: boolean;
  detail: string;
}

export interface GateResult {
  passed: boolean;
  results: PrerequisiteResult[];
  blocking_feedback: {
    critical: Feedback[];
    major_unacknowledged: Feedback[];
  };
}

// ---------------------------------------------------------------------------
// Knowledge query result
// ---------------------------------------------------------------------------

export interface KnowledgeItem {
  distillation_id: string;
  kind: string;
  summary: string;
  confidence: number;
  applicable_when: string;
}

// ---------------------------------------------------------------------------
// Session context (agent startup bundle)
// ---------------------------------------------------------------------------

export interface SessionContext {
  session: Session;
  tasks: Task[];
  workflow_runs: WorkflowRun[];
  workflow_templates: Workflow[];
  knowledge: KnowledgeItem[];
  blocking_feedback: {
    critical: Feedback[];
    major: Feedback[];
  };
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;
