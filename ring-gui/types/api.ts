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
  scope?: {
    target_type: "project" | "module" | "file";
    target_path: string;
    repo_root: string;
    file_paths: string[];
  };
  execution?: {
    judge_agent_id: string | null;
    review_status:
      | "pending"
      | "verifying_scope"
      | "scope_failed"
      | "build_failed"
      | "cleanup_failed"
      | "workflow_failed"
      | "workflow_timeout"
      | "awaiting_judgement"
      | "approved"
      | "rejected";
    completion_commit_sha: string | null;
    changed_files: string[];
    scope_match: boolean | null;
    build_required: boolean;
    build_command: string | null;
    build_status: "pending" | "passed" | "failed" | "skipped";
    cleanup_paths: string[];
    cleanup_status: "pending" | "completed" | "failed" | "skipped";
    merge_status: "blocked" | "ready";
    summary_path: string | null;
    review_packet: {
      agent_id: string;
      subject: string;
      body: string;
      dispatched_at: string;
    } | null;
    failure_feedback_id: string | null;
    failure_distillation_id: string | null;
    completion_distillation_id: string | null;
    last_error: string | null;
    checked_at: string | null;
    reviewed_at: string | null;
    note: string | null;
  };
  replanning?: {
    replanner_agent_id: string | null;
    status: "pending" | "awaiting_replan" | "redispatched" | "terminal";
    source_failure: string | null;
    packet: {
      agent_id: string;
      subject: string;
      body: string;
      dispatched_at: string;
    } | null;
    successor_task_id: string | null;
    parent_task_id: string | null;
    decision_note: string | null;
    reviewed_at: string | null;
  };
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
  callback: {
    auth_scheme: "bearer";
    report_url: string | null;
    token: string | null;
    signing_secret: string | null;
    signature_algorithm: "hmac-sha256";
    key_version: number;
    status:
      | "pending"
      | "active"
      | "retry_scheduled"
      | "completed"
      | "failed"
      | "timed_out";
    issued_at: string | null;
    prepared_at: string | null;
    last_report_at: string | null;
    last_retry_at: string | null;
    last_rotated_at: string | null;
    next_retry_at: string | null;
    report_timeout_ms: number;
    max_retries: number;
    retry_count: number;
    retry_backoff_ms: number;
    signature_ttl_ms: number;
    timeout_at: string | null;
    packet_path: string | null;
    allowed_worker_ids: string[];
    accepted_protocols: string[];
    last_worker_id: string | null;
    last_protocol: string | null;
    last_error: string | null;
  };
  reports: Array<{
    at: string;
    status: string;
    actor: string;
    step_id: string | null;
    note: string | null;
    commit_sha: string | null;
    worker_id: string | null;
    protocol: string | null;
    authenticated: boolean;
    outputs: Record<string, unknown> | null;
  }>;
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
  milestone_ids?: string[];
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

export interface ServiceStackStatus {
  state_present: boolean;
  started_at: string | null;
  verified_at: string | null;
  backend_pid: number | null;
  frontend_pid: number | null;
  backend_process_alive: boolean;
  frontend_process_alive: boolean;
  backend_healthy: boolean;
  frontend_healthy: boolean;
  proxy_healthy: boolean;
  overall_status: "healthy" | "degraded" | "offline" | "unmanaged";
  frontend_url: string;
  backend_url: string;
  proxy_url: string;
  backend_log_path: string | null;
  frontend_log_path: string | null;
}

export interface UiConfig {
  schema_version: number;
  theme: {
    mode: "system" | "light" | "dark";
    template_id: string;
  };
  layout: {
    sidebar_width_px: number;
    content_padding_px: number;
    panel_radius_px: number;
  };
}

export interface UiConfigPatch {
  theme?: Partial<UiConfig["theme"]>;
  layout?: Partial<UiConfig["layout"]>;
}

export interface UiThemeTemplate {
  id: string;
  label: string;
  description: string;
  tokens: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Orchestrator / dispatch center
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  schema_version: number;
  message_protocol_version: string;
  poll_interval_ms: number;
  document_idle_threshold_ms: number;
  writer_agent_id: string;
  auditor_agent_id: string;
  milestone_planner_agent_id: string;
  prerequisite_preparer_agent_id: string;
  task_dispatcher_agent_id: string;
  workflow_designer_agent_id: string;
  task_judge_agent_id: string;
  task_replanner_agent_id: string;
  distiller_agent_id: string;
  document_output_dir: string;
  milestone_output_dir: string;
  prerequisite_output_dir: string;
  task_dispatch_output_dir: string;
  workflow_output_dir: string;
  task_summary_output_dir: string;
  followup_output_dir: string;
  session_runner: {
    report_timeout_ms: number;
    max_report_retries: number;
    retry_backoff_ms: number;
    signature_ttl_ms: number;
  };
  automation: {
    enabled: boolean;
    loopback_agents: boolean;
    loopback_worker: boolean;
    auto_judge: boolean;
    auto_replan: boolean;
    max_replan_depth: number;
    worker_id: string;
    judge_agent_id: string;
    replanner_agent_id: string;
    commit_message_prefix: string;
    default_callback_protocol: string;
  };
  auditor: {
    min_character_count: number;
    require_heading: boolean;
    require_subsection: boolean;
    require_list: boolean;
  };
}

export interface OrchestratorAgentCard {
  id: string;
  display_name: string;
  role: string;
  description: string;
  accepts: string[];
  produces: string[];
  capability_tags: string[];
  callback_endpoint: string;
}

export interface OrchestratorWorkerCard {
  id: string;
  display_name: string;
  role: string;
  description: string;
  status: "active" | "inactive";
  callback_protocols: string[];
  auth_schemes: string[];
  capability_tags: string[];
}

export type OrchestratorJobStatus =
  | "queued"
  | "requirement_dispatched"
  | "requirement_document_in_progress"
  | "requirement_ready_for_audit"
  | "requirement_auditing"
  | "requirement_rework_required"
  | "milestone_dispatched"
  | "milestone_document_in_progress"
  | "milestone_ready_for_finalize"
  | "milestone_rework_required"
  | "milestones_ready"
  | "post_milestone_dispatched"
  | "post_milestone_in_progress"
  | "post_milestone_rework_required"
  | "workflow_dispatched"
  | "workflow_in_progress"
  | "workflow_rework_required"
  | "waiting_for_session_dispatch"
  | "session_dispatched"
  | "failed";

export type OrchestratorJobStage =
  | "requirement_document"
  | "milestone_plan"
  | "post_milestone_orchestration"
  | "workflow_preparation"
  | "session_dispatch"
  | "completed";

export interface OrchestratorHistoryEntry {
  timestamp: string;
  from: string | null;
  to: string;
  actor: string;
  reason: string;
  note: string | null;
}

export interface OrchestratorPacket {
  id: string;
  protocol_version: string;
  trace_id: string;
  sender: {
    id: string;
    role: string;
  };
  recipient: string;
  recipient_card: OrchestratorAgentCard | null;
  kind: string;
  subject: string;
  dispatched_at: string;
  body: string;
  callback: {
    kind: string;
    method: string;
    path: string;
  };
  artifacts: Array<{
    kind: string;
    id: string | null;
    path: string | null;
    role: "source" | "target";
  }>;
  routing: OrchestratorRoutingPolicy;
  payload: {
    requirement_id: string;
    requirement_name: string;
    description: string;
    acceptance_criteria: AcceptanceCriterion[];
    document_path: string;
    source_document_path: string | null;
  };
}

export interface OrchestratorAgentReport {
  at: string;
  agent_id: string;
  status: "in_progress" | "completed" | "failed";
  note: string | null;
}

export interface OrchestratorDocumentState {
  path: string;
  exists: boolean;
  initial_signature: string | null;
  current_signature: string | null;
  has_observed_progress: boolean;
  last_modified_at: string | null;
  last_activity_at: string | null;
  completion_reason: "idle_timeout" | "agent_report" | null;
  completion_reported_at: string | null;
}

export interface OrchestratorAuditFinding {
  id: string;
  passed: boolean;
  detail: string;
}

export interface OrchestratorAudit {
  auditor_agent_id: string;
  status: "pending" | "running" | "approved" | "rework_required";
  verdict: "approved" | "rework_required" | null;
  score: number | null;
  findings: OrchestratorAuditFinding[];
  metrics: {
    character_count: number;
    heading_count: number;
    subsection_count: number;
    bullet_count: number;
  } | null;
  requested_at: string | null;
  completed_at: string | null;
}

export interface OrchestratorDispatch {
  agent_id: string;
  packet: OrchestratorPacket | null;
  reports: OrchestratorAgentReport[];
  last_dispatched_at: string | null;
}

export interface OrchestratorRuntime {
  last_polled_at: string | null;
  next_poll_at: string | null;
  poll_interval_ms: number;
  idle_threshold_ms: number;
  last_error: string | null;
}

export interface OrchestratorRoutingPolicy {
  mode: "lean" | "balanced" | "deep";
  complexity_score: number;
  post_milestone_strategy: "parallel" | "serial";
  workflow_strategy: "reuse_strict" | "reuse_first" | "hybrid";
  human_review_level: "standard" | "elevated";
  explanation: string;
}

export interface OrchestratorTraceSpan {
  id: string;
  parent_span_id: string | null;
  stage: string;
  kind: string;
  agent_id: string;
  packet_id: string | null;
  status:
    | "running"
    | "completed"
    | "failed"
    | "intervention_required";
  started_at: string;
  completed_at: string | null;
  note: string | null;
}

export interface OrchestratorTrace {
  trace_id: string;
  active_span_ids: string[];
  spans: OrchestratorTraceSpan[];
}

export interface OrchestratorIntervention {
  id: string;
  status: "open" | "resolved";
  severity: "warning" | "critical";
  source: string;
  stage: string;
  reason: string;
  recommendation: string;
  created_at: string;
  resolved_at: string | null;
  note: string | null;
}

export interface OrchestratorRequirementDocument {
  writer_agent_id: string;
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  audit: OrchestratorAudit;
}

export interface OrchestratorMilestonePlan {
  planner_agent_id: string;
  status: "pending" | "planning" | "completed" | "rework_required";
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  generated_milestone_ids: string[];
  completed_at: string | null;
  parse_error: string | null;
}

export interface OrchestratorReadinessItem {
  id: string | null;
  description: string;
  check_type: "automated" | "human" | "reference" | string;
  reason?: string | null;
}

export interface OrchestratorReadinessGroup {
  milestone_id: string;
  milestone_name: string;
  items: OrchestratorReadinessItem[];
}

export interface OrchestratorDistillationResult {
  distiller_agent_id: string;
  status: "pending" | "completed";
  distillation_id: string | null;
  feedback_ids: string[];
  completed_at: string | null;
}

export interface OrchestratorPrerequisiteAnalysis {
  preparer_agent_id: string;
  status: "pending" | "preparing" | "completed" | "rework_required";
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  ready_groups: OrchestratorReadinessGroup[];
  blocked_groups: OrchestratorReadinessGroup[];
  parse_error: string | null;
  completed_at: string | null;
  distillation: OrchestratorDistillationResult;
}

export interface OrchestratorTaskDispatch {
  dispatcher_agent_id: string;
  status: "pending" | "dispatching" | "completed" | "rework_required";
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  generated_task_ids: string[];
  task_document_paths: string[];
  parse_error: string | null;
  completed_at: string | null;
}

export interface OrchestratorWaitingTask {
  task_id: string;
  task_name: string;
  task_type: string;
  milestone_id: string;
  task_document_path: string;
  task_document_ready: boolean;
  prerequisites_ready: boolean;
  workflow_ready: boolean;
  workflow_template_id: string;
  workflow_name: string;
  workflow_source: "registry_reuse" | "existing_reuse" | "custom_generated";
  registry_rank: number | null;
  registry_mode: "exploit" | "explore" | null;
  ready_at: string;
  dispatched_at: string | null;
}

export interface OrchestratorWorkflowPreparation {
  planner_agent_id: string;
  status: "pending" | "planning" | "completed" | "rework_required";
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  waiting_tasks: OrchestratorWaitingTask[];
  generated_workflow_ids: string[];
  reused_workflow_ids: string[];
  parse_error: string | null;
  completed_at: string | null;
}

export interface OrchestratorSessionDispatch {
  dispatcher_id: string;
  status: "pending" | "waiting" | "dispatched";
  dispatch: OrchestratorDispatch;
  waiting_task_ids: string[];
  session_id: string | null;
  workflow_run_ids: string[];
  launched_at: string | null;
}

export interface OrchestratorFollowup {
  distiller_agent_id: string;
  status: "pending" | "drafting" | "completed" | "failed";
  document: OrchestratorDocumentState;
  dispatch: OrchestratorDispatch;
  source_intervention_ids: string[];
  generated_requirement_id: string | null;
  generated_job_id: string | null;
  completed_at: string | null;
  parse_error: string | null;
}

export type DispatchBundleProtocol =
  | "ring.goal.v1"
  | "a2a.task+artifacts"
  | "mcp.resource-set";

export type DispatchArtifactTransport =
  | "https"
  | "oci-distribution@1.1"
  | "inline";

export type DispatchBundleStatus =
  | "bundle_received"
  | "bundle_normalized"
  | "bundle_validated"
  | "materials_staged"
  | "task_planning"
  | "workflow_resolving"
  | "ready_queued"
  | "session_batched"
  | "session_launched"
  | "validation_failed"
  | "material_stage_failed"
  | "task_planning_failed"
  | "workflow_resolution_failed"
  | "launch_failed";

export interface DispatchProtocolDescriptor {
  id: string;
  bundle_protocol: DispatchBundleProtocol;
  bundle_version: string;
  description: string;
  required_fields: string[];
  transport_support: DispatchArtifactTransport[];
  support_level: "full" | "limited";
}

export interface DispatchMaterial {
  material_id: string;
  kind: string;
  uri: string | null;
  format: string;
  checksum: string | null;
  size_bytes: number | null;
  mount_to: string;
  required: boolean;
  inline_data: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ExecutionGoalBundle {
  schema_version: "execution.goal.v1";
  goal_bundle_id: string;
  trace: {
    trace_id: string;
    job_id: string | null;
    source_kind: string;
  };
  producer: {
    producer_id: string;
    producer_type: string;
    source_system: string;
    source_flow: string | null;
  };
  goal: {
    goal_id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
  };
  environment: {
    project_id: string;
    repo_root: string;
    target_scope: {
      level: "project" | "module" | "file";
      include_paths: string[];
      exclude_paths: string[];
      repo_root: string;
    };
    constraints: {
      must_build: boolean;
      must_cleanup: boolean;
      build_command: string | null;
      cleanup_paths: string[];
      merge_policy: string;
      priority: string;
      workflow_strategy: string;
      session_group_key: string | null;
    };
  };
  materials: DispatchMaterial[];
  context: {
    artifact_refs: string[];
    brief_ref: string | null;
    prompts: string[];
    requirement_id?: string;
    milestone_id?: string;
  };
  callbacks: {
    status_report: string;
    intervention: string;
  };
  provenance: {
    original_protocol: string;
    original_version: string;
    artifact_transport: DispatchArtifactTransport;
    submitted_by: string;
    producer_metadata: Record<string, unknown>;
  };
}

export interface AdaptiveBundleEnvelope {
  bundle_protocol: DispatchBundleProtocol;
  bundle_version: string;
  artifact_transport: DispatchArtifactTransport;
  payload: Record<string, unknown>;
  attachments?: Array<Record<string, unknown>>;
  submitted_by?: string;
}

export interface DispatchBundleError {
  at: string;
  code: string;
  message: string;
  details: unknown;
}

export interface DispatchBundleRecord {
  id: string;
  bundle_protocol: DispatchBundleProtocol;
  bundle_version: string;
  artifact_transport: DispatchArtifactTransport;
  submitted_by: string;
  status: DispatchBundleStatus;
  created_at: string;
  updated_at: string;
  state_machine: Record<string, string[]>;
  envelope: {
    payload: Record<string, unknown>;
    attachments: Array<Record<string, unknown>>;
  };
  normalization: {
    adapter_id: string | null;
    normalized_at: string | null;
    error: string | null;
  };
  canonical: ExecutionGoalBundle | null;
  staging: {
    status: "pending" | "completed" | "failed";
    materials: Array<{
      material_id: string;
      status: string;
      transport: DispatchArtifactTransport;
      uri: string | null;
      resolved_path: string | null;
      mount_to: string;
      checksum: string | null;
      download_path?: string | null;
      extracted_path?: string | null;
      source_path?: string | null;
      manifest_uri?: string | null;
      verified_size_bytes?: number | null;
      checksum_verified?: boolean;
    }>;
    completed_at: string | null;
    error: string | null;
  };
  planning: {
    status: "pending" | "running" | "completed" | "failed";
    requirement_id: string | null;
    milestone_id: string | null;
    planned_task_ids: string[];
    task_document_paths: string[];
    completed_at: string | null;
    error: string | null;
  };
  workflows: {
    status: "pending" | "completed" | "failed";
    strategy: string;
    waiting_tasks: OrchestratorWaitingTask[];
    generated_workflow_ids: string[];
    reused_workflow_ids: string[];
    completed_at: string | null;
    error: string | null;
  };
  batching: {
    status: "pending" | "queued" | "batched" | "launched" | "failed";
    session_group_key: string | null;
    session_id: string | null;
    workflow_run_ids: string[];
    launched_at: string | null;
    error: string | null;
  };
  reports: Array<{
    at: string;
    status: string;
    note: string | null;
    source: string;
  }>;
  errors: DispatchBundleError[];
  history: OrchestratorHistoryEntry[];
}

export interface OrchestratorJob {
  id: string;
  status: OrchestratorJobStatus;
  current_stage: OrchestratorJobStage;
  created_at: string;
  updated_at: string;
  created_by: string;
  requirement_id: string;
  requirement_name: string;
  routing: OrchestratorRoutingPolicy;
  interventions: OrchestratorIntervention[];
  trace: OrchestratorTrace;
  state_machine: Record<string, string[]>;
  requirement_document: OrchestratorRequirementDocument;
  milestone_plan: OrchestratorMilestonePlan;
  post_milestone: {
    prerequisite_analysis: OrchestratorPrerequisiteAnalysis;
    task_dispatch: OrchestratorTaskDispatch;
  };
  workflow_preparation: OrchestratorWorkflowPreparation;
  session_dispatch: OrchestratorSessionDispatch;
  followup: OrchestratorFollowup;
  runtime: OrchestratorRuntime;
  history: OrchestratorHistoryEntry[];
}

export interface OrchestratedRequirementResult {
  requirement: Requirement;
  job: OrchestratorJob;
}

export interface OrchestratedFollowupResult {
  source_job: OrchestratorJob;
  followup_requirement: Requirement;
  followup_job: OrchestratorJob;
}

export interface OrchestratorTickResult {
  ok: true;
  skipped: boolean;
  processed: OrchestratorJob[];
  processed_bundles: DispatchBundleRecord[];
  hook_results?: Array<Record<string, unknown>>;
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
