import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  buildSessionContextInjected,
  buildSessionDispatchMessageEnvelopeOptions as sessionDispatchMessageEnvelopeCallOptions,
  buildSessionDispatchMessageEnvelopeState as sessionDispatchMessageEnvelopeState,
  buildSessionDispatchPacketWaitingTaskViews as sessionDispatchPacketWaitingTaskViews,
  buildWaitingTaskGovernanceViewState,
  buildSessionGovernanceContext,
  buildWaitingTaskRecord,
  buildWorkflowPreparationPayloadWaitingTaskListState as workflowPreparationPayloadWaitingTaskListState,
  buildWorkflowPreparationPromptRenderView as workflowPreparationPromptRenderView,
  buildWorkflowPreparationWaitingTaskListRenderView as workflowPreparationWaitingTaskListRenderView,
  checkpointAutomaticReuseSelectionPolicy as checkpointAutomaticReusePolicy,
  checkpointEffectiveForceState,
  governanceBatchSignature,
  governedAutomaticReuseSelectionState,
  waitingTaskGovernanceBlockedReuse,
  workflowReuseGovernanceBlock,
} from './governance-policy.mjs';
import { createEmptyCapsuleState } from './node-capsule.mjs';

const DEFAULT_CONFIG = {
  schema_version: 4,
  message_protocol_version: 'ring.orchestrator.v1',
  poll_interval_ms: 30_000,
  document_idle_threshold_ms: 120_000,
  writer_agent_id: 'writer-agent',
  auditor_agent_id: 'auditor',
  milestone_planner_agent_id: 'milestone-planner',
  prerequisite_preparer_agent_id: 'prerequisite-preparer',
  task_dispatcher_agent_id: 'task-dispatcher',
  workflow_designer_agent_id: 'workflow-architect',
  task_judge_agent_id: 'task-judge',
  task_replanner_agent_id: 'task-replanner',
  distiller_agent_id: 'distiller',
  document_output_dir: 'docs/generated',
  milestone_output_dir: 'docs/milestones',
  prerequisite_output_dir: 'docs/prerequisites',
  task_dispatch_output_dir: 'docs/tasks/plans',
  workflow_output_dir: 'docs/workflows/plans',
  task_summary_output_dir: 'docs/tasks/reviews',
  followup_output_dir: 'docs/followups',
  session_runner: {
    report_timeout_ms: 120_000,
    max_report_retries: 2,
    retry_backoff_ms: 30_000,
    signature_ttl_ms: 300_000,
  },
  automation: {
    enabled: false,
    loopback_agents: true,
    loopback_worker: true,
    auto_judge: true,
    auto_replan: true,
    max_replan_depth: 1,
    worker_id: 'worker-agent',
    judge_agent_id: 'task-judge',
    replanner_agent_id: 'task-replanner',
    commit_message_prefix: 'ring auto',
    default_callback_protocol: 'ring.workflow-run-report.v1',
  },
  auditor: {
    min_character_count: 240,
    require_heading: true,
    require_subsection: true,
    require_list: true,
  },
};

const JOB_STATE_MACHINE = {
  queued: ['requirement_dispatched', 'failed'],
  requirement_dispatched: ['requirement_document_in_progress', 'requirement_ready_for_audit', 'failed'],
  requirement_document_in_progress: ['requirement_ready_for_audit', 'failed'],
  requirement_ready_for_audit: ['requirement_auditing', 'failed'],
  requirement_auditing: ['milestone_dispatched', 'requirement_rework_required', 'failed'],
  requirement_rework_required: ['requirement_dispatched', 'failed'],
  milestone_dispatched: ['milestone_document_in_progress', 'milestone_ready_for_finalize', 'failed'],
  milestone_document_in_progress: ['milestone_ready_for_finalize', 'failed'],
  milestone_ready_for_finalize: ['milestones_ready', 'milestone_rework_required', 'failed'],
  milestone_rework_required: ['milestone_dispatched', 'failed'],
  milestones_ready: ['post_milestone_dispatched', 'failed'],
  post_milestone_dispatched: ['post_milestone_in_progress', 'workflow_dispatched', 'post_milestone_rework_required', 'failed'],
  post_milestone_in_progress: ['workflow_dispatched', 'post_milestone_rework_required', 'failed'],
  post_milestone_rework_required: ['post_milestone_dispatched', 'failed'],
  workflow_dispatched: ['workflow_in_progress', 'waiting_for_session_dispatch', 'workflow_rework_required', 'failed'],
  workflow_in_progress: ['waiting_for_session_dispatch', 'workflow_rework_required', 'failed'],
  workflow_rework_required: ['workflow_dispatched', 'failed'],
  waiting_for_session_dispatch: ['session_dispatched', 'failed'],
  session_dispatched: [],
  failed: ['requirement_dispatched', 'milestone_dispatched', 'post_milestone_dispatched', 'workflow_dispatched', 'waiting_for_session_dispatch'],
};

const REQUIREMENT_ACTIVE_STATUSES = new Set([
  'requirement_dispatched',
  'requirement_document_in_progress',
  'requirement_ready_for_audit',
  'requirement_auditing',
  'requirement_rework_required',
]);

const MILESTONE_ACTIVE_STATUSES = new Set([
  'milestone_dispatched',
  'milestone_document_in_progress',
  'milestone_ready_for_finalize',
  'milestone_rework_required',
]);

const POST_MILESTONE_ACTIVE_STATUSES = new Set([
  'post_milestone_dispatched',
  'post_milestone_in_progress',
  'post_milestone_rework_required',
]);

const WORKFLOW_ACTIVE_STATUSES = new Set([
  'workflow_dispatched',
  'workflow_in_progress',
  'workflow_rework_required',
]);

const SESSION_DISPATCHER_ID = 'dispatcher';
const DISPATCH_CENTER_ID = 'dispatch-center';
const DISPATCH_BUNDLE_ID_PREFIX = 'db-';
const SUPPORTED_ARTIFACT_TRANSPORTS = new Set([
  'https',
  'oci-distribution@1.1',
  'inline',
]);
const DISPATCH_PROTOCOL_MATRIX = [
  {
    id: 'ring.goal.v1',
    bundle_protocol: 'ring.goal.v1',
    bundle_version: '1',
    description:
      'Native dp-ring execution goal bundle. Carries goal, materials, environment, and callbacks.',
    required_fields: ['goal', 'environment', 'materials'],
    transport_support: ['https', 'oci-distribution@1.1', 'inline'],
    support_level: 'full',
  },
  {
    id: 'a2a.task+artifacts@2025.1',
    bundle_protocol: 'a2a.task+artifacts',
    bundle_version: '2025.1',
    description:
      'A2A-style task plus artifact references. Task maps to goal; artifacts map to materials and context.',
    required_fields: ['task', 'artifacts'],
    transport_support: ['https', 'oci-distribution@1.1', 'inline'],
    support_level: 'full',
  },
  {
    id: 'mcp.resource-set@2025-06-18',
    bundle_protocol: 'mcp.resource-set',
    bundle_version: '2025-06-18',
    description:
      'MCP-style resources and prompts. Resources map to materials/context; prompts map to briefs/context.',
    required_fields: ['goal', 'resources'],
    transport_support: ['https', 'oci-distribution@1.1', 'inline'],
    support_level: 'limited',
  },
];
const DISPATCH_BUNDLE_STATE_MACHINE = {
  bundle_received: ['bundle_normalized', 'validation_failed'],
  bundle_normalized: ['bundle_validated', 'validation_failed'],
  bundle_validated: ['materials_staged', 'material_stage_failed'],
  materials_staged: ['task_planning', 'task_planning_failed'],
  task_planning: ['workflow_resolving', 'task_planning_failed'],
  workflow_resolving: ['ready_queued', 'workflow_resolution_failed'],
  ready_queued: ['session_batched', 'launch_failed'],
  session_batched: ['session_launched', 'launch_failed'],
  session_launched: [],
  validation_failed: [],
  material_stage_failed: [],
  task_planning_failed: [],
  workflow_resolution_failed: [],
  launch_failed: [],
};
const MAX_INLINE_ATTACHMENT_BYTES = 32 * 1024;
const OCI_MANIFEST_ACCEPT = [
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.oci.artifact.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/json',
].join(', ');
const execFileAsync = promisify(execFile);

class DispatchBundleError extends Error {
  constructor(message, {
    code = 'dispatch_bundle_error',
    statusCode = 422,
    details = null,
  } = {}) {
    super(message);
    this.name = 'DispatchBundleError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function mergeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    schema_version: 4,
    message_protocol_version:
      raw.message_protocol_version ?? DEFAULT_CONFIG.message_protocol_version,
    poll_interval_ms: 30_000,
    document_idle_threshold_ms:
      Math.max(
        1,
        Number(raw.document_idle_threshold_ms ?? DEFAULT_CONFIG.document_idle_threshold_ms),
      ) || DEFAULT_CONFIG.document_idle_threshold_ms,
    session_runner: {
      ...DEFAULT_CONFIG.session_runner,
      ...(raw.session_runner ?? {}),
    },
    automation: {
      ...DEFAULT_CONFIG.automation,
      ...(raw.automation ?? {}),
    },
    auditor: {
      ...DEFAULT_CONFIG.auditor,
      ...(raw.auditor ?? {}),
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function protocolDescriptor(bundleProtocol, bundleVersion) {
  return DISPATCH_PROTOCOL_MATRIX.find(
    (item) =>
      item.bundle_protocol === bundleProtocol &&
      item.bundle_version === String(bundleVersion ?? ''),
  ) ?? null;
}

function ensureBundleTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }
  const allowed = DISPATCH_BUNDLE_STATE_MACHINE[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Dispatch bundle transition "${fromStatus}" -> "${toStatus}" is not allowed.`,
    );
  }
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function workflowRunCheckpointContext(ring, workflowRun, activeCheckpoint = null) {
  const checkpointsById = new Map();
  const activeCheckpointId = trimString(activeCheckpoint?.id);
  if (activeCheckpointId && activeCheckpoint) {
    checkpointsById.set(activeCheckpointId, activeCheckpoint);
  }

  const checkpointIds = [...new Set(normalizeStringList(workflowRun?.data?.node_execution?.checkpoint_ids))];
  const missingCheckpointIds = checkpointIds.filter((checkpointId) => !checkpointsById.has(checkpointId));
  const loadedCheckpoints = await Promise.all(
    missingCheckpointIds.map((checkpointId) => ring.read('checkpoint', checkpointId).catch(() => null)),
  );

  for (const checkpoint of loadedCheckpoints) {
    const checkpointId = trimString(checkpoint?.id);
    if (checkpointId) {
      checkpointsById.set(checkpointId, checkpoint);
    }
  }

  return checkpointsById;
}

function workflowRunRecencyValue(run) {
  const parsed = Date.parse(run?.updated_at ?? run?.created_at ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestWorkflowRunsByTemplate(workflowRuns) {
  const latestByTemplate = new Map();
  for (const run of workflowRuns) {
    const workflowTemplateId = trimString(run?.data?.workflow_template_id);
    if (!workflowTemplateId) {
      continue;
    }
    const current = latestByTemplate.get(workflowTemplateId);
    if (!current || workflowRunRecencyValue(run) >= workflowRunRecencyValue(current)) {
      latestByTemplate.set(workflowTemplateId, run);
    }
  }
  return latestByTemplate;
}

function normalizeAcceptanceCriteria(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `ac${index + 1}`,
          description: item.trim(),
          satisfied: false,
        };
      }
      if (item && typeof item === 'object') {
        const description = String(item.description ?? '').trim();
        if (!description) return null;
        return {
          id: String(item.id ?? `ac${index + 1}`),
          description,
          satisfied: Boolean(item.satisfied ?? false),
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeGoalAcceptanceCriteria(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) =>
      typeof item === 'string'
        ? item.trim()
        : String(item?.description ?? '').trim(),
    )
    .filter(Boolean);
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function isRemoteMaterialTransport(transport) {
  return transport === 'https' || transport === 'oci-distribution@1.1';
}

function isValidChecksum(value) {
  return typeof value === 'string' && /^(sha256|sha384|sha512):[a-f0-9]{3,}$/i.test(value.trim());
}

function parseChecksum(value) {
  const [algorithm, digest] = String(value ?? '').trim().toLowerCase().split(':', 2);
  if (!algorithm || !digest) {
    return null;
  }
  return { algorithm, digest };
}

function normalizeRelativeStagingPath(value, fallback) {
  const source = String(value ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = source
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  return parts.length > 0 ? parts.join('/') : fallback;
}

function looksLikeFilePath(value) {
  const normalized = String(value ?? '').replace(/\\/g, '/');
  const lastSegment = normalized.split('/').filter(Boolean).at(-1) ?? '';
  return /\.[a-z0-9]{1,16}$/i.test(lastSegment);
}

function inferMaterialExtension(material, sourceUri = null, contentType = null) {
  const format = String(material.format ?? '').toLowerCase();
  if (format === 'zip') return '.zip';
  if (format === 'json') return '.json';
  if (format === 'markdown' || format === 'md') return '.md';
  if (format === 'text' || format === 'txt') return '.txt';
  if (format === 'yaml' || format === 'yml') return '.yml';
  if (format === 'tar.gz' || format === 'tgz') return '.tgz';
  if (sourceUri) {
    try {
      const parsed = new URL(sourceUri);
      const extension = extname(parsed.pathname);
      if (extension) {
        return extension;
      }
    } catch {
      // ignore uri parsing failures and fall back to content-type/default extension
    }
  }
  if (contentType) {
    const lowered = contentType.toLowerCase();
    if (lowered.includes('zip')) return '.zip';
    if (lowered.includes('json')) return '.json';
    if (lowered.includes('markdown')) return '.md';
    if (lowered.startsWith('text/')) return '.txt';
  }
  return '.bin';
}

function isZipMaterial(material, sourceUri = null, contentType = null) {
  return (
    String(material.format ?? '').toLowerCase() === 'zip' ||
    /\.zip$/i.test(sourceUri ?? '') ||
    /zip/i.test(contentType ?? '')
  );
}

function buildDefaultAgentCards(config) {
  return [
    {
      id: config.writer_agent_id,
      display_name: 'Requirement Writer',
      role: 'writer',
      description: 'Turns a requirement into an auditable requirement document.',
      accepts: ['requirement_to_document'],
      produces: ['requirement_document'],
      capability_tags: ['writing', 'requirements', 'handoff'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.auditor_agent_id,
      display_name: 'Requirement Auditor',
      role: 'auditor',
      description: 'Checks requirement documents for quality and next-step readiness.',
      accepts: ['requirement_document_audit'],
      produces: ['audit_verdict'],
      capability_tags: ['audit', 'quality', 'gate'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.milestone_planner_agent_id,
      display_name: 'Milestone Planner',
      role: 'planner',
      description: 'Converts an approved requirement into milestone planning artifacts.',
      accepts: ['requirement_to_milestones'],
      produces: ['milestone_plan'],
      capability_tags: ['planning', 'milestones', 'decomposition'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.prerequisite_preparer_agent_id,
      display_name: 'Prerequisite Preparer',
      role: 'planner',
      description: 'Splits milestone prerequisites into ready-now and blocked groups.',
      accepts: ['milestones_to_prerequisites'],
      produces: ['prerequisite_analysis'],
      capability_tags: ['readiness', 'prerequisites', 'triage'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.task_dispatcher_agent_id,
      display_name: 'Task Dispatcher',
      role: 'planner',
      description: 'Produces the smallest dispatchable tasks from the current ready state.',
      accepts: ['milestones_to_tasks'],
      produces: ['task_dispatch_plan'],
      capability_tags: ['tasks', 'decomposition', 'scope'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.workflow_designer_agent_id,
      display_name: 'Workflow Architect',
      role: 'planner',
      description: 'Assigns one reusable or custom workflow to each ready task.',
      accepts: ['tasks_to_workflows'],
      produces: ['workflow_assignment'],
      capability_tags: ['workflow', 'reuse', 'templates'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/agent-report',
    },
    {
      id: config.task_judge_agent_id,
      display_name: 'Task Judge',
      role: 'judge',
      description: 'Determines whether a finalized task is successful and merge-ready.',
      accepts: ['task_completion_review'],
      produces: ['task_review_verdict'],
      capability_tags: ['judge', 'merge', 'quality'],
      callback_endpoint: '/api/task/:task_id/judge',
    },
    {
      id: config.task_replanner_agent_id,
      display_name: 'Task Replanner',
      role: 'planner',
      description: 'Decides whether a failed task should be redispatched or terminated.',
      accepts: ['task_replanning'],
      produces: ['task_replan_verdict'],
      capability_tags: ['replanning', 'recovery', 'scope'],
      callback_endpoint: '/api/task/:task_id/replan',
    },
    {
      id: config.distiller_agent_id,
      display_name: 'Distiller',
      role: 'distiller',
      description: 'Turns failures and blocked work into feedback and reusable lessons.',
      accepts: ['blocked_prerequisites', 'task_failure_summary'],
      produces: ['feedback', 'distillation'],
      capability_tags: ['distillation', 'feedback', 'learning'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/interventions',
    },
    {
      id: SESSION_DISPATCHER_ID,
      display_name: 'Batch Dispatcher',
      role: 'dispatcher',
      description: 'Launches every ready waiting task into one session batch.',
      accepts: ['batch_session_launch'],
      produces: ['session_dispatch'],
      capability_tags: ['dispatch', 'session', 'batch'],
      callback_endpoint: '/api/orchestrator/jobs/:job_id/interventions',
    },
  ];
}

function mergeAgentCards(defaultCards, customCards = []) {
  const merged = new Map(defaultCards.map((card) => [card.id, { ...card }]));
  for (const card of customCards) {
    const existing = merged.get(card.id) ?? {};
    merged.set(card.id, {
      ...existing,
      ...card,
      capability_tags: card.capability_tags ?? existing.capability_tags ?? [],
      accepts: card.accepts ?? existing.accepts ?? [],
      produces: card.produces ?? existing.produces ?? [],
    });
  }
  return [...merged.values()];
}

function mapAgentCards(cards) {
  return new Map(cards.map((card) => [card.id, card]));
}

function buildDefaultWorkerCards() {
  return [
    {
      id: 'worker-agent',
      display_name: 'Workflow Worker',
      role: 'workflow-worker',
      description: 'Executes workflow-run packets and reports native dp-ring status updates.',
      status: 'active',
      callback_protocols: ['ring.workflow-run-report.v1'],
      auth_schemes: ['bearer+hmac-sha256'],
      capability_tags: ['workflow-execution', 'git', 'callback'],
    },
    {
      id: 'a2a-worker',
      display_name: 'A2A Workflow Worker',
      role: 'workflow-worker',
      description: 'Executes workflow-run packets and reports A2A-style task status envelopes.',
      status: 'active',
      callback_protocols: ['a2a.task-status.v1', 'ring.workflow-run-report.v1'],
      auth_schemes: ['bearer+hmac-sha256'],
      capability_tags: ['workflow-execution', 'a2a', 'callback'],
    },
  ];
}

function mergeWorkerCards(defaultCards, customCards = []) {
  const merged = new Map(defaultCards.map((card) => [card.id, { ...card }]));
  for (const card of customCards) {
    const existing = merged.get(card.id) ?? {};
    merged.set(card.id, {
      ...existing,
      ...card,
      callback_protocols: card.callback_protocols ?? existing.callback_protocols ?? [],
      auth_schemes: card.auth_schemes ?? existing.auth_schemes ?? [],
      capability_tags: card.capability_tags ?? existing.capability_tags ?? [],
      status: card.status ?? existing.status ?? 'active',
    });
  }
  return [...merged.values()];
}

function computeRequirementComplexity(fields) {
  const acceptanceCount = fields.acceptance_criteria?.length ?? 0;
  const text = `${fields.name ?? ''}\n${fields.description ?? ''}`;
  let score = 1;
  score += Math.min(4, Math.floor(text.trim().length / 180));
  score += Math.min(3, Math.max(0, acceptanceCount - 1));

  if (fields.priority === 'critical') {
    score += 2;
  } else if (fields.priority === 'high') {
    score += 1;
  }

  if (/(integration|cross|multi-agent|workflow|dispatch|session|milestone|orchestr|audit|platform|pipeline)/i.test(text)) {
    score += 2;
  }
  if (/(project|module|file|git|repo|build|cleanup|merge|distill)/i.test(text)) {
    score += 1;
  }

  return Math.min(score, 10);
}

function buildRoutingPolicy(fields) {
  const complexityScore = computeRequirementComplexity(fields);

  if (complexityScore >= 7) {
    return {
      mode: 'deep',
      complexity_score: complexityScore,
      post_milestone_strategy: 'serial',
      workflow_strategy: 'hybrid',
      human_review_level: 'elevated',
      explanation:
        'High-complexity requirement: prerequisites are validated before task planning, and workflow creation can mix reuse with custom design.',
    };
  }

  if (complexityScore >= 4) {
    return {
      mode: 'balanced',
      complexity_score: complexityScore,
      post_milestone_strategy: 'parallel',
      workflow_strategy: 'reuse_first',
      human_review_level: 'standard',
      explanation:
        'Medium-complexity requirement: prerequisite analysis and task planning can proceed in parallel, but workflow reuse stays the default.',
    };
  }

  return {
    mode: 'lean',
    complexity_score: complexityScore,
    post_milestone_strategy: 'parallel',
    workflow_strategy: 'reuse_strict',
    human_review_level: 'standard',
    explanation:
      'Low-complexity requirement: keep orchestration lightweight, parallelize readiness work, and force workflow reuse when a viable template already exists.',
  };
}

function emptyTrace(jobId, createdAt) {
  return {
    trace_id: `trace-${jobId}`,
    active_span_ids: [],
    spans: [
      {
        id: `span-${jobId}-0001`,
        parent_span_id: null,
        stage: 'job_created',
        kind: 'lifecycle',
        agent_id: DISPATCH_CENTER_ID,
        packet_id: null,
        status: 'completed',
        started_at: createdAt,
        completed_at: createdAt,
        note: 'Requirement accepted by the dispatch center.',
      },
    ],
  };
}

function nextSpanId(job) {
  return `span-${job.id}-${String((job.trace?.spans?.length ?? 0) + 1).padStart(4, '0')}`;
}

function nextInterventionId(job) {
  return `int-${job.id}-${String((job.interventions?.length ?? 0) + 1).padStart(4, '0')}`;
}

function openTraceSpan(job, fields) {
  const span = {
    id: nextSpanId(job),
    parent_span_id: fields.parent_span_id ?? null,
    stage: fields.stage,
    kind: fields.kind,
    agent_id: fields.agent_id,
    packet_id: fields.packet_id ?? null,
    status: 'running',
    started_at: nowIso(),
    completed_at: null,
    note: fields.note ?? null,
  };
  job.trace.spans = [...job.trace.spans, span];
  job.trace.active_span_ids = [...job.trace.active_span_ids, span.id];
  return span;
}

function closeTraceSpans(job, predicate, status, note = null) {
  const closedIds = new Set();
  const completedAt = nowIso();
  job.trace.spans = job.trace.spans.map((span) => {
    if (span.status !== 'running' || !predicate(span)) {
      return span;
    }
    closedIds.add(span.id);
    return {
      ...span,
      status,
      completed_at: completedAt,
      note: note ?? span.note ?? null,
    };
  });
  job.trace.active_span_ids = job.trace.active_span_ids.filter((id) => !closedIds.has(id));
}

function closeTraceStage(job, stage, status, note = null) {
  closeTraceSpans(job, (span) => span.stage === stage, status, note);
}

function addIntervention(job, fields) {
  const intervention = {
    id: nextInterventionId(job),
    status: 'open',
    severity: fields.severity,
    source: fields.source,
    stage: fields.stage,
    reason: fields.reason,
    recommendation: fields.recommendation,
    created_at: nowIso(),
    resolved_at: null,
    note: fields.note ?? null,
  };
  job.interventions = [...job.interventions, intervention];
  closeTraceStage(job, fields.stage, 'intervention_required', fields.reason);
  return intervention;
}

function resolveInterventions(job, predicate, note = null, actor = DISPATCH_CENTER_ID) {
  const resolvedAt = nowIso();
  job.interventions = job.interventions.map((intervention) => {
    if (intervention.status !== 'open' || !predicate(intervention)) {
      return intervention;
    }
    return {
      ...intervention,
      status: 'resolved',
      resolved_at: resolvedAt,
      note:
        note ??
        intervention.note ??
        `Resolved by ${actor}.`,
    };
  });
}

function buildMessageEnvelope(job, packet, config, agentCards, artifacts = []) {
  return {
    ...packet,
    protocol_version: config.message_protocol_version,
    trace_id: job.trace.trace_id,
    sender: {
      id: DISPATCH_CENTER_ID,
      role: 'orchestrator',
    },
    recipient_card: agentCards.get(packet.recipient) ?? null,
    callback: {
      kind: 'orchestrator_agent_report',
      method: 'POST',
      path: `/api/orchestrator/jobs/${job.id}/agent-report`,
    },
    artifacts,
    routing: clone(job.routing),
  };
}

function sessionDispatchEnvelopeOptions(job, config, agentCards) {
  return sessionDispatchMessageEnvelopeCallOptions({
    config,
    job,
    senderId: DISPATCH_CENTER_ID,
    senderRole: 'orchestrator',
    recipientCard: agentCards.get(SESSION_DISPATCHER_ID) ?? null,
    recipient: SESSION_DISPATCHER_ID,
  });
}

function sessionDispatchEnvelopeState({
  job,
  requirement,
  storedWaitingTasks = [],
  dispatchWaitingTasks = null,
  refreshedWaitingTasks = null,
  workflowPreparationPayloadWaitingTasks = null,
  config,
  agentCards,
  dispatchedAt = null,
}) {
  return sessionDispatchMessageEnvelopeState({
    job,
    requirement,
    storedWaitingTasks,
    dispatchWaitingTasks,
    refreshedWaitingTasks,
    workflowPreparationPayloadWaitingTasks,
    dispatchedAt,
    ...sessionDispatchEnvelopeOptions(job, config, agentCards),
  });
}

function fallbackRoutingPolicy(job) {
  return buildRoutingPolicy({
    name: job.requirement_name ?? job.id,
    description: '',
    acceptance_criteria: [],
    priority: 'medium',
  });
}

function normalizeJob(job) {
  const followupPath =
    job.followup?.document?.path ??
    join('docs', 'followups', `${job.requirement_id ?? job.id}.md`);
  const trace = job.trace ?? emptyTrace(job.id, job.created_at ?? nowIso());
  return {
    ...job,
    routing: job.routing ?? fallbackRoutingPolicy(job),
    interventions: job.interventions ?? [],
    trace: {
      trace_id: trace.trace_id,
      active_span_ids:
        trace.active_span_ids ??
        (trace.spans ?? [])
          .filter((span) => span.status === 'running')
          .map((span) => span.id),
      spans: trace.spans ?? [],
    },
    followup:
      job.followup ??
      emptyFollowup(
        'distiller',
        followupPath,
      ),
    adaptive_dispatch: job.adaptive_dispatch ?? emptyAdaptiveDispatch(),
    state_machine: job.state_machine ?? clone(JOB_STATE_MACHINE),
  };
}

function ensureTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return;
  }

  const allowed = JOB_STATE_MACHINE[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Orchestrator transition "${fromStatus}" -> "${toStatus}" is not allowed.`,
    );
  }
}

function stageForStatus(status, currentStage = 'requirement_document') {
  if (status === 'session_dispatched') {
    return 'completed';
  }
  if (status === 'waiting_for_session_dispatch') {
    return 'session_dispatch';
  }
  if (status.startsWith('workflow_')) {
    return 'workflow_preparation';
  }
  if (
    status === 'milestones_ready' ||
    status.startsWith('post_milestone_')
  ) {
    return 'post_milestone_orchestration';
  }
  if (status.startsWith('milestone_')) {
    return 'milestone_plan';
  }
  if (status.startsWith('requirement_') || status === 'queued') {
    return 'requirement_document';
  }
  return currentStage;
}

function addHistory(job, fromStatus, toStatus, actor, reason, note = null, stage) {
  const timestamp = nowIso();
  return {
    ...job,
    status: toStatus,
    current_stage: stage,
    updated_at: timestamp,
    history: [
      ...job.history,
      {
        timestamp,
        from: fromStatus,
        to: toStatus,
        actor,
        reason,
        note,
      },
    ],
  };
}

function transitionJob(job, toStatus, actor, reason, note = null, stageOverride) {
  ensureTransition(job.status, toStatus);
  const nextStage = stageOverride ?? stageForStatus(toStatus, job.current_stage);
  if (job.status === toStatus) {
    return {
      ...job,
      current_stage: nextStage,
      updated_at: nowIso(),
    };
  }

  return addHistory(
    job,
    job.status,
    toStatus,
    actor,
    reason,
    note,
    nextStage,
  );
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function buildAudit(documentText, config) {
  const trimmed = documentText.trim();
  const characterCount = trimmed.length;
  const headingCount = countMatches(documentText, /^#\s+.+$/gm);
  const subsectionCount = countMatches(documentText, /^##\s+.+$/gm);
  const bulletCount = countMatches(documentText, /^\s*[-*+]\s+.+$/gm);

  const findings = [
    {
      id: 'char-count',
      passed: characterCount >= config.auditor.min_character_count,
      detail: `Character count ${characterCount}, minimum ${config.auditor.min_character_count}.`,
    },
    {
      id: 'heading',
      passed: !config.auditor.require_heading || headingCount > 0,
      detail: `Top-level headings found: ${headingCount}.`,
    },
    {
      id: 'subsection',
      passed: !config.auditor.require_subsection || subsectionCount > 0,
      detail: `Second-level headings found: ${subsectionCount}.`,
    },
    {
      id: 'list',
      passed: !config.auditor.require_list || bulletCount > 0,
      detail: `Bullet items found: ${bulletCount}.`,
    },
  ];

  const score =
    findings.filter((finding) => finding.passed).length / findings.length;

  return {
    approved: findings.every((finding) => finding.passed),
    findings,
    score,
    metrics: {
      character_count: characterCount,
      heading_count: headingCount,
      subsection_count: subsectionCount,
      bullet_count: bulletCount,
    },
  };
}

function emptyDocumentState(path) {
  return {
    path,
    exists: false,
    initial_signature: null,
    current_signature: null,
    has_observed_progress: false,
    last_modified_at: null,
    last_activity_at: null,
    completion_reason: null,
    completion_reported_at: null,
  };
}

function emptyDispatch(agentId) {
  return {
    agent_id: agentId,
    packet: null,
    reports: [],
    last_dispatched_at: null,
  };
}

function emptyAudit(agentId) {
  return {
    auditor_agent_id: agentId,
    status: 'pending',
    verdict: null,
    score: null,
    findings: [],
    metrics: null,
    requested_at: null,
    completed_at: null,
  };
}

function emptyDistillation(agentId) {
  return {
    distiller_agent_id: agentId,
    status: 'pending',
    distillation_id: null,
    feedback_ids: [],
    completed_at: null,
  };
}

function emptyWorkflowPreparation(agentId, path) {
  return {
    planner_agent_id: agentId,
    status: 'pending',
    document: emptyDocumentState(path),
    dispatch: emptyDispatch(agentId),
    waiting_tasks: [],
    generated_workflow_ids: [],
    reused_workflow_ids: [],
    parse_error: null,
    completed_at: null,
  };
}

function emptySessionDispatch() {
  return {
    dispatcher_id: SESSION_DISPATCHER_ID,
    status: 'pending',
    dispatch: emptyDispatch(SESSION_DISPATCHER_ID),
    waiting_task_ids: [],
    session_id: null,
    workflow_run_ids: [],
    launched_at: null,
  };
}

function emptyWorkflowRunCallback() {
  return {
    auth_scheme: 'bearer',
    report_url: null,
    token: null,
    signing_secret: null,
    signature_algorithm: 'hmac-sha256',
    key_version: 1,
    status: 'pending',
    issued_at: null,
    prepared_at: null,
    last_report_at: null,
    last_retry_at: null,
    last_rotated_at: null,
    next_retry_at: null,
    report_timeout_ms: DEFAULT_CONFIG.session_runner.report_timeout_ms,
    max_retries: DEFAULT_CONFIG.session_runner.max_report_retries,
    retry_count: 0,
    retry_backoff_ms: DEFAULT_CONFIG.session_runner.retry_backoff_ms,
    signature_ttl_ms: DEFAULT_CONFIG.session_runner.signature_ttl_ms,
    timeout_at: null,
    packet_path: null,
    allowed_worker_ids: [],
    accepted_protocols: ['ring.workflow-run-report.v1'],
    last_worker_id: null,
    last_protocol: null,
    last_error: null,
  };
}

function emptyWorkflowRunNodeExecution() {
  return {
    node_id: null,
    branch_id: 'main',
    active_checkpoint_id: null,
    checkpoint_ids: [],
    branch_event_ids: [],
    capsule_state: createEmptyCapsuleState({
      node_id: null,
      runtime_status: 'idle',
      current_checkpoint_id: null,
    }),
  };
}

function emptyFollowup(agentId, path) {
  return {
    distiller_agent_id: agentId,
    status: 'pending',
    document: emptyDocumentState(path),
    dispatch: emptyDispatch(agentId),
    source_intervention_ids: [],
    generated_requirement_id: null,
    generated_job_id: null,
    completed_at: null,
    parse_error: null,
  };
}

function emptyAdaptiveDispatch() {
  return {
    bundle_id: null,
    status: 'pending',
    submitted_at: null,
    last_synced_at: null,
    error: null,
  };
}

function emptyTaskExecution(buildRequired = false, buildCommand = null, cleanupPaths = []) {
  return {
    judge_agent_id: null,
    review_status: 'pending',
    completion_commit_sha: null,
    changed_files: [],
    scope_match: null,
    build_required: buildRequired,
    build_command: buildCommand,
    build_status: buildRequired ? 'pending' : 'skipped',
    cleanup_paths: cleanupPaths,
    cleanup_status: cleanupPaths.length > 0 ? 'pending' : 'skipped',
    merge_status: 'blocked',
    summary_path: null,
    review_packet: null,
    failure_feedback_id: null,
    failure_distillation_id: null,
    completion_distillation_id: null,
    last_error: null,
    checked_at: null,
    reviewed_at: null,
    note: null,
  };
}

function buildFollowupPacket(job, requirement, followupPath, config, selectedInterventions) {
  return {
    id: `pkt-${job.id}-followup`,
    recipient: config.distiller_agent_id,
    kind: 'intervention_to_followup_requirement',
    subject: `Distill follow-up requirement for ${job.requirement_id}`,
    dispatched_at: nowIso(),
    body: [
      `Source requirement ${requirement.id}: ${requirement.data.name}`,
      `Source job: ${job.id}`,
      `Target follow-up brief: ${followupPath}`,
      '',
      'Task:',
      'Distill the unresolved or recently resolved interventions into a new requirement that can re-enter the orchestrator as a clean follow-up loop.',
      '',
      'Interventions:',
      selectedInterventions.length > 0
        ? selectedInterventions
            .map(
              (item) =>
                `- ${item.id} | ${item.stage} | ${item.severity} | ${item.reason} | recommendation: ${item.recommendation}`,
            )
            .join('\n')
        : '- no explicit interventions selected; use the latest job failures and history',
      '',
      'Output contract:',
      '- Start with a title line "# Follow-up Requirement: <name>".',
      '- Add a line "Priority: <critical|high|medium|low>".',
      '- Add "## Context" with why the new loop exists.',
      '- Add "## Requirement Description" with the new requirement body.',
      '- Add "## Acceptance Criteria" with bullet items.',
    ].join('\n'),
    payload: {
      requirement_id: requirement.id,
      requirement_name: requirement.data.name,
      description: requirement.data.description,
      acceptance_criteria: requirement.data.acceptance_criteria,
      document_path: followupPath,
      source_document_path: job.requirement_document.document.path,
    },
  };
}

function buildFollowupScaffold(job, requirement, selectedInterventions) {
  const topInterventions = selectedInterventions.length > 0
    ? selectedInterventions
    : [
        {
          id: 'synthetic',
          stage: job.current_stage,
          severity: 'warning',
          reason: job.runtime.last_error ?? `Follow-up requested for ${job.requirement_name}.`,
          recommendation: 'Create a cleaner next requirement from the current job state.',
        },
      ];

  const title = `${requirement.data.name} Follow-up`;
  const acceptanceCriteria = topInterventions
    .slice(0, 4)
    .map((item, index) => `- Address ${item.stage.replace(/_/g, ' ')} issue ${index + 1}: ${item.reason}`);

  return `# Follow-up Requirement: ${title}

Priority: medium
Created By: ${DISPATCH_CENTER_ID}
Source Job: ${job.id}

## Context

This follow-up requirement was distilled from orchestrator interventions on requirement ${requirement.id}.

${topInterventions
  .map(
    (item) =>
      `- ${item.id} (${item.stage}, ${item.severity}): ${item.reason}${item.recommendation ? ` Recommendation: ${item.recommendation}.` : ''}`,
  )
  .join('\n')}

## Requirement Description

Create a corrected follow-up loop for "${requirement.data.name}" that removes the blocking conditions observed in job ${job.id}. Keep the scope explicit, preserve the useful outputs that already exist, and re-enter the orchestrator with a requirement that can be audited and decomposed cleanly.

## Acceptance Criteria

${acceptanceCriteria.join('\n') || '- Follow-up requirement is explicit and actionable'}
`;
}

function parseFollowupRequirement(documentText) {
  const titleMatch = documentText.match(/^#\s+Follow-up Requirement:\s+(.+)$/im);
  const priorityMatch = documentText.match(/^Priority:\s+(critical|high|medium|low)$/im);
  const description = parseNamedSection(documentText, 'Requirement Description');
  const acceptanceCriteria = parseBulletList(
    parseNamedSection(documentText, 'Acceptance Criteria'),
  ).map((item, index) => ({
    id: `ac${index + 1}`,
    description: item,
    satisfied: false,
  }));

  if (!titleMatch) {
    throw new Error('Follow-up brief must start with "# Follow-up Requirement: <name>".');
  }
  if (!priorityMatch) {
    throw new Error('Follow-up brief must include "Priority: <critical|high|medium|low>".');
  }
  if (!description) {
    throw new Error('Follow-up brief must include a "## Requirement Description" section.');
  }
  if (acceptanceCriteria.length === 0) {
    throw new Error('Follow-up brief needs at least one acceptance criterion.');
  }

  return {
    name: titleMatch[1].trim(),
    priority: priorityMatch[1].toLowerCase(),
    description,
    acceptance_criteria: acceptanceCriteria,
  };
}

function touchRuntime(runtime, config) {
  return {
    ...runtime,
    last_polled_at: nowIso(),
    next_poll_at: new Date(Date.now() + config.poll_interval_ms).toISOString(),
    poll_interval_ms: config.poll_interval_ms,
    idle_threshold_ms: config.document_idle_threshold_ms,
  };
}

function buildWriterPacket(requirement, jobId, documentPath, config) {
  const acceptanceCriteria = requirement.data.acceptance_criteria
    .map((criterion) => `- ${criterion.description}`)
    .join('\n');

  return {
    id: `pkt-${jobId}-requirement`,
    recipient: config.writer_agent_id,
    kind: 'requirement_to_document',
    subject: `Convert requirement ${requirement.id} into a working document`,
    dispatched_at: nowIso(),
    body: [
      `Requirement ${requirement.id}: ${requirement.data.name}`,
      `Target document: ${documentPath}`,
      '',
      'Task:',
      'Write the requirement into a durable document that can be audited and used for the next step.',
      '',
      'Description:',
      requirement.data.description,
      '',
      'Acceptance criteria:',
      acceptanceCriteria || '- none provided',
      '',
      'Completion signals:',
      '- Continue editing while the document is incomplete.',
      '- When finished, report completion back to the orchestrator.',
    ].join('\n'),
    payload: {
      requirement_id: requirement.id,
      requirement_name: requirement.data.name,
      description: requirement.data.description,
      acceptance_criteria: requirement.data.acceptance_criteria,
      document_path: documentPath,
      source_document_path: null,
    },
  };
}

function buildRequirementScaffold(requirement) {
  const criteria = requirement.data.acceptance_criteria
    .map((criterion) => `- ${criterion.description}`)
    .join('\n');

  return `# ${requirement.data.name}

> Generated from requirement ${requirement.id}

## Goal

${requirement.data.description}

## Acceptance Criteria

${criteria || '- TODO'}
`;
}

function buildMilestonePlannerPacket(
  requirement,
  requirementDocumentPath,
  jobId,
  milestoneDocumentPath,
  config,
) {
  return {
    id: `pkt-${jobId}-milestones`,
    recipient: config.milestone_planner_agent_id,
    kind: 'requirement_to_milestones',
    subject: `Plan milestones for requirement ${requirement.id}`,
    dispatched_at: nowIso(),
    body: [
      `Requirement ${requirement.id}: ${requirement.data.name}`,
      `Source document: ${requirementDocumentPath}`,
      `Target milestone plan: ${milestoneDocumentPath}`,
      '',
      'Task:',
      'Convert the approved requirement into a milestone plan that can be turned into milestone artifacts.',
      '',
      'Output contract:',
      '- Use sections named "## Milestone N: <name>".',
      '- Under each milestone add a short description.',
      '- Optionally include "### Acceptance Checks" and bullet items.',
      '- Optionally include "### Prerequisites" and bullet items.',
      '',
      'Completion signals:',
      '- Continue editing while the plan is incomplete.',
      '- When finished, report completion back to the orchestrator.',
    ].join('\n'),
    payload: {
      requirement_id: requirement.id,
      requirement_name: requirement.data.name,
      description: requirement.data.description,
      acceptance_criteria: requirement.data.acceptance_criteria,
      document_path: milestoneDocumentPath,
      source_document_path: requirementDocumentPath,
    },
  };
}

function buildMilestoneScaffold(requirement, requirementDocumentPath) {
  return `# ${requirement.data.name} Milestone Plan

> Requirement ${requirement.id}
> Source requirement document: ${requirementDocumentPath}

## Planning Context

Summarize the approved requirement and the major delivery phases.

## Milestone 1: Discovery

Describe the first milestone in 2-4 sentences.

### Acceptance Checks

- Define the outcome that proves this milestone is done

### Prerequisites

- [human] Optional dependency or approval

## Milestone 2: Delivery

Describe the second milestone in 2-4 sentences.

### Acceptance Checks

- Define the outcome that proves this milestone is done
`;
}

function buildPrerequisitePreparerPacket(
  requirement,
  milestones,
  milestoneDocumentPath,
  jobId,
  prerequisiteDocumentPath,
  taskDispatchDocumentPath,
  config,
) {
  const milestoneLines = milestones.length > 0
    ? milestones
        .map((milestone) => {
          const prereqLines = milestone.data.prerequisites.length > 0
            ? milestone.data.prerequisites
                .map((prerequisite) => `  - [${prerequisite.check_type}] ${prerequisite.description}`)
                .join('\n')
            : '  - none listed';
          return `- ${milestone.id}: ${milestone.data.name}\n${prereqLines}`;
        })
        .join('\n')
    : '- no milestones created';

  return {
    id: `pkt-${jobId}-prerequisites`,
    recipient: config.prerequisite_preparer_agent_id,
    kind: 'milestones_to_prerequisites',
    subject: `Assess prerequisite readiness for requirement ${requirement.id}`,
    dispatched_at: nowIso(),
    body: [
      `Requirement ${requirement.id}: ${requirement.data.name}`,
      `Milestone source document: ${milestoneDocumentPath}`,
      `Target prerequisite analysis: ${prerequisiteDocumentPath}`,
      `Task dispatch plan will read: ${taskDispatchDocumentPath}`,
      '',
      'Task:',
      'Review the current milestones and split each milestone prerequisite into two sets: ready now vs blocked / missing.',
      '',
      'Milestones:',
      milestoneLines,
      '',
      'Output contract:',
      '- Use sections named "## Milestone <milestone-id>: <milestone-name>".',
      '- Under each milestone add "### Ready Now" with bullet items that are already satisfiable.',
      '- Add "### Blocked / Missing" with bullet items that cannot be satisfied yet.',
      '- For blocked items append an optional reason with "| reason: ...".',
      '',
      'Completion signals:',
      '- Continue editing while the analysis is incomplete.',
      '- When finished, report completion back to the orchestrator.',
    ].join('\n'),
    payload: {
      requirement_id: requirement.id,
      requirement_name: requirement.data.name,
      description: requirement.data.description,
      acceptance_criteria: requirement.data.acceptance_criteria,
      document_path: prerequisiteDocumentPath,
      source_document_path: milestoneDocumentPath,
    },
  };
}

function buildPrerequisiteAnalysisScaffold(
  requirement,
  milestones,
  milestoneDocumentPath,
  taskDispatchDocumentPath,
) {
  const milestoneSections = milestones.length > 0
    ? milestones.map((milestone) => {
        const prerequisites = milestone.data.prerequisites.length > 0
          ? milestone.data.prerequisites
              .map((prerequisite) => `- [${prerequisite.check_type}] ${prerequisite.description}`)
              .join('\n')
          : '- none identified yet';

        return `## Milestone ${milestone.id}: ${milestone.data.name}

Current milestone prerequisites:
${prerequisites}

### Ready Now

- [human] Example prerequisite that is already satisfied

### Blocked / Missing

- [human] Example prerequisite that is not ready | reason: explain what is still missing
`;
      }).join('\n')
    : `## Milestone pending

### Ready Now

- none

### Blocked / Missing

- Identify blockers once milestone artifacts exist
`;

  return `# ${requirement.data.name} Prerequisite Analysis

> Requirement ${requirement.id}
> Milestone plan source: ${milestoneDocumentPath}
> Task dispatch target: ${taskDispatchDocumentPath}

## Goal

Split milestone prerequisites into "ready now" and "blocked / missing" so the dispatcher can identify safe early tasks.

${milestoneSections}`;
}

function buildWorkflowPreparationPacket(
  requirement,
  workflowPreparationPayloadWaitingTaskList,
  workflowDocumentPath,
  jobId,
  config,
) {
  const {
    payloadWaitingTasks,
    payloadTaskListText,
  } = workflowPreparationWaitingTaskListRenderView(workflowPreparationPayloadWaitingTaskList);
  const promptRenderView = workflowPreparationPromptRenderView(
    requirement,
    workflowDocumentPath,
  );

  return {
    id: `pkt-${jobId}-workflow-plan`,
    recipient: config.workflow_designer_agent_id,
    kind: 'tasks_to_workflows',
    subject: promptRenderView.packetSubject,
    dispatched_at: nowIso(),
    body: [
      promptRenderView.packetRequirementLine,
      promptRenderView.packetWorkflowPlanLine,
      '',
      'Task:',
      promptRenderView.assignmentGoalText,
      '',
      'Tasks waiting for workflow assignment:',
      payloadTaskListText,
      '',
      promptRenderView.outputContractHeading,
      ...promptRenderView.outputContractLines,
      '',
      promptRenderView.rulesHeading,
      ...promptRenderView.ruleLines,
    ].join('\n'),
    payload: {
      requirement_id: requirement.id,
      requirement_name: requirement.data.name,
      description: requirement.data.description,
      acceptance_criteria: requirement.data.acceptance_criteria,
      document_path: workflowDocumentPath,
      source_document_path: null,
      waiting_tasks: payloadWaitingTasks,
    },
  };
}

function buildWorkflowPreparationScaffold(
  requirement,
  workflowPreparationPayloadWaitingTaskList,
  taskDispatchDocumentPath,
) {
  const {
    scaffoldTaskSectionsText,
  } = workflowPreparationWaitingTaskListRenderView(workflowPreparationPayloadWaitingTaskList);
  const promptRenderView = workflowPreparationPromptRenderView(
    requirement,
    null,
    taskDispatchDocumentPath,
  );

  return `# ${promptRenderView.scaffoldTitle}

${promptRenderView.scaffoldRequirementLine}
${promptRenderView.scaffoldTaskDispatchSourceLine}

## Goal

${promptRenderView.assignmentGoalText}

${scaffoldTaskSectionsText}
`;
}

function parseTaskScopedSections(documentText) {
  const sectionMatches = [
    ...documentText.matchAll(/^##\s+Task\s+([a-z0-9-]+)\s*:\s+(.+)$/gim),
  ];

  return sectionMatches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd =
      index + 1 < sectionMatches.length
        ? sectionMatches[index + 1].index
        : documentText.length;

    return {
      task_id: match[1].trim(),
      task_name: match[2].trim(),
      body: documentText.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function parseCommaList(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBulletList(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => line.replace(/^[-*+]\s+/, '').trim())
    .filter(Boolean);
}

function parseMilestoneScopedSections(documentText) {
  const sectionMatches = [
    ...documentText.matchAll(/^##\s+Milestone\s+([a-z0-9-]+)\s*:\s+(.+)$/gim),
  ];

  return sectionMatches.map((match, index) => {
    const bodyStart = match.index + match[0].length;
    const bodyEnd =
      index + 1 < sectionMatches.length
        ? sectionMatches[index + 1].index
        : documentText.length;

    return {
      milestone_id: match[1].trim(),
      milestone_name: match[2].trim(),
      body: documentText.slice(bodyStart, bodyEnd).trim(),
    };
  });
}

function parsePrerequisiteItem(rawLine, milestone) {
  const [left, right] = rawLine.split(/\|\s*reason\s*:/i);
  const typed = left.trim().match(/^\[(human|reference|automated)\]\s*(.+)$/i);
  const description = (typed?.[2] ?? left).trim();
  const matched =
    milestone?.data.prerequisites.find(
      (prerequisite) => prerequisite.description === description,
    ) ?? null;

  return {
    id: matched?.id ?? null,
    description,
    check_type: typed?.[1]?.toLowerCase() ?? matched?.check_type ?? 'human',
    reason: right?.trim() ?? null,
  };
}

function parsePrerequisiteAnalysis(documentText, milestones) {
  const sections = parseMilestoneScopedSections(documentText);
  if (sections.length === 0) {
    throw new Error(
      'Prerequisite analysis must contain sections like "## Milestone <milestone-id>: Name".',
    );
  }

  return sections.map((section) => {
    const milestone = milestones.find((item) => item.id === section.milestone_id);
    if (!milestone) {
      throw new Error(`Unknown milestone in prerequisite analysis: ${section.milestone_id}.`);
    }

    return {
      milestone_id: milestone.id,
      milestone_name: milestone.data.name,
      ready: parseBulletList(parseNamedSection(section.body, 'Ready Now'))
        .map((item) => parsePrerequisiteItem(item, milestone)),
      blocked: parseBulletList(parseNamedSection(section.body, 'Blocked / Missing'))
        .map((item) => parsePrerequisiteItem(item, milestone)),
    };
  });
}

function parseWorkflowStep(rawLine, index) {
  const line = rawLine.replace(/^[-*+]\s+/, '').trim();
  const parts = line.split('|').map((item) => item.trim());
  if (parts.length < 3) {
    throw new Error(
      `Workflow step ${index + 1} must use "<step-id> | <step-name> | <description> | inputs: ... | outputs: ...".`,
    );
  }

  const [stepId, name, description, ...metaParts] = parts;
  const inputsPart = metaParts.find((item) => /^inputs\s*:/i.test(item));
  const outputsPart = metaParts.find((item) => /^outputs\s*:/i.test(item));

  return {
    id: stepId,
    name,
    description,
    inputs: inputsPart ? parseCommaList(inputsPart.replace(/^inputs\s*:/i, '').trim()) : [],
    outputs: outputsPart ? parseCommaList(outputsPart.replace(/^outputs\s*:/i, '').trim()) : [],
  };
}

function parseWorkflowPreparationPlan(documentText, tasks) {
  const sections = parseTaskScopedSections(documentText);
  if (sections.length === 0) {
    throw new Error(
      'Workflow preparation plan must contain sections like "## Task <task-id>: Name".',
    );
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return sections.map((section) => {
    const task = tasksById.get(section.task_id);
    if (!task) {
      throw new Error(`Workflow plan references unknown task ${section.task_id}.`);
    }

    const actionMatch = section.body.match(/^Workflow Action:\s+(reuse|create)$/im);
    if (!actionMatch) {
      throw new Error(`Task ${section.task_id} is missing "Workflow Action: reuse|create".`);
    }

    const action = actionMatch[1].toLowerCase();
    if (action === 'reuse') {
      const workflowIdMatch = section.body.match(/^Workflow ID:\s+(.+)$/im);
      if (!workflowIdMatch) {
        throw new Error(`Task ${section.task_id} is missing "Workflow ID: ...".`);
      }

      return {
        task_id: task.id,
        task_name: task.data.name,
        action,
        workflow_id: workflowIdMatch[1].trim(),
      };
    }

    const workflowNameMatch = section.body.match(/^Workflow Name:\s+(.+)$/im);
    if (!workflowNameMatch) {
      throw new Error(`Task ${section.task_id} is missing "Workflow Name: ...".`);
    }

    const description = parseNamedSection(section.body, 'Workflow Description');
    if (!description) {
      throw new Error(`Task ${section.task_id} needs a "### Workflow Description" section.`);
    }

    const steps = parseBulletList(parseNamedSection(section.body, 'Steps')).map(
      parseWorkflowStep,
    );
    if (steps.length === 0) {
      throw new Error(`Task ${section.task_id} needs at least one workflow step.`);
    }

    return {
      task_id: task.id,
      task_name: task.data.name,
      action,
      workflow_name: workflowNameMatch[1].trim(),
      workflow_description: description,
      steps,
    };
  });
}

function buildTaskMarkdown(taskId, task, requirement, milestone) {
  return `# ${task.name}

本文档定义任务 **${taskId}**。

> Requirement: ${requirement.id} ${requirement.data.name}
> Milestone: ${milestone.id} ${milestone.data.name}

## Scope

${task.description}

## Target

- Type: ${task.scope.target_type}
- Path: ${task.scope.target_path}
- Git repo: ${task.scope.repo_root}

## File Contract

${task.scope.file_paths.map((path) => `- ${path}`).join('\n')}

## Task Type

${task.task_type}

## Execution Mode

${task.execution_mode}

## Build / Cleanup

- Build required: ${task.execution.build_required ? 'yes' : 'no'}
- Build command: ${task.execution.build_command ?? 'none'}
- Cleanup paths: ${task.execution.cleanup_paths.length > 0 ? task.execution.cleanup_paths.join(', ') : 'none'}

## Acceptance Criteria

${task.acceptance_criteria.map((criterion) => `- ${criterion.description}`).join('\n')}
`;
}

function parseNamedSection(body, heading) {
  const lines = body.split('\n');
  const sectionLines = [];
  let collecting = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === `### ${heading}` || line.trim() === `## ${heading}`) {
      collecting = true;
      continue;
    }
    if (collecting && /^##+\s+/.test(line.trim())) {
      break;
    }
    if (collecting) {
      sectionLines.push(rawLine);
    }
  }

  return sectionLines.join('\n').trim();
}

function buildPrerequisite(item, index) {
  const typed = item.match(/^\[(human|reference|automated)\]\s*(.+)$/i);
  const checkType = typed?.[1]?.toLowerCase() ?? 'human';
  const description = typed?.[2]?.trim() ?? item;

  if (checkType === 'reference') {
    return {
      id: `pr${index + 1}`,
      description,
      check_type: 'reference',
      check: {
        artifact: 'milestone-plan',
        field: 'document',
        equals: description,
      },
      status: 'unknown',
      last_checked: null,
    };
  }

  if (checkType === 'automated') {
    return {
      id: `pr${index + 1}`,
      description,
      check_type: 'automated',
      check: {
        command: description,
        expect_exit_code: 0,
      },
      status: 'unknown',
      last_checked: null,
    };
  }

  return {
    id: `pr${index + 1}`,
    description,
    check_type: 'human',
    check: {
      requires: description,
      approver_role: 'operator',
    },
    status: 'unknown',
    last_checked: null,
  };
}

function parseMilestonePlan(documentText) {
  const sectionMatches = [...documentText.matchAll(/^##\s+Milestone\s+\d+\s*:\s+(.+)$/gm)];
  if (sectionMatches.length === 0) {
    throw new Error(
      'Milestone plan must contain at least one section like "## Milestone 1: Name".',
    );
  }

  const milestones = [];
  for (const [index, match] of sectionMatches.entries()) {
    const title = match[1].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd =
      index + 1 < sectionMatches.length
        ? sectionMatches[index + 1].index
        : documentText.length;
    const body = documentText.slice(bodyStart, bodyEnd).trim();
    const firstSubheading = body.search(/^###\s+/m);
    const description = (firstSubheading >= 0 ? body.slice(0, firstSubheading) : body)
      .trim()
      .replace(/\n{3,}/g, '\n\n');

    if (!description) {
      throw new Error(`Milestone "${title}" is missing a description.`);
    }

    const acceptanceChecks = parseBulletList(
      parseNamedSection(body, 'Acceptance Checks'),
    ).map((descriptionLine, acceptanceIndex) => ({
      id: `ac${acceptanceIndex + 1}`,
      description: descriptionLine,
      checked: false,
    }));

    const prerequisites = parseBulletList(
      parseNamedSection(body, 'Prerequisites'),
    ).map(buildPrerequisite);

    milestones.push({
      name: title,
      description,
      acceptance_checks: acceptanceChecks,
      prerequisites,
    });
  }

  return milestones;
}

function phaseForAgent(job, agentId) {
  if (agentId && agentId === job.post_milestone?.prerequisite_analysis?.dispatch.agent_id) {
    return 'prerequisite_analysis';
  }
  if (agentId && agentId === job.post_milestone?.task_dispatch?.dispatch.agent_id) {
    return 'task_dispatch';
  }
  if (agentId && agentId === job.workflow_preparation?.dispatch?.agent_id) {
    return 'workflow_preparation';
  }
  if (agentId && agentId === job.milestone_plan.dispatch.agent_id) {
    return 'milestone_plan';
  }
  if (agentId && agentId === job.requirement_document.dispatch.agent_id) {
    return 'requirement_document';
  }
  if (job.current_stage === 'workflow_preparation') {
    return 'workflow_preparation';
  }
  if (job.current_stage === 'post_milestone_orchestration') {
    return 'prerequisite_analysis';
  }
  return job.current_stage === 'milestone_plan' ? 'milestone_plan' : 'requirement_document';
}

function isCurrentPhaseStatus(job, phase) {
  if (phase === 'requirement_document') {
    return REQUIREMENT_ACTIVE_STATUSES.has(job.status);
  }
  if (phase === 'milestone_plan') {
    return MILESTONE_ACTIVE_STATUSES.has(job.status);
  }
  if (phase === 'workflow_preparation') {
    return WORKFLOW_ACTIVE_STATUSES.has(job.status);
  }
  if (phase === 'prerequisite_analysis' || phase === 'task_dispatch') {
    return POST_MILESTONE_ACTIVE_STATUSES.has(job.status);
  }
  return MILESTONE_ACTIVE_STATUSES.has(job.status);
}

export async function createOrchestrator(repoRoot, ring) {
  const orchestratorDir = join(repoRoot, '.ring', 'orchestrator');
  const jobsDir = join(orchestratorDir, 'jobs');
  const bundlesDir = join(orchestratorDir, 'bundles');
  const stagingDir = join(orchestratorDir, 'staging');
  const configPath = join(orchestratorDir, 'config.json');
  const agentsPath = join(orchestratorDir, 'agents.json');
  const workersPath = join(orchestratorDir, 'workers.json');
  let timer = null;
  let ticking = false;
  const tickHooks = new Set();

  async function ensureDirs() {
    await mkdir(jobsDir, { recursive: true });
    await mkdir(bundlesDir, { recursive: true });
    await mkdir(stagingDir, { recursive: true });
  }

  async function getConfig() {
    await ensureDirs();

    try {
      const raw = await readFile(configPath, 'utf-8');
      return mergeConfig(JSON.parse(raw));
    } catch {
      const config = mergeConfig();
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      return config;
    }
  }

  async function updateConfig(patch) {
    const existing = await getConfig();
    const next = mergeConfig({
      ...existing,
      ...patch,
      auditor: {
        ...existing.auditor,
        ...(patch?.auditor ?? {}),
      },
      automation: {
        ...existing.automation,
        ...(patch?.automation ?? {}),
      },
    });
    await writeFile(configPath, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    return next;
  }

  async function getAgents(configOverride = null) {
    await ensureDirs();
    const config = configOverride ?? await getConfig();
    const defaults = buildDefaultAgentCards(config);

    try {
      const raw = JSON.parse(await readFile(agentsPath, 'utf-8'));
      const merged = mergeAgentCards(defaults, Array.isArray(raw) ? raw : []);
      await writeFile(agentsPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
      return merged;
    } catch {
      await writeFile(agentsPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8');
      return defaults;
    }
  }

  async function getWorkers() {
    await ensureDirs();
    const defaults = buildDefaultWorkerCards();

    try {
      const raw = JSON.parse(await readFile(workersPath, 'utf-8'));
      const merged = mergeWorkerCards(defaults, Array.isArray(raw) ? raw : []);
      await writeFile(workersPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
      return merged;
    } catch {
      await writeFile(workersPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8');
      return defaults;
    }
  }

  async function readRingArtifact(kind, id) {
    return ring.read(kind, id);
  }

  async function waitingTaskGovernanceViewState(waitingTasks, fallbackWaitingTasks = []) {
    return buildWaitingTaskGovernanceViewState(
      waitingTasks,
      readRingArtifact,
      fallbackWaitingTasks,
    );
  }

  async function sessionDispatchWaitingTaskViews(job, waitingTasks = null) {
    return sessionDispatchPacketWaitingTaskViews(job, waitingTasks, readRingArtifact);
  }

  async function nextJobId() {
    await ensureDirs();
    const files = await readdir(jobsDir).catch(() => []);

    const maxIndex = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => Number(file.replace(/^job-/, '').replace(/\.json$/, '')))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0);

    return `job-${String(maxIndex + 1).padStart(4, '0')}`;
  }

  async function readJob(id) {
    const raw = await readFile(join(jobsDir, `${id}.json`), 'utf-8');
    return normalizeJob(JSON.parse(raw));
  }

  async function listJobs() {
    await ensureDirs();
    const files = await readdir(jobsDir).catch(() => []);

    const jobs = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await readFile(join(jobsDir, file), 'utf-8');
      jobs.push(normalizeJob(JSON.parse(raw)));
    }

    return jobs.sort((left, right) =>
      right.created_at.localeCompare(left.created_at),
    );
  }

  async function writeJob(job, previousStatus = null) {
    if (previousStatus != null) {
      ensureTransition(previousStatus, job.status);
    }

    await ensureDirs();
    await writeFile(
      join(jobsDir, `${job.id}.json`),
      JSON.stringify(job, null, 2) + '\n',
      'utf-8',
    );
    return job;
  }

  async function nextDispatchBundleId() {
    await ensureDirs();
    const files = await readdir(bundlesDir).catch(() => []);
    const maxIndex = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => Number(file.replace(/^db-/, '').replace(/\.json$/, '')))
      .filter((value) => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0);
    return `${DISPATCH_BUNDLE_ID_PREFIX}${String(maxIndex + 1).padStart(4, '0')}`;
  }

  function emptyDispatchBundleRecord(id, envelope, submittedAt = nowIso()) {
    const descriptor = protocolDescriptor(
      envelope.bundle_protocol,
      envelope.bundle_version,
    );
    return {
      id,
      bundle_protocol: envelope.bundle_protocol,
      bundle_version: String(envelope.bundle_version ?? ''),
      artifact_transport: envelope.artifact_transport,
      submitted_by: envelope.submitted_by ?? 'external-client',
      status: 'bundle_received',
      created_at: submittedAt,
      updated_at: submittedAt,
      state_machine: clone(DISPATCH_BUNDLE_STATE_MACHINE),
      envelope: {
        payload: envelope.payload ?? {},
        attachments: Array.isArray(envelope.attachments)
          ? clone(envelope.attachments)
          : [],
      },
      normalization: {
        adapter_id: descriptor?.id ?? null,
        normalized_at: null,
        error: null,
      },
      canonical: null,
      staging: {
        status: 'pending',
        materials: [],
        completed_at: null,
        error: null,
      },
      planning: {
        status: 'pending',
        requirement_id: null,
        milestone_id: null,
        planned_task_ids: [],
        task_document_paths: [],
        completed_at: null,
        error: null,
      },
      workflows: {
        status: 'pending',
        strategy: 'reuse_first',
        waiting_tasks: [],
        generated_workflow_ids: [],
        reused_workflow_ids: [],
        completed_at: null,
        error: null,
      },
      batching: {
        status: 'pending',
        session_group_key: null,
        session_id: null,
        workflow_run_ids: [],
        launched_at: null,
        error: null,
      },
      reports: [],
      errors: [],
      history: [
        {
          timestamp: submittedAt,
          from: null,
          to: 'bundle_received',
          actor: 'dispatch-center',
          reason: 'bundle_submitted',
          note: descriptor?.id ?? `${envelope.bundle_protocol}@${envelope.bundle_version}`,
        },
      ],
    };
  }

  function normalizeDispatchBundle(bundle) {
    return {
      ...bundle,
      state_machine: bundle.state_machine ?? clone(DISPATCH_BUNDLE_STATE_MACHINE),
      envelope: {
        payload: bundle.envelope?.payload ?? {},
        attachments: bundle.envelope?.attachments ?? [],
      },
      normalization: {
        adapter_id: bundle.normalization?.adapter_id ?? null,
        normalized_at: bundle.normalization?.normalized_at ?? null,
        error: bundle.normalization?.error ?? null,
      },
      canonical: bundle.canonical ?? null,
      staging: {
        status: bundle.staging?.status ?? 'pending',
        materials: bundle.staging?.materials ?? [],
        completed_at: bundle.staging?.completed_at ?? null,
        error: bundle.staging?.error ?? null,
      },
      planning: {
        status: bundle.planning?.status ?? 'pending',
        requirement_id: bundle.planning?.requirement_id ?? null,
        milestone_id: bundle.planning?.milestone_id ?? null,
        planned_task_ids: bundle.planning?.planned_task_ids ?? [],
        task_document_paths: bundle.planning?.task_document_paths ?? [],
        completed_at: bundle.planning?.completed_at ?? null,
        error: bundle.planning?.error ?? null,
      },
      workflows: {
        status: bundle.workflows?.status ?? 'pending',
        strategy: bundle.workflows?.strategy ?? 'reuse_first',
        waiting_tasks: bundle.workflows?.waiting_tasks ?? [],
        generated_workflow_ids: bundle.workflows?.generated_workflow_ids ?? [],
        reused_workflow_ids: bundle.workflows?.reused_workflow_ids ?? [],
        completed_at: bundle.workflows?.completed_at ?? null,
        error: bundle.workflows?.error ?? null,
      },
      batching: {
        status: bundle.batching?.status ?? 'pending',
        session_group_key: bundle.batching?.session_group_key ?? null,
        session_id: bundle.batching?.session_id ?? null,
        workflow_run_ids: bundle.batching?.workflow_run_ids ?? [],
        launched_at: bundle.batching?.launched_at ?? null,
        error: bundle.batching?.error ?? null,
      },
      reports: bundle.reports ?? [],
      errors: bundle.errors ?? [],
      history: bundle.history ?? [],
    };
  }

  async function writeDispatchBundle(bundle, previousStatus = null) {
    if (previousStatus != null) {
      ensureBundleTransition(previousStatus, bundle.status);
    }
    await ensureDirs();
    await writeFile(
      join(bundlesDir, `${bundle.id}.json`),
      JSON.stringify(bundle, null, 2) + '\n',
      'utf-8',
    );
    return bundle;
  }

  async function readDispatchBundle(id) {
    const raw = await readFile(join(bundlesDir, `${id}.json`), 'utf-8');
    return normalizeDispatchBundle(JSON.parse(raw));
  }

  async function listDispatchBundles() {
    await ensureDirs();
    const files = await readdir(bundlesDir).catch(() => []);
    const bundles = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const raw = await readFile(join(bundlesDir, file), 'utf-8');
      bundles.push(normalizeDispatchBundle(JSON.parse(raw)));
    }
    return bundles.sort((left, right) =>
      right.created_at.localeCompare(left.created_at),
    );
  }

  async function getDispatchProtocols() {
    return clone(DISPATCH_PROTOCOL_MATRIX);
  }

  function appendDispatchBundleHistory(
    bundle,
    nextStatus,
    actor,
    reason,
    note = null,
  ) {
    const previousStatus = bundle.status;
    bundle.status = nextStatus;
    bundle.updated_at = nowIso();
    bundle.history.push({
      timestamp: bundle.updated_at,
      from: previousStatus,
      to: nextStatus,
      actor,
      reason,
      note,
    });
    return bundle;
  }

  function annotateBundleFailure(
    bundle,
    nextStatus,
    error,
    actor,
    reason,
  ) {
    const message = error instanceof Error ? error.message : String(error);
    bundle.errors.push({
      at: nowIso(),
      code:
        error instanceof DispatchBundleError
          ? error.code
          : 'dispatch_bundle_error',
      message,
      details: error instanceof DispatchBundleError ? error.details : null,
    });
    appendDispatchBundleHistory(bundle, nextStatus, actor, reason, message);
    return bundle;
  }

  function defaultDispatchCallbacks(bundleId, payload = {}) {
    return {
      status_report:
        payload.status_report ?? `/api/dispatch/bundles/${bundleId}/report`,
      intervention:
        payload.intervention ?? '/api/orchestrator/jobs/:job_id/interventions',
    };
  }

  function normalizeMaterial(item, index, transport) {
    const inlineData = item.inline_data ?? item.inlineData ?? null;
    return {
      material_id: String(item.material_id ?? item.id ?? `mat-${index + 1}`),
      kind: String(item.kind ?? 'preparation_package'),
      uri: item.uri != null ? String(item.uri) : null,
      format: String(item.format ?? 'zip'),
      checksum: item.checksum != null ? String(item.checksum) : null,
      size_bytes: toPositiveNumber(item.size_bytes ?? item.sizeBytes),
      mount_to: String(item.mount_to ?? item.mountTo ?? `workspace/materials/${index + 1}`),
      required: item.required !== false,
      inline_data:
        transport === 'inline' && inlineData != null ? String(inlineData) : null,
      metadata: item.metadata ?? null,
    };
  }

  function normalizeTargetScope(raw = {}, repoRootValue = '.') {
    const level = ['project', 'module', 'file'].includes(raw.level)
      ? raw.level
      : ['project', 'module', 'file'].includes(raw.target_type)
      ? raw.target_type
      : 'project';
    const includePaths = normalizeStringList(
      raw.include_paths ?? raw.includePaths ?? raw.paths ?? raw.file_paths ?? [],
    );
    const excludePaths = normalizeStringList(
      raw.exclude_paths ?? raw.excludePaths ?? [],
    );
    return {
      level,
      include_paths: includePaths,
      exclude_paths: excludePaths,
      repo_root: String(raw.repo_root ?? raw.repoRoot ?? repoRootValue),
    };
  }

  function normalizeConstraintSet(raw = {}) {
    return {
      must_build: Boolean(raw.must_build ?? raw.build_required ?? false),
      must_cleanup: Boolean(raw.must_cleanup ?? false),
      build_command:
        raw.build_command != null ? String(raw.build_command) : null,
      cleanup_paths: normalizeStringList(raw.cleanup_paths ?? raw.cleanupPaths ?? []),
      merge_policy: String(raw.merge_policy ?? 'judge_then_merge'),
      priority: String(raw.priority ?? 'medium'),
      workflow_strategy: String(raw.workflow_strategy ?? 'reuse_first'),
      session_group_key:
        raw.session_group_key != null ? String(raw.session_group_key) : null,
    };
  }

  function normalizeDispatchBundleTrace(
    source,
    {
      fallbackTraceId,
      fallbackJobId = null,
      fallbackSourceKind,
    } = {},
  ) {
    const trace = source && typeof source === 'object' ? source : {};
    const normalized = {
      trace_id: String(trace.trace_id ?? fallbackTraceId),
      job_id: trace.job_id ?? fallbackJobId,
      source_kind: String(trace.source_kind ?? fallbackSourceKind),
    };
    if (Object.prototype.hasOwnProperty.call(trace, 'span_id')) {
      normalized.span_id = trimString(trace.span_id) || null;
    }
    if (Object.prototype.hasOwnProperty.call(trace, 'parent_span_id')) {
      normalized.parent_span_id = trimString(trace.parent_span_id) || null;
    }
    return normalized;
  }

  function adaptRingGoalBundle(envelope, bundleId) {
    const payload = envelope.payload ?? {};
    const goal = payload.goal ?? {};
    const environment = payload.environment ?? {};
    const materialsSource =
      Array.isArray(payload.materials) && payload.materials.length > 0
        ? payload.materials
        : envelope.attachments ?? [];

    const title = String(goal.title ?? goal.name ?? '').trim();
    const description = String(goal.description ?? '').trim();
    if (!title || !description) {
      throw new DispatchBundleError(
        'ring.goal.v1 requires goal.title and goal.description.',
        { code: 'invalid_ring_goal_bundle' },
      );
    }

    return {
      schema_version: 'execution.goal.v1',
      goal_bundle_id: bundleId,
      trace: normalizeDispatchBundleTrace(payload.trace, {
        fallbackTraceId: `trace-${bundleId}`,
        fallbackSourceKind: 'external_bundle',
      }),
      producer: {
        producer_id: String(
          payload.producer?.producer_id ??
            envelope.submitted_by ??
            'external-client',
        ),
        producer_type: String(payload.producer?.producer_type ?? 'adapter'),
        source_system: String(payload.producer?.source_system ?? 'external'),
        source_flow: payload.producer?.source_flow ?? null,
      },
      goal: {
        goal_id: String(goal.goal_id ?? goal.id ?? `goal-${bundleId}`),
        title,
        description,
        acceptance_criteria: normalizeGoalAcceptanceCriteria(
          goal.acceptance_criteria,
        ),
      },
      environment: {
        project_id: String(environment.project_id ?? 'default-project'),
        repo_root: String(environment.repo_root ?? repoRoot),
        target_scope: normalizeTargetScope(
          environment.target_scope ?? {},
          environment.repo_root ?? repoRoot,
        ),
        constraints: normalizeConstraintSet(environment.constraints ?? {}),
      },
      materials: materialsSource.map((item, index) =>
        normalizeMaterial(item, index, envelope.artifact_transport),
      ),
      context: {
        artifact_refs: normalizeStringList(
          payload.context?.artifact_refs ?? payload.context?.artifactRefs ?? [],
        ),
        brief_ref:
          payload.context?.brief_ref != null
            ? String(payload.context.brief_ref)
            : null,
        prompts: normalizeStringList(payload.context?.prompts ?? []),
        requirement_id:
          payload.context?.requirement_id != null
            ? String(payload.context.requirement_id)
            : null,
        milestone_id:
          payload.context?.milestone_id != null
            ? String(payload.context.milestone_id)
            : null,
      },
      callbacks: defaultDispatchCallbacks(bundleId, payload.callbacks ?? {}),
      provenance: {
        original_protocol: envelope.bundle_protocol,
        original_version: String(envelope.bundle_version ?? ''),
        artifact_transport: envelope.artifact_transport,
        submitted_by: envelope.submitted_by ?? 'external-client',
        producer_metadata: payload.producer ?? {},
      },
    };
  }

  function adaptA2ABundle(envelope, bundleId) {
    const payload = envelope.payload ?? {};
    const task = payload.task ?? payload.Task ?? null;
    const artifacts = [
      ...(Array.isArray(payload.artifacts) ? payload.artifacts : []),
      ...(Array.isArray(envelope.attachments) ? envelope.attachments : []),
    ];
    if (!task || !Array.isArray(artifacts) || artifacts.length === 0) {
      throw new DispatchBundleError(
        'a2a.task+artifacts requires task and artifacts.',
        { code: 'invalid_a2a_bundle' },
      );
    }

    const materials = [];
    const artifactRefs = [];
    for (const [index, artifact] of artifacts.entries()) {
      const kind = String(
        artifact.kind ?? artifact.type ?? artifact.mime_type ?? 'artifact',
      ).toLowerCase();
      const isMaterial =
        artifact.role === 'material' ||
        /package|bundle|zip|archive|blob/.test(kind);
      if (isMaterial) {
        materials.push(normalizeMaterial(artifact, index, envelope.artifact_transport));
      } else {
        artifactRefs.push(String(artifact.uri ?? artifact.id ?? artifact.name ?? `artifact-${index + 1}`));
      }
    }

    return {
      schema_version: 'execution.goal.v1',
      goal_bundle_id: bundleId,
      trace: normalizeDispatchBundleTrace(payload, {
        fallbackTraceId: `trace-${bundleId}`,
        fallbackSourceKind: 'a2a',
      }),
      producer: {
        producer_id: String(
          payload.agent_card?.id ?? envelope.submitted_by ?? 'a2a-producer',
        ),
        producer_type: 'agent',
        source_system: 'a2a',
        source_flow: payload.agent_card?.role ?? null,
      },
      goal: {
        goal_id: String(task.id ?? `goal-${bundleId}`),
        title: String(task.title ?? task.name ?? '').trim(),
        description: String(task.description ?? task.input ?? '').trim(),
        acceptance_criteria: normalizeGoalAcceptanceCriteria(
          task.acceptance_criteria ?? payload.acceptance_criteria ?? [],
        ),
      },
      environment: {
        project_id: String(task.project_id ?? payload.project_id ?? 'default-project'),
        repo_root: String(task.repo_root ?? payload.repo_root ?? repoRoot),
        target_scope: normalizeTargetScope(
          task.target_scope ?? payload.target_scope ?? {},
          task.repo_root ?? payload.repo_root ?? repoRoot,
        ),
        constraints: normalizeConstraintSet(
          task.constraints ?? payload.constraints ?? {},
        ),
      },
      materials,
      context: {
        artifact_refs: artifactRefs,
        brief_ref:
          payload.brief_ref != null ? String(payload.brief_ref) : null,
        prompts: [],
        requirement_id:
          payload.requirement_id != null ? String(payload.requirement_id) : null,
        milestone_id:
          payload.milestone_id != null ? String(payload.milestone_id) : null,
      },
      callbacks: defaultDispatchCallbacks(bundleId, payload.callbacks ?? {}),
      provenance: {
        original_protocol: envelope.bundle_protocol,
        original_version: String(envelope.bundle_version ?? ''),
        artifact_transport: envelope.artifact_transport,
        submitted_by: envelope.submitted_by ?? 'external-client',
        producer_metadata: payload.agent_card ?? {},
      },
    };
  }

  function adaptMcpResourceSetBundle(envelope, bundleId) {
    const payload = envelope.payload ?? {};
    const goal = payload.goal ?? {};
    const resources = [
      ...(Array.isArray(payload.resources) ? payload.resources : []),
      ...(Array.isArray(envelope.attachments) ? envelope.attachments : []),
    ];
    if (!goal || !Array.isArray(resources) || resources.length === 0) {
      throw new DispatchBundleError(
        'mcp.resource-set requires goal and resources.',
        { code: 'invalid_mcp_resource_set' },
      );
    }

    const materials = [];
    const artifactRefs = [];
    for (const [index, resource] of resources.entries()) {
      const mimeType = String(resource.mimeType ?? resource.mime_type ?? '').toLowerCase();
      const role = String(resource.role ?? resource.metadata?.role ?? '').toLowerCase();
      const isMaterial =
        role === 'material' ||
        /zip|octet-stream|tar|gzip/.test(mimeType) ||
        /\.zip$/i.test(String(resource.uri ?? ''));
      if (isMaterial) {
        materials.push(
          normalizeMaterial(
            {
              ...resource,
              kind: resource.kind ?? 'preparation_package',
              format: resource.format ?? (mimeType.includes('zip') ? 'zip' : 'blob'),
              mount_to:
                resource.mount_to ??
                resource.metadata?.mount_to ??
                `workspace/resources/${index + 1}`,
            },
            index,
            envelope.artifact_transport,
          ),
        );
      } else {
        artifactRefs.push(String(resource.uri ?? resource.name ?? `resource-${index + 1}`));
      }
    }

    return {
      schema_version: 'execution.goal.v1',
      goal_bundle_id: bundleId,
      trace: normalizeDispatchBundleTrace(payload, {
        fallbackTraceId: `trace-${bundleId}`,
        fallbackSourceKind: 'mcp',
      }),
      producer: {
        producer_id: String(envelope.submitted_by ?? 'mcp-client'),
        producer_type: 'adapter',
        source_system: 'mcp',
        source_flow: null,
      },
      goal: {
        goal_id: String(goal.id ?? `goal-${bundleId}`),
        title: String(goal.title ?? goal.name ?? '').trim(),
        description: String(goal.description ?? '').trim(),
        acceptance_criteria: normalizeGoalAcceptanceCriteria(
          goal.acceptance_criteria ?? [],
        ),
      },
      environment: {
        project_id: String(payload.environment?.project_id ?? 'default-project'),
        repo_root: String(payload.environment?.repo_root ?? repoRoot),
        target_scope: normalizeTargetScope(
          payload.environment?.target_scope ?? {},
          payload.environment?.repo_root ?? repoRoot,
        ),
        constraints: normalizeConstraintSet(payload.environment?.constraints ?? {}),
      },
      materials,
      context: {
        artifact_refs: artifactRefs,
        brief_ref:
          payload.prompts?.[0]?.name != null
            ? String(payload.prompts[0].name)
            : null,
        prompts: Array.isArray(payload.prompts)
          ? payload.prompts
              .map((prompt) => String(prompt.content ?? prompt.description ?? prompt.name ?? '').trim())
              .filter(Boolean)
          : [],
        requirement_id:
          payload.context?.requirement_id != null
            ? String(payload.context.requirement_id)
            : null,
        milestone_id:
          payload.context?.milestone_id != null
            ? String(payload.context.milestone_id)
            : null,
      },
      callbacks: defaultDispatchCallbacks(bundleId, payload.callbacks ?? {}),
      provenance: {
        original_protocol: envelope.bundle_protocol,
        original_version: String(envelope.bundle_version ?? ''),
        artifact_transport: envelope.artifact_transport,
        submitted_by: envelope.submitted_by ?? 'external-client',
        producer_metadata: payload.metadata ?? {},
      },
    };
  }

  function normalizeAdaptiveBundleEnvelope(envelope, bundleId) {
    if (!envelope || typeof envelope !== 'object') {
      throw new DispatchBundleError('Dispatch bundle body must be a JSON object.', {
        code: 'invalid_bundle_envelope',
      });
    }
    if (
      typeof envelope.bundle_protocol !== 'string' ||
      typeof envelope.bundle_version !== 'string'
    ) {
      throw new DispatchBundleError(
        'Dispatch bundle must include bundle_protocol and bundle_version.',
        { code: 'invalid_bundle_envelope' },
      );
    }
    if (!SUPPORTED_ARTIFACT_TRANSPORTS.has(envelope.artifact_transport)) {
      throw new DispatchBundleError(
        `Unsupported artifact_transport "${envelope.artifact_transport}".`,
        {
          code: 'unsupported_artifact_transport',
          details: {
            supported_transports: [...SUPPORTED_ARTIFACT_TRANSPORTS],
          },
        },
      );
    }

    const descriptor = protocolDescriptor(
      envelope.bundle_protocol,
      envelope.bundle_version,
    );
    if (!descriptor) {
      throw new DispatchBundleError(
        `Unsupported bundle_protocol "${envelope.bundle_protocol}@${envelope.bundle_version}".`,
        {
          code: 'unsupported_bundle_protocol',
          details: {
            supported_protocols: DISPATCH_PROTOCOL_MATRIX.map((item) => item.id),
          },
        },
      );
    }

    if (descriptor.bundle_protocol === 'ring.goal.v1') {
      return adaptRingGoalBundle(envelope, bundleId);
    }
    if (descriptor.bundle_protocol === 'a2a.task+artifacts') {
      return adaptA2ABundle(envelope, bundleId);
    }
    if (descriptor.bundle_protocol === 'mcp.resource-set') {
      return adaptMcpResourceSetBundle(envelope, bundleId);
    }

    throw new DispatchBundleError(
      `No adapter registered for ${descriptor.id}.`,
      { code: 'missing_bundle_adapter' },
    );
  }

  function validateCanonicalDispatchBundle(bundle, envelope) {
    const goal = bundle.goal ?? {};
    const environment = bundle.environment ?? {};
    const targetScope = environment.target_scope ?? {};
    const constraints = environment.constraints ?? {};
    const materials = Array.isArray(bundle.materials) ? bundle.materials : [];

    if (!goal.title || !goal.description) {
      throw new DispatchBundleError(
        'Canonical bundle requires goal.title and goal.description.',
        { code: 'invalid_canonical_goal' },
      );
    }
    if (!environment.repo_root || !environment.project_id) {
      throw new DispatchBundleError(
        'Canonical bundle requires environment.project_id and environment.repo_root.',
        { code: 'invalid_canonical_environment' },
      );
    }
    if (!['project', 'module', 'file'].includes(targetScope.level)) {
      throw new DispatchBundleError(
        'Canonical bundle target_scope.level must be project, module, or file.',
        { code: 'invalid_target_scope' },
      );
    }
    if (materials.length === 0) {
      throw new DispatchBundleError(
        'Canonical bundle requires at least one material.',
        { code: 'missing_materials' },
      );
    }

    for (const material of materials) {
      if (isRemoteMaterialTransport(envelope.artifact_transport)) {
        if (!material.uri) {
          throw new DispatchBundleError(
            `Material ${material.material_id} requires a uri for transport ${envelope.artifact_transport}.`,
            { code: 'missing_material_uri' },
          );
        }
        if (!isValidChecksum(material.checksum)) {
          throw new DispatchBundleError(
            `Material ${material.material_id} requires a checksum for remote transport.`,
            { code: 'missing_material_checksum' },
          );
        }
      }
      if (envelope.artifact_transport === 'inline') {
        const inlineSize =
          material.size_bytes ??
          (typeof material.inline_data === 'string'
            ? Buffer.byteLength(material.inline_data, 'utf-8')
            : null);
        if (inlineSize != null && inlineSize > MAX_INLINE_ATTACHMENT_BYTES) {
          throw new DispatchBundleError(
            `Inline material ${material.material_id} exceeds ${MAX_INLINE_ATTACHMENT_BYTES} bytes.`,
            { code: 'inline_material_too_large' },
          );
        }
      }
    }

    if (constraints.must_build && !constraints.build_command) {
      throw new DispatchBundleError(
        'environment.constraints.must_build requires build_command.',
        { code: 'missing_build_command' },
      );
    }

    return bundle;
  }

  function repoDisplayPath(absolutePath) {
    const rel = relative(repoRoot, absolutePath);
    return rel.startsWith('..') || isAbsolute(rel) ? absolutePath : rel;
  }

  function resolveStagingPath(rootDir, targetRelative) {
    const absolutePath = resolve(rootDir, targetRelative);
    const rel = relative(rootDir, absolutePath);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new DispatchBundleError(
        `Staging path "${targetRelative}" escapes the bundle staging root.`,
        { code: 'invalid_material_mount_to' },
      );
    }
    return absolutePath;
  }

  function verifyMaterialBuffer(material, buffer) {
    const expected = parseChecksum(material.checksum);
    if (expected) {
      const actualDigest = createHash(expected.algorithm).update(buffer).digest('hex');
      if (actualDigest !== expected.digest) {
        throw new DispatchBundleError(
          `Checksum mismatch for material ${material.material_id}.`,
          {
            code: 'material_checksum_mismatch',
            details: {
              material_id: material.material_id,
              expected: material.checksum,
              actual: `${expected.algorithm}:${actualDigest}`,
            },
          },
        );
      }
    }

    if (
      material.size_bytes != null &&
      Number.isFinite(material.size_bytes) &&
      Number(material.size_bytes) !== buffer.byteLength
    ) {
      throw new DispatchBundleError(
        `Size mismatch for material ${material.material_id}.`,
        {
          code: 'material_size_mismatch',
          details: {
            material_id: material.material_id,
            expected_size_bytes: material.size_bytes,
            actual_size_bytes: buffer.byteLength,
          },
        },
      );
    }

    return {
      checksum_verified: expected != null,
      verified_size_bytes: buffer.byteLength,
    };
  }

  async function fetchBinary(url, headers = {}) {
    let response;
    try {
      response = await fetch(url, {
        headers,
        redirect: 'follow',
      });
    } catch (error) {
      throw new DispatchBundleError(
        `Failed to download remote material from ${url}.`,
        {
          code: 'material_download_failed',
          statusCode: 502,
          details: error instanceof Error ? error.message : String(error),
        },
      );
    }

    if (!response.ok) {
      throw new DispatchBundleError(
        `Remote material download failed with HTTP ${response.status} for ${url}.`,
        {
          code: 'material_download_failed',
          statusCode: 502,
          details: {
            url,
            status: response.status,
            status_text: response.statusText,
          },
        },
      );
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      content_type: response.headers.get('content-type'),
      source_uri: response.url || url,
    };
  }

  function parseOciLocation(uri) {
    if (/^https?:\/\//i.test(uri)) {
      const parsed = new URL(uri);
      const manifestMatch = parsed.pathname.match(/^\/v2\/(.+)\/manifests\/([^/]+)$/);
      if (manifestMatch) {
        return {
          origin: parsed.origin,
          repository: manifestMatch[1],
          manifest_url: parsed.toString(),
          type: 'manifest',
        };
      }

      const blobMatch = parsed.pathname.match(/^\/v2\/(.+)\/blobs\/([^/]+)$/);
      if (blobMatch) {
        return {
          blob_url: parsed.toString(),
          type: 'blob',
        };
      }
    }

    let scheme = 'https';
    let remainder = null;
    if (uri.startsWith('oci://')) {
      remainder = uri.slice('oci://'.length);
    } else if (uri.startsWith('oci+http://')) {
      scheme = 'http';
      remainder = uri.slice('oci+http://'.length);
    } else if (uri.startsWith('oci+https://')) {
      scheme = 'https';
      remainder = uri.slice('oci+https://'.length);
    }

    if (!remainder) {
      throw new DispatchBundleError(
        `Unsupported OCI material uri "${uri}".`,
        { code: 'unsupported_oci_uri' },
      );
    }

    const firstSlash = remainder.indexOf('/');
    if (firstSlash <= 0 || firstSlash === remainder.length - 1) {
      throw new DispatchBundleError(
        `OCI material uri "${uri}" must include registry and repository.`,
        { code: 'unsupported_oci_uri' },
      );
    }

    const registry = remainder.slice(0, firstSlash);
    const repositoryWithRef = remainder.slice(firstSlash + 1);
    const digestIndex = repositoryWithRef.lastIndexOf('@');
    const tagIndex = repositoryWithRef.lastIndexOf(':');
    let repository = repositoryWithRef;
    let reference = 'latest';

    if (digestIndex > -1) {
      repository = repositoryWithRef.slice(0, digestIndex);
      reference = repositoryWithRef.slice(digestIndex + 1);
    } else if (tagIndex > repositoryWithRef.lastIndexOf('/')) {
      repository = repositoryWithRef.slice(0, tagIndex);
      reference = repositoryWithRef.slice(tagIndex + 1);
    }

    const origin = `${scheme}://${registry}`;
    return {
      origin,
      repository,
      manifest_url: `${origin}/v2/${repository}/manifests/${encodeURIComponent(reference)}`,
      type: 'manifest',
    };
  }

  async function fetchOciMaterial(material) {
    const location = parseOciLocation(material.uri);
    if (location.type === 'blob') {
      const blob = await fetchBinary(location.blob_url, {
        Accept: 'application/octet-stream',
      });
      return {
        ...blob,
        manifest_uri: null,
      };
    }

    const manifest = await fetchBinary(location.manifest_url, {
      Accept: OCI_MANIFEST_ACCEPT,
    });

    let parsedManifest;
    try {
      parsedManifest = JSON.parse(manifest.buffer.toString('utf-8'));
    } catch (error) {
      throw new DispatchBundleError(
        `OCI manifest for material ${material.material_id} is not valid JSON.`,
        {
          code: 'invalid_oci_manifest',
          details: error instanceof Error ? error.message : String(error),
        },
      );
    }

    const blobs = Array.isArray(parsedManifest.layers)
      ? parsedManifest.layers
      : Array.isArray(parsedManifest.blobs)
      ? parsedManifest.blobs
      : [];
    if (blobs.length !== 1) {
      throw new DispatchBundleError(
        `OCI material ${material.material_id} must resolve to exactly one layer/blob.`,
        {
          code: 'unsupported_oci_layer_count',
          details: {
            material_id: material.material_id,
            layer_count: blobs.length,
          },
        },
      );
    }

    const blobDescriptor = blobs[0];
    if (!blobDescriptor?.digest) {
      throw new DispatchBundleError(
        `OCI material ${material.material_id} is missing a blob digest.`,
        { code: 'invalid_oci_manifest' },
      );
    }

    const blobUrl = `${location.origin}/v2/${location.repository}/blobs/${encodeURIComponent(blobDescriptor.digest)}`;
    const blob = await fetchBinary(blobUrl, {
      Accept: String(blobDescriptor.mediaType ?? 'application/octet-stream'),
    });

    return {
      ...blob,
      manifest_uri: location.manifest_url,
    };
  }

  async function extractZipArchive(archivePath, targetDir, material) {
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });
    try {
      await execFileAsync('unzip', ['-oq', archivePath, '-d', targetDir], {
        encoding: 'utf-8',
      });
    } catch (error) {
      if (error?.code === 'ENOENT') {
        try {
          await execFileAsync(
            'python3',
            [
              '-c',
              [
                'import sys, zipfile',
                'archive_path, target_dir = sys.argv[1:3]',
                'with zipfile.ZipFile(archive_path) as zf:',
                '    zf.extractall(target_dir)',
              ].join('\n'),
              archivePath,
              targetDir,
            ],
            {
              encoding: 'utf-8',
            },
          );
          return;
        } catch (fallbackError) {
          throw new DispatchBundleError(
            `Failed to extract zip material ${material.material_id}.`,
            {
              code: 'material_extract_failed',
              details: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            },
          );
        }
      }
      throw new DispatchBundleError(
        `Failed to extract zip material ${material.material_id}.`,
        {
          code: 'material_extract_failed',
          details: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  function resolveMaterialOutputPath(bundleDir, material, extension) {
    const mountRelative = normalizeRelativeStagingPath(
      material.mount_to,
      `workspace/materials/${material.material_id}`,
    );
    if (looksLikeFilePath(mountRelative)) {
      return {
        mount_relative: mountRelative,
        output_path: resolveStagingPath(bundleDir, mountRelative),
      };
    }
    const filename = `${material.material_id}${extension}`;
    return {
      mount_relative: mountRelative,
      output_path: resolveStagingPath(bundleDir, join(mountRelative, filename)),
    };
  }

  async function resolveInlineMaterialSource(material) {
    const candidates = [
      material.metadata?.path,
      material.inline_data,
    ].filter((value) => typeof value === 'string' && value.trim().length > 0);

    for (const candidate of candidates) {
      const absolutePath = isAbsolute(candidate) ? candidate : resolve(repoRoot, candidate);
      const info = await stat(absolutePath).catch(() => null);
      if (info?.isFile()) {
        return absolutePath;
      }
    }

    return null;
  }

  async function stageInlineMaterial(bundleDir, material) {
    const sourcePath = await resolveInlineMaterialSource(material);
    if (sourcePath) {
      const buffer = await readFile(sourcePath);
      const verification = verifyMaterialBuffer(material, buffer);
      const extension = inferMaterialExtension(material, sourcePath, null);
      const mountRelative = normalizeRelativeStagingPath(
        material.mount_to,
        `workspace/materials/${material.material_id}`,
      );

      if (isZipMaterial(material, sourcePath, null)) {
        const downloadRelative = normalizeRelativeStagingPath(
          join('_downloads', `${material.material_id}${extension}`),
          `_downloads/${material.material_id}${extension}`,
        );
        const downloadPath = resolveStagingPath(bundleDir, downloadRelative);
        await mkdir(dirname(downloadPath), { recursive: true });
        await copyFile(sourcePath, downloadPath);
        const mountPath = resolveStagingPath(bundleDir, mountRelative);
        await extractZipArchive(downloadPath, mountPath, material);
        return {
          material_id: material.material_id,
          status: 'staged',
          transport: 'inline',
          uri: material.uri,
          resolved_path: repoDisplayPath(mountPath),
          mount_to: material.mount_to,
          checksum: material.checksum,
          download_path: repoDisplayPath(downloadPath),
          extracted_path: repoDisplayPath(mountPath),
          source_path: repoDisplayPath(sourcePath),
          verified_size_bytes: verification.verified_size_bytes,
          checksum_verified: verification.checksum_verified,
        };
      }

      const output = resolveMaterialOutputPath(bundleDir, material, extension);
      await rm(output.output_path, { force: true, recursive: true }).catch(() => {});
      await mkdir(dirname(output.output_path), { recursive: true });
      await copyFile(sourcePath, output.output_path);
      return {
        material_id: material.material_id,
        status: 'staged',
        transport: 'inline',
        uri: material.uri,
        resolved_path: repoDisplayPath(output.output_path),
        mount_to: material.mount_to,
        checksum: material.checksum,
        download_path: null,
        extracted_path: null,
        source_path: repoDisplayPath(sourcePath),
        verified_size_bytes: verification.verified_size_bytes,
        checksum_verified: verification.checksum_verified,
      };
    }

    if (typeof material.inline_data !== 'string') {
      throw new DispatchBundleError(
        `Inline material ${material.material_id} is missing inline_data or a readable source file.`,
        { code: 'missing_inline_material_data' },
      );
    }

    const buffer = Buffer.from(material.inline_data, 'utf-8');
    const verification = verifyMaterialBuffer(material, buffer);
    const output = resolveMaterialOutputPath(
      bundleDir,
      material,
      inferMaterialExtension(material, null, 'text/plain'),
    );
    await rm(output.output_path, { force: true, recursive: true }).catch(() => {});
    await mkdir(dirname(output.output_path), { recursive: true });
    await writeFile(output.output_path, material.inline_data, 'utf-8');
    return {
      material_id: material.material_id,
      status: 'staged',
      transport: 'inline',
      uri: material.uri,
      resolved_path: repoDisplayPath(output.output_path),
      mount_to: material.mount_to,
      checksum: material.checksum,
      download_path: null,
      extracted_path: null,
      source_path: null,
      verified_size_bytes: verification.verified_size_bytes,
      checksum_verified: verification.checksum_verified,
    };
  }

  async function stageRemoteMaterial(bundle, bundleDir, material) {
    const remote =
      bundle.artifact_transport === 'oci-distribution@1.1'
        ? await fetchOciMaterial(material)
        : await fetchBinary(material.uri);
    const verification = verifyMaterialBuffer(material, remote.buffer);
    const extension = inferMaterialExtension(
      material,
      remote.source_uri,
      remote.content_type,
    );
    const downloadRelative = normalizeRelativeStagingPath(
      join('_downloads', `${material.material_id}${extension}`),
      `_downloads/${material.material_id}${extension}`,
    );
    const downloadPath = resolveStagingPath(bundleDir, downloadRelative);
    await mkdir(dirname(downloadPath), { recursive: true });
    await writeFile(downloadPath, remote.buffer);

    if (isZipMaterial(material, remote.source_uri, remote.content_type)) {
      const mountRelative = normalizeRelativeStagingPath(
        material.mount_to,
        `workspace/materials/${material.material_id}`,
      );
      const mountPath = resolveStagingPath(bundleDir, mountRelative);
      await extractZipArchive(downloadPath, mountPath, material);
      return {
        material_id: material.material_id,
        status: 'staged',
        transport: bundle.artifact_transport,
        uri: material.uri,
        resolved_path: repoDisplayPath(mountPath),
        mount_to: material.mount_to,
        checksum: material.checksum,
        download_path: repoDisplayPath(downloadPath),
        extracted_path: repoDisplayPath(mountPath),
        source_path: null,
        verified_size_bytes: verification.verified_size_bytes,
        checksum_verified: verification.checksum_verified,
        manifest_uri: remote.manifest_uri ?? null,
      };
    }

    const output = resolveMaterialOutputPath(bundleDir, material, extension);
    if (output.output_path !== downloadPath) {
      await rm(output.output_path, { force: true, recursive: true }).catch(() => {});
      await mkdir(dirname(output.output_path), { recursive: true });
      await writeFile(output.output_path, remote.buffer);
    }
    return {
      material_id: material.material_id,
      status: 'staged',
      transport: bundle.artifact_transport,
      uri: material.uri,
      resolved_path: repoDisplayPath(output.output_path),
      mount_to: material.mount_to,
      checksum: material.checksum,
      download_path: repoDisplayPath(downloadPath),
      extracted_path: null,
      source_path: null,
      verified_size_bytes: verification.verified_size_bytes,
      checksum_verified: verification.checksum_verified,
      manifest_uri: remote.manifest_uri ?? null,
    };
  }

  async function stageDispatchBundleMaterials(bundle) {
    const bundleStageDir = join(stagingDir, bundle.id);
    await rm(bundleStageDir, { recursive: true, force: true });
    await mkdir(bundleStageDir, { recursive: true });

    const stagedMaterials = [];
    try {
      for (const material of bundle.canonical.materials) {
        if (bundle.artifact_transport === 'inline') {
          stagedMaterials.push(await stageInlineMaterial(bundleStageDir, material));
          continue;
        }

        stagedMaterials.push(await stageRemoteMaterial(bundle, bundleStageDir, material));
      }
      return stagedMaterials;
    } catch (error) {
      await rm(bundleStageDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async function ensureBundleRequirementAndMilestone(bundle) {
    const canonical = bundle.canonical;
    const providedRequirementId = canonical.context?.requirement_id ?? null;
    const providedMilestoneId = canonical.context?.milestone_id ?? null;

    let requirement;
    if (providedRequirementId) {
      requirement = await ring.read('requirement', providedRequirementId).catch(() => null);
    }
    if (!requirement) {
      const requirementId = await ring.newId('requirement', {
        name: canonical.goal.title,
      });
      const result = await ring.create('requirement', {
        id: requirementId,
        status: 'ready',
        created_by: bundle.submitted_by,
        data: {
          name: canonical.goal.title,
          description: canonical.goal.description,
          acceptance_criteria: normalizeAcceptanceCriteria(
            canonical.goal.acceptance_criteria,
          ),
          milestone_ids: [],
          priority: canonical.environment.constraints.priority ?? 'medium',
        },
      });
      if (!result.ok) {
        throw new DispatchBundleError(
          `Requirement creation failed: ${JSON.stringify(result.errors)}`,
          { code: 'bundle_requirement_creation_failed' },
        );
      }
      requirement = result.artifact;
    }

    let milestone;
    if (providedMilestoneId) {
      milestone = await ring.read('milestone', providedMilestoneId).catch(() => null);
    }
    if (!milestone) {
      const milestoneId = await ring.newId('milestone', {
        name: `${canonical.goal.title} Execution`,
        parentId: requirement.id,
      });
      const result = await ring.create('milestone', {
        id: milestoneId,
        status: 'active',
        created_by: bundle.submitted_by,
        data: {
          name: `${canonical.goal.title} Execution`,
          requirement_id: requirement.id,
          description: canonical.goal.description,
          acceptance_checks: normalizeAcceptanceCriteria(
            canonical.goal.acceptance_criteria,
          ).map((criterion) => ({
            id: criterion.id,
            description: criterion.description,
            checked: false,
          })),
          prerequisites: [],
        },
      });
      if (!result.ok) {
        throw new DispatchBundleError(
          `Milestone creation failed: ${JSON.stringify(result.errors)}`,
          { code: 'bundle_milestone_creation_failed' },
        );
      }
      milestone = result.artifact;
      const existingMilestones = requirement.data.milestone_ids ?? [];
      await ring.update('requirement', requirement.id, {
        data: {
          milestone_ids: [...new Set([...existingMilestones, milestoneId])],
        },
      });
      requirement = await ring.read('requirement', requirement.id);
    }

    return { requirement, milestone };
  }

function inferTaskTypeFromGoal(goal) {
  const text = `${goal.title}\n${goal.description}`.toLowerCase();
  if (/test|qa|verify/.test(text)) {
    return 'testing';
  }
    if (/doc|readme|spec|guide/.test(text)) {
      return 'documentation';
    }
    if (/fix|bug|regression/.test(text)) {
      return 'bug-fix';
    }
    if (/refactor|cleanup/.test(text)) {
      return 'refactoring';
    }
  return 'feature-implementation';
}

function inferTaskTypeFromContext(goal, contextText = '') {
  return inferTaskTypeFromGoal({
    title: goal.title,
    description: [goal.description, contextText].filter(Boolean).join('\n'),
  });
}

  function buildBundleTaskPlans(bundle, requirement, milestone) {
    const canonical = bundle.canonical;
    const targetScope = canonical.environment.target_scope;
    const milestoneSpecs = Array.isArray(
      canonical.provenance?.producer_metadata?.milestones,
    )
      ? canonical.provenance.producer_metadata.milestones
      : [];
    const fallbackFilePaths = Array.isArray(
      canonical.provenance?.producer_metadata?.default_file_paths,
    )
      ? canonical.provenance.producer_metadata.default_file_paths.filter(Boolean)
      : [];
    const includePaths =
      milestoneSpecs.length > 0
        ? milestoneSpecs.map((item) => item.id)
        : targetScope.include_paths.length > 0
        ? targetScope.include_paths
        : [targetScope.repo_root];

    return includePaths.map((targetPath, index) => {
      const milestoneSpec = milestoneSpecs[index] ?? milestoneSpecs[0] ?? null;
      const taskName =
        includePaths.length === 1
          ? canonical.goal.title
          : `${canonical.goal.title} · ${milestoneSpec?.name ?? targetPath}`;
      const filePaths =
        targetScope.level === 'project'
          ? fallbackFilePaths.length > 0
            ? fallbackFilePaths
            : includePaths
          : [targetPath];
      return {
        name: taskName,
        description: [
          canonical.goal.description,
          '',
          `Primary target: ${milestoneSpec?.name ?? targetPath}`,
          milestoneSpec?.description
            ? `Milestone context: ${milestoneSpec.description}`
            : null,
          `Goal bundle: ${bundle.id}`,
          canonical.context.artifact_refs.length > 0
            ? `Context refs: ${canonical.context.artifact_refs.join(', ')}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        task_type: inferTaskTypeFromContext(
          canonical.goal,
          `${milestoneSpec?.name ?? ''}\n${milestoneSpec?.description ?? ''}`,
        ),
        execution_mode: 'serial',
        milestone_id: milestoneSpec?.id ?? milestone.id,
        requirement_id: requirement.id,
        scope: {
          target_type: targetScope.level,
          target_path: targetPath,
          repo_root: canonical.environment.repo_root,
          file_paths: filePaths,
        },
        execution: {
          build_required: canonical.environment.constraints.must_build,
          build_command: canonical.environment.constraints.build_command,
          cleanup_paths: canonical.environment.constraints.must_cleanup
            ? canonical.environment.constraints.cleanup_paths
            : [],
        },
        acceptance_criteria: normalizeAcceptanceCriteria(
          canonical.goal.acceptance_criteria.length > 0
            ? canonical.goal.acceptance_criteria
            : [`Deliver ${taskName} successfully.`],
        ),
        planning_index: index,
      };
    });
  }

  function emptyReplanningState() {
    return {
      replanner_agent_id: null,
      status: 'pending',
      source_failure: null,
      packet: null,
      successor_task_id: null,
      parent_task_id: null,
      decision_note: null,
      reviewed_at: null,
    };
  }

  async function materializeBundleTasks(bundle, requirement, milestone) {
    const taskPlans = buildBundleTaskPlans(bundle, requirement, milestone);
    const taskIds = [];
    const taskDocumentPaths = [];
    const tasks = [];

    for (const taskPlan of taskPlans) {
      const taskMilestone =
        taskPlan.milestone_id === milestone.id
          ? milestone
          : await ring.read('milestone', taskPlan.milestone_id).catch(() => milestone);
      const taskId = await ring.newId('task', {
        name: taskPlan.name,
        parentId: taskMilestone.id,
      });
      const taskDocumentPath = join('docs', 'tasks', taskId, `${taskId}.md`);
      await mkdir(join(repoRoot, dirname(taskDocumentPath)), { recursive: true });
      await writeFile(
        join(repoRoot, taskDocumentPath),
        buildTaskMarkdown(taskId, taskPlan, requirement, taskMilestone),
        'utf-8',
      );

      const createResult = await ring.create('task', {
        id: taskId,
        status: 'pending',
        created_by: SESSION_DISPATCHER_ID,
        data: {
          name: taskPlan.name,
          description: taskPlan.description,
          task_type: taskPlan.task_type,
          requirement_id: requirement.id,
          milestone_id: taskMilestone.id,
          workflow_template_id: null,
          workflow_run_id: null,
          execution_mode: taskPlan.execution_mode,
          scope: taskPlan.scope,
          execution: emptyTaskExecution(
            taskPlan.execution.build_required,
            taskPlan.execution.build_command,
            taskPlan.execution.cleanup_paths,
          ),
          replanning: emptyReplanningState(),
          acceptance_criteria: taskPlan.acceptance_criteria,
        },
      });

      if (!createResult.ok) {
        throw new DispatchBundleError(
          `Task creation failed: ${JSON.stringify(createResult.errors)}`,
          { code: 'bundle_task_creation_failed' },
        );
      }
      taskIds.push(taskId);
      taskDocumentPaths.push(taskDocumentPath);
      tasks.push(createResult.artifact);
    }

    return { tasks, taskIds, taskDocumentPaths };
  }

  function defaultGeneratedWorkflow(task) {
    return {
      name: `${task.data.name} Flow`,
      description: `Generated workflow for task ${task.id} from bundle-driven planning.`,
      steps: [
        {
          id: 's1',
          name: 'inspect',
          description: 'Review the task document, materials, and scoped goal.',
          inputs: ['task-document', 'bundle-materials'],
          outputs: ['scoped-plan'],
        },
        {
          id: 's2',
          name: 'execute',
          description: 'Implement the task deliverable inside the scoped file contract.',
          inputs: ['scoped-plan'],
          outputs: ['candidate-output'],
        },
        {
          id: 's3',
          name: 'verify',
          description: 'Validate the output against acceptance criteria and build constraints.',
          inputs: ['candidate-output', 'acceptance-criteria'],
          outputs: ['verification-report'],
        },
      ],
    };
  }

  async function resolveBundleWorkflows(bundle, tasks) {
    const recommendations = await collectWorkflowRecommendations(tasks);
    const activeWorkflows = (await ring.list('workflow')).filter(
      (workflow) => workflow.status === 'active',
    );
    const waitingTasks = [];
    const generatedWorkflowIds = [];
    const reusedWorkflowIds = [];

    for (const task of tasks) {
      const recommendationEntry = recommendations.get(task.id) ?? null;
      const recommendation = recommendationEntry?.recommended ?? null;
      const strategy = bundle.canonical.environment.constraints.workflow_strategy ?? 'reuse_first';
      let workflow = null;
      let workflowSource = 'custom_generated';
      let registryRank = null;
      let registryMode = null;
      let selectionNote = recommendation?.note ?? null;
      let governanceSelectionContext = recommendation?.selection_context ?? null;

      if (recommendation?.workflow && strategy !== 'hybrid') {
        workflow = activeWorkflows.find((item) => item.id === recommendation.workflow.id) ?? recommendation.workflow;
        workflowSource = 'registry_reuse';
        registryRank = recommendation.rank ?? null;
        registryMode = recommendation.mode ?? null;
        reusedWorkflowIds.push(workflow.id);
      }

      if (!workflow) {
        const generated = defaultGeneratedWorkflow(task);
        const workflowId = await ring.newId('workflow', {
          name: generated.name,
        });
        const createResult = await ring.create('workflow', {
          id: workflowId,
          status: 'active',
          created_by: SESSION_DISPATCHER_ID,
          data: {
            name: generated.name,
            description: generated.description,
            applicable_to: [task.data.task_type],
            steps: generated.steps,
          },
        });
        if (!createResult.ok) {
          throw new DispatchBundleError(
            `Workflow creation failed: ${JSON.stringify(createResult.errors)}`,
            { code: 'bundle_workflow_creation_failed' },
          );
        }
        workflow = createResult.artifact;
        generatedWorkflowIds.push(workflow.id);
      }

      await safeTaskPatch(task.id, {
        status: 'ready',
        data: {
          workflow_template_id: workflow.id,
          workflow_run_id: null,
        },
      });

      const governanceBlockedReuse = waitingTaskGovernanceBlockedReuse(
        recommendationEntry,
        workflowSource,
      );

      const waitingTask = buildWaitingTaskRecord({
        task_id: task.id,
        task_name: task.data.name,
        task_type: task.data.task_type,
        milestone_id: task.data.milestone_id,
        task_document_path: join('docs', 'tasks', task.id, `${task.id}.md`),
        task_document_ready: true,
        prerequisites_ready: true,
        workflow_ready: true,
        workflow_template_id: workflow.id,
        workflow_name: workflow.data.name,
        workflow_source: workflowSource,
        registry_rank: registryRank,
        registry_mode: registryMode,
        selection_note: selectionNote,
        governance_selection_context: governanceSelectionContext,
        governance_blocked_reuse: governanceBlockedReuse,
        ready_at: nowIso(),
        dispatched_at: null,
      });
      if (!waitingTask) {
        throw new DispatchBundleError(
          `Waiting-task assembly failed for ${task.id}.`,
          { code: 'bundle_waiting_task_assembly_failed' },
        );
      }
      waitingTasks.push(waitingTask);
    }

    return {
      waitingTasks,
      generatedWorkflowIds,
      reusedWorkflowIds,
    };
  }

  function sessionGroupKeyForBundle(bundle, requirementId) {
    const configured =
      bundle.canonical.environment.constraints.session_group_key ?? null;
    const baseKey = configured
      ? `${requirementId}:${configured}`
      : [
          requirementId,
          bundle.canonical.environment.project_id,
          bundle.canonical.environment.repo_root,
        ].join(':');
    const governanceSignature = governanceBatchSignature(bundle.workflows?.waiting_tasks ?? []);
    return governanceSignature ? `${baseKey}:governance:${governanceSignature}` : baseKey;
  }

  async function submitDispatchBundle(envelope) {
    const bundleId = await nextDispatchBundleId();
    let bundle = emptyDispatchBundleRecord(bundleId, envelope);
    await writeDispatchBundle(bundle);

    try {
      const canonical = normalizeAdaptiveBundleEnvelope(envelope, bundleId);
      bundle.normalization.adapter_id =
        protocolDescriptor(envelope.bundle_protocol, envelope.bundle_version)?.id ??
        null;
      bundle.normalization.normalized_at = nowIso();
      bundle.canonical = canonical;
      appendDispatchBundleHistory(
        bundle,
        'bundle_normalized',
        'dispatch-center',
        'bundle_normalized',
        bundle.normalization.adapter_id,
      );
      await writeDispatchBundle(bundle, 'bundle_received');

      validateCanonicalDispatchBundle(canonical, envelope);
      appendDispatchBundleHistory(
        bundle,
        'bundle_validated',
        'dispatch-center',
        'bundle_validated',
        null,
      );
      await writeDispatchBundle(bundle, 'bundle_normalized');

      bundle.staging.status = 'completed';
      bundle.staging.materials = await stageDispatchBundleMaterials(bundle);
      bundle.staging.completed_at = nowIso();
      appendDispatchBundleHistory(
        bundle,
        'materials_staged',
        'dispatch-center',
        'materials_staged',
        `${bundle.staging.materials.length} materials staged.`,
      );
      await writeDispatchBundle(bundle, 'bundle_validated');

      bundle.planning.status = 'running';
      appendDispatchBundleHistory(
        bundle,
        'task_planning',
        'dispatcher',
        'task_planning_started',
        canonical.goal.title,
      );
      await writeDispatchBundle(bundle, 'materials_staged');

      const { requirement, milestone } = await ensureBundleRequirementAndMilestone(bundle);
      const taskMaterialization = await materializeBundleTasks(
        bundle,
        requirement,
        milestone,
      );
      bundle.planning.status = 'completed';
      bundle.planning.requirement_id = requirement.id;
      bundle.planning.milestone_id = milestone.id;
      bundle.planning.planned_task_ids = taskMaterialization.taskIds;
      bundle.planning.task_document_paths = taskMaterialization.taskDocumentPaths;
      bundle.planning.completed_at = nowIso();

      bundle.workflows.strategy =
        canonical.environment.constraints.workflow_strategy ?? 'reuse_first';
      appendDispatchBundleHistory(
        bundle,
        'workflow_resolving',
        'dispatcher',
        'workflow_resolution_started',
        `${taskMaterialization.taskIds.length} tasks planned.`,
      );
      await writeDispatchBundle(bundle, 'task_planning');

      const workflowResolution = await resolveBundleWorkflows(
        bundle,
        taskMaterialization.tasks,
      );
      bundle.workflows.status = 'completed';
      bundle.workflows.waiting_tasks = workflowResolution.waitingTasks;
      bundle.workflows.generated_workflow_ids =
        workflowResolution.generatedWorkflowIds;
      bundle.workflows.reused_workflow_ids =
        workflowResolution.reusedWorkflowIds;
      bundle.workflows.completed_at = nowIso();
      bundle.batching.status = 'queued';
      bundle.batching.session_group_key = sessionGroupKeyForBundle(
        bundle,
        requirement.id,
      );
      appendDispatchBundleHistory(
        bundle,
        'ready_queued',
        'dispatcher',
        'bundle_ready_for_batch',
        `${workflowResolution.waitingTasks.length} waiting tasks queued.`,
      );
      await writeDispatchBundle(bundle, 'workflow_resolving');

      return bundle;
    } catch (error) {
      bundle.normalization.error ??=
        error instanceof Error ? error.message : String(error);
      if (bundle.status === 'bundle_received') {
        annotateBundleFailure(
          bundle,
          'validation_failed',
          error,
          'dispatch-center',
          'bundle_normalization_failed',
        );
        await writeDispatchBundle(bundle, 'bundle_received');
        throw error;
      }
      if (bundle.status === 'bundle_normalized') {
        annotateBundleFailure(
          bundle,
          'validation_failed',
          error,
          'dispatch-center',
          'bundle_validation_failed',
        );
        await writeDispatchBundle(bundle, 'bundle_normalized');
        throw error;
      }
      if (bundle.status === 'bundle_validated') {
        bundle.staging.status = 'failed';
        bundle.staging.error = error instanceof Error ? error.message : String(error);
        annotateBundleFailure(
          bundle,
          'material_stage_failed',
          error,
          'dispatcher',
          'material_staging_failed',
        );
        await writeDispatchBundle(bundle, 'bundle_validated');
        throw error;
      }
      if (bundle.status === 'materials_staged' || bundle.status === 'task_planning') {
        bundle.planning.status = 'failed';
        bundle.planning.error = error instanceof Error ? error.message : String(error);
        annotateBundleFailure(
          bundle,
          'task_planning_failed',
          error,
          'dispatcher',
          'bundle_task_planning_failed',
        );
        await writeDispatchBundle(
          bundle,
          bundle.status === 'materials_staged' ? 'materials_staged' : 'task_planning',
        );
        throw error;
      }

      bundle.workflows.status = 'failed';
      bundle.workflows.error = error instanceof Error ? error.message : String(error);
      annotateBundleFailure(
        bundle,
        'workflow_resolution_failed',
        error,
        'dispatcher',
        'bundle_workflow_resolution_failed',
      );
      await writeDispatchBundle(bundle, 'workflow_resolving');
      throw error;
    }
  }

  async function reportDispatchBundle(bundleId, body = {}) {
    const bundle = await readDispatchBundle(bundleId);
    const next = clone(bundle);
    next.reports.push({
      at: nowIso(),
      status: body.status ?? 'reported',
      note: body.note ?? null,
      source: body.source ?? next.submitted_by,
    });
    next.updated_at = nowIso();
    await writeDispatchBundle(next);
    return next;
  }

  function buildInternalAdaptiveBundleEnvelope(job, requirement, milestones) {
    const milestoneContext = milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.data.name,
      description: [
        milestone.data.description,
        ...(milestone.data.acceptance_checks ?? []).map(
          (item) => `Acceptance: ${item.description}`,
        ),
        ...(milestone.data.prerequisites ?? []).map(
          (item) => `Prerequisite: ${item.description}`,
        ),
      ]
        .filter(Boolean)
        .join('\n'),
      prerequisites: milestone.data.prerequisites,
    }));
    const blockedCount = milestoneContext.reduce(
      (total, milestone) =>
        total +
        milestone.prerequisites.filter((item) => item.status === 'unsatisfied').length,
      0,
    );

    return {
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: DISPATCH_CENTER_ID,
      payload: {
        trace: {
          trace_id: job.trace.trace_id,
          job_id: job.id,
          source_kind: 'dp_ring_pipeline',
        },
        producer: {
          producer_id: DISPATCH_CENTER_ID,
          producer_type: 'adapter',
          source_system: 'dp-ring',
          source_flow: 'requirements-milestones-prerequisites',
          milestones: milestoneContext,
          default_file_paths: [
            job.requirement_document.document.path,
            job.milestone_plan.document.path,
            job.post_milestone.prerequisite_analysis.document.path,
          ],
        },
        goal: {
          goal_id: requirement.id,
          title: requirement.data.name,
          description: requirement.data.description,
          acceptance_criteria: requirement.data.acceptance_criteria,
        },
        environment: {
          project_id: requirement.id,
          repo_root: repoRoot,
          target_scope: {
            level: 'project',
            include_paths: milestones.map((milestone) => milestone.id),
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
            priority: requirement.data.priority,
            workflow_strategy: job.routing.workflow_strategy,
            session_group_key: `${requirement.id}/internal`,
          },
        },
        materials: [
          {
            material_id: `${job.id}-requirement-doc`,
            kind: 'requirement_document',
            format: 'markdown',
            mount_to: 'workspace/requirements',
            required: true,
            inline_data: join(repoRoot, job.requirement_document.document.path),
            metadata: {
              path: job.requirement_document.document.path,
            },
          },
          {
            material_id: `${job.id}-milestone-plan`,
            kind: 'milestone_plan',
            format: 'markdown',
            mount_to: 'workspace/milestones',
            required: true,
            inline_data: join(repoRoot, job.milestone_plan.document.path),
            metadata: {
              path: job.milestone_plan.document.path,
            },
          },
          {
            material_id: `${job.id}-prerequisite-analysis`,
            kind: 'prerequisite_analysis',
            format: 'markdown',
            mount_to: 'workspace/prerequisites',
            required: true,
            inline_data: join(repoRoot, job.post_milestone.prerequisite_analysis.document.path),
            metadata: {
              path: job.post_milestone.prerequisite_analysis.document.path,
              blocked_count: blockedCount,
            },
          },
        ],
        context: {
          artifact_refs: [
            `artifact://requirement/${requirement.id}`,
            ...milestones.map((milestone) => `artifact://milestone/${milestone.id}`),
          ],
          brief_ref: `artifact://job/${job.id}`,
          prompts: [
            'The prerequisite stage is complete. Plan the next minimal executable tasks without depending on the old task-dispatch document format.',
          ],
          requirement_id: requirement.id,
          milestone_id: milestones[0]?.id ?? null,
        },
        callbacks: {
          intervention: `/api/orchestrator/jobs/${job.id}/interventions`,
        },
      },
      attachments: [],
    };
  }

  async function syncJobFromAdaptiveBundle(jobOrId, bundleOrId) {
    const job =
      typeof jobOrId === 'string' ? await readJob(jobOrId) : normalizeJob(jobOrId);
    const bundle =
      typeof bundleOrId === 'string'
        ? await readDispatchBundle(bundleOrId)
        : normalizeDispatchBundle(bundleOrId);
    const next = clone(job);
    const rawWaitingTasks = Array.isArray(bundle.workflows.waiting_tasks)
      ? bundle.workflows.waiting_tasks
      : [];
    const canonicalWaitingTasks = rawWaitingTasks.length > 0
      ? (await waitingTaskGovernanceViewState(rawWaitingTasks)).waitingTasksForDispatchPacket
      : rawWaitingTasks;
    next.adaptive_dispatch = {
      bundle_id: bundle.id,
      status: bundle.status,
      submitted_at: next.adaptive_dispatch.submitted_at ?? bundle.created_at,
      last_synced_at: nowIso(),
      error: bundle.errors.at(-1)?.message ?? null,
    };
    next.post_milestone.task_dispatch.status =
      ['task_planning', 'bundle_normalized', 'bundle_validated', 'materials_staged'].includes(
        bundle.status,
      )
        ? 'dispatching'
        : ['task_planning_failed', 'validation_failed', 'material_stage_failed'].includes(
            bundle.status,
          )
        ? 'rework_required'
        : bundle.planning.planned_task_ids.length > 0 || bundle.planning.status === 'completed'
        ? 'completed'
        : next.post_milestone.task_dispatch.status;
    next.post_milestone.task_dispatch.generated_task_ids =
      bundle.planning.planned_task_ids ?? [];
    next.post_milestone.task_dispatch.task_document_paths =
      bundle.planning.task_document_paths ?? [];
    next.post_milestone.task_dispatch.completed_at =
      bundle.planning.completed_at ?? next.post_milestone.task_dispatch.completed_at;
    next.post_milestone.task_dispatch.parse_error =
      bundle.planning.error ?? bundle.normalization.error ?? null;

    next.workflow_preparation.status =
      ['workflow_resolving'].includes(bundle.status)
        ? 'planning'
        : ['workflow_resolution_failed'].includes(bundle.status)
        ? 'rework_required'
        : canonicalWaitingTasks.length > 0 || bundle.workflows.status === 'completed'
        ? 'completed'
        : next.workflow_preparation.status;
    next.workflow_preparation.waiting_tasks = canonicalWaitingTasks;
    next.workflow_preparation.generated_workflow_ids =
      bundle.workflows.generated_workflow_ids ?? [];
    next.workflow_preparation.reused_workflow_ids =
      bundle.workflows.reused_workflow_ids ?? [];
    next.workflow_preparation.completed_at =
      bundle.workflows.completed_at ?? next.workflow_preparation.completed_at;
    next.workflow_preparation.parse_error = bundle.workflows.error ?? null;

    next.session_dispatch.waiting_task_ids =
      canonicalWaitingTasks.map((item) => item.task_id);
    next.session_dispatch.session_id = bundle.batching.session_id ?? null;
    next.session_dispatch.workflow_run_ids =
      bundle.batching.workflow_run_ids ?? [];
    next.session_dispatch.launched_at = bundle.batching.launched_at ?? null;
    next.session_dispatch.status =
      bundle.status === 'session_launched'
        ? 'dispatched'
        : ['ready_queued', 'session_batched'].includes(bundle.status)
        ? 'waiting'
        : ['launch_failed'].includes(bundle.status)
        ? 'pending'
        : next.session_dispatch.status;
    if (canonicalWaitingTasks.length > 0) {
      const requirement = await ring.read('requirement', job.requirement_id).catch(() => null);
      if (requirement) {
        const { workflowPreparationPayloadWaitingTasksForDispatchPacket } =
          await sessionDispatchWaitingTaskViews(
            job,
            null,
          );
        const config = await getConfig();
        const agentCards = mapAgentCards(await getAgents(config));
        const dispatchedAt = nowIso();
        const {
          packet: sessionDispatchPacket,
          waitingTasks: refreshedWaitingTasks,
        } = sessionDispatchEnvelopeState({
          job,
          requirement,
          storedWaitingTasks: canonicalWaitingTasks,
          workflowPreparationPayloadWaitingTasks: workflowPreparationPayloadWaitingTasksForDispatchPacket,
          config,
          agentCards,
          dispatchedAt,
        });
        next.session_dispatch.dispatch.packet = sessionDispatchPacket;
        next.workflow_preparation.waiting_tasks = refreshedWaitingTasks;
      }
    }

    let transitioned = false;
    async function commitTransition(targetStatus, actor, reason, note, stage) {
      const fromStatus = next.status;
      if (fromStatus === targetStatus) {
        return;
      }
      Object.assign(
        next,
        transitionJob(next, targetStatus, actor, reason, note, stage),
      );
      await writeJob(next, fromStatus);
      transitioned = true;
    }

    if (['ready_queued', 'session_batched'].includes(bundle.status)) {
      if (next.status === 'failed' && next.current_stage === 'session_dispatch') {
        await commitTransition(
          'waiting_for_session_dispatch',
          SESSION_DISPATCHER_ID,
          'adaptive_waiting_area_resynced',
          `Adaptive bundle ${bundle.id} still has ${bundle.workflows.waiting_tasks.length} tasks queued for session dispatch.`,
          'session_dispatch',
        );
      }
      if (next.status === 'post_milestone_dispatched') {
        await commitTransition(
          'post_milestone_in_progress',
          DISPATCH_CENTER_ID,
          'adaptive_bundle_progressed',
          'Adaptive dispatcher accepted the internal bundle.',
          'post_milestone_orchestration',
        );
      }
      if (next.status === 'post_milestone_in_progress') {
        await commitTransition(
          'workflow_dispatched',
          DISPATCH_CENTER_ID,
          'adaptive_bundle_queued',
          `Adaptive bundle ${bundle.id} planned ${bundle.planning.planned_task_ids.length} tasks.`,
          'workflow_preparation',
        );
      }
      if (next.status === 'workflow_dispatched') {
        await commitTransition(
          'waiting_for_session_dispatch',
          SESSION_DISPATCHER_ID,
          'adaptive_waiting_area_ready',
          `${bundle.workflows.waiting_tasks.length} tasks are queued via adaptive dispatcher.`,
          'session_dispatch',
        );
      }
    } else if (bundle.status === 'session_launched') {
      if (next.status === 'failed' && next.current_stage === 'session_dispatch') {
        await commitTransition(
          'waiting_for_session_dispatch',
          SESSION_DISPATCHER_ID,
          'adaptive_session_launch_resynced',
          `Adaptive bundle ${bundle.id} already launched session ${bundle.batching.session_id}.`,
          'session_dispatch',
        );
      }
      if (
        ['post_milestone_dispatched', 'post_milestone_in_progress'].includes(next.status)
      ) {
        if (next.status === 'post_milestone_dispatched') {
          await commitTransition(
            'post_milestone_in_progress',
            DISPATCH_CENTER_ID,
            'adaptive_bundle_progressed',
            'Adaptive dispatcher accepted the internal bundle.',
            'post_milestone_orchestration',
          );
        }
        await commitTransition(
          'workflow_dispatched',
          DISPATCH_CENTER_ID,
          'adaptive_bundle_queued',
          `Adaptive bundle ${bundle.id} is ready for dispatch.`,
          'workflow_preparation',
        );
      }
      if (next.status === 'workflow_dispatched') {
        await commitTransition(
          'waiting_for_session_dispatch',
          SESSION_DISPATCHER_ID,
          'adaptive_waiting_area_ready',
          `${bundle.workflows.waiting_tasks.length} tasks are queued via adaptive dispatcher.`,
          'session_dispatch',
        );
      }
      if (next.status === 'waiting_for_session_dispatch') {
        await commitTransition(
          'session_dispatched',
          SESSION_DISPATCHER_ID,
          'adaptive_session_launched',
          `Adaptive bundle launched session ${bundle.batching.session_id}.`,
          'completed',
        );
      }
    } else if (
      [
        'validation_failed',
        'material_stage_failed',
        'task_planning_failed',
        'workflow_resolution_failed',
        'launch_failed',
      ].includes(bundle.status) &&
      next.status !== 'failed'
    ) {
      addIntervention(next, {
        stage:
          bundle.status === 'launch_failed'
            ? 'session_dispatch'
            : bundle.status === 'workflow_resolution_failed'
            ? 'workflow_preparation'
            : 'post_milestone_orchestration',
        severity: 'critical',
        source: DISPATCH_CENTER_ID,
        reason: `Adaptive dispatcher bundle ${bundle.id} failed.`,
        recommendation:
          'Inspect the adaptive bundle error and retry after correcting upstream preparation or bundle mapping.',
        note: bundle.errors.at(-1)?.message ?? next.adaptive_dispatch.error,
      });
      await commitTransition(
        'failed',
        DISPATCH_CENTER_ID,
        'adaptive_bundle_failed',
        bundle.errors.at(-1)?.message ?? null,
        stageForStatus(next.status, next.current_stage),
      );
      next.runtime.last_error = bundle.errors.at(-1)?.message ?? next.runtime.last_error;
    }

    if (!transitioned) {
      await writeJob(next);
    }
    return next;
  }

  async function submitInternalAdaptiveBundle(job) {
    try {
      const requirement = await ring.read('requirement', job.requirement_id);
      const milestones = await loadGeneratedMilestones(job);
      const envelope = buildInternalAdaptiveBundleEnvelope(job, requirement, milestones);
      const bundle = await submitDispatchBundle(envelope);
      return syncJobFromAdaptiveBundle(job, bundle);
    } catch (error) {
      const next = clone(job);
      next.current_stage = 'post_milestone_orchestration';
      next.adaptive_dispatch = {
        ...(next.adaptive_dispatch ?? emptyAdaptiveDispatch()),
        status: 'failed',
        last_synced_at: nowIso(),
        error: error instanceof Error ? error.message : String(error),
      };
      addIntervention(next, {
        stage: 'post_milestone_orchestration',
        severity: 'critical',
        source: DISPATCH_CENTER_ID,
        reason: 'Adaptive dispatcher submission failed.',
        recommendation:
          'Inspect the generated bundle and fix the normalization or validation failure before retrying.',
        note: next.adaptive_dispatch.error,
      });
      const failed = transitionJob(
        next,
        'failed',
        DISPATCH_CENTER_ID,
        'adaptive_bundle_submission_failed',
        next.adaptive_dispatch.error,
        'post_milestone_orchestration',
      );
      await writeJob(failed, job.status);
      return failed;
    }
  }

  async function inspectDocument(relativePath) {
    const absolutePath = join(repoRoot, relativePath);

    try {
      const fileStat = await stat(absolutePath);
      return {
        exists: true,
        path: relativePath,
        signature: `${fileStat.size}:${fileStat.mtimeMs}`,
        size: fileStat.size,
        modified_at: new Date(fileStat.mtimeMs).toISOString(),
      };
    } catch {
      return {
        exists: false,
        path: relativePath,
        signature: null,
        size: 0,
        modified_at: null,
      };
    }
  }

  async function ensureDocument(relativePath, contentFactory) {
    const absolutePath = join(repoRoot, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });

    try {
      await stat(absolutePath);
    } catch {
      await writeFile(absolutePath, await contentFactory(), 'utf-8');
    }

    return inspectDocument(relativePath);
  }

  async function safeRequirementPatch(requirementId, patch) {
    const result = await ring.update('requirement', requirementId, patch);
    if (!result.ok) {
      throw new Error(
        `Failed to update requirement ${requirementId}: ${JSON.stringify(result.errors)}`,
      );
    }
    return result.artifact;
  }

  async function safeRequirementStatus(requirementId, nextStatus) {
    const requirement = await ring.read('requirement', requirementId);
    if (requirement.status === nextStatus) {
      return requirement;
    }
    return safeRequirementPatch(requirementId, { status: nextStatus });
  }

  async function safeMilestonePrerequisites(milestoneId, prerequisites) {
    const result = await ring.update('milestone', milestoneId, {
      data: { prerequisites },
    });
    if (!result.ok) {
      throw new Error(
        `Failed to update milestone ${milestoneId}: ${JSON.stringify(result.errors)}`,
      );
    }
    return result.artifact;
  }

  async function safeMilestoneStatus(milestoneId, nextStatus) {
    const milestone = await ring.read('milestone', milestoneId);
    if (milestone.status === nextStatus) {
      return milestone;
    }
    const result = await ring.update('milestone', milestoneId, {
      status: nextStatus,
    });
    if (!result.ok) {
      throw new Error(
        `Failed to update milestone ${milestoneId}: ${JSON.stringify(result.errors)}`,
      );
    }
    return result.artifact;
  }

  async function safeTaskPatch(taskId, patch) {
    const result = await ring.update('task', taskId, patch);
    if (!result.ok) {
      throw new Error(
        `Failed to update task ${taskId}: ${JSON.stringify(result.errors)}`,
      );
    }
    return result.artifact;
  }

  async function loadGeneratedMilestones(job) {
    return Promise.all(
      (job.milestone_plan.generated_milestone_ids ?? []).map((id) =>
        ring.read('milestone', id),
      ),
    );
  }

  async function loadGeneratedTasks(job) {
    return Promise.all(
      (job.post_milestone.task_dispatch.generated_task_ids ?? []).map((id) =>
        ring.read('task', id),
      ),
    );
  }

  async function emitDistillationFeedback(job, blockedGroups, requirement, config) {
    if (blockedGroups.length === 0) {
      return {
        ...job.post_milestone.prerequisite_analysis.distillation,
        status: 'completed',
        completed_at: nowIso(),
      };
    }

    const distillationId = await ring.newId('distillation', {
      name: `${job.requirement_name} blocked prerequisites`,
    });

    const feedbackIds = [];
    const artifacts = [];

    for (const group of blockedGroups) {
      for (const item of group.blocked) {
        artifacts.push({
          kind: 'anti-pattern',
          summary: `Blocked prerequisite for ${group.milestone_name}: ${item.description}`,
          context: `requirement:${requirement.id} milestone:${group.milestone_id}`,
          applicable_when: `The requirement ${requirement.id} milestone ${group.milestone_id} cannot proceed because "${item.description}" is still missing.`,
          confidence: 0.78,
          source_sessions: [job.id],
        });

        const feedbackId = await ring.newId('feedback', {
          name: `${group.milestone_name} prerequisite ${item.description}`,
        });
        const feedbackResult = await ring.create('feedback', {
          id: feedbackId,
          status: 'open',
          created_by: config.distiller_agent_id,
          data: {
            source_session_id: job.id,
            severity: 'major',
            category: 'requirement_gap',
            target: {
              type: 'milestone',
              id: group.milestone_id,
              field: 'data.prerequisites',
            },
            description: `[requirement:${requirement.id}] [milestone:${group.milestone_id}] Blocked prerequisite: ${item.description}${item.reason ? ` (${item.reason})` : ''}`,
            proposed_action: 'Resolve the blocked prerequisite before scheduling work that depends on it.',
            resolution_session_id: null,
          },
        });
        if (!feedbackResult.ok) {
          throw new Error(
            `Feedback creation failed: ${JSON.stringify(feedbackResult.errors)}`,
          );
        }
        feedbackIds.push(feedbackId);
      }
    }

    const distillationResult = await ring.create('distillation', {
      id: distillationId,
      status: 'published',
      created_by: config.distiller_agent_id,
      session_id: job.id,
      data: {
        source_session_id: job.id,
        artifacts,
      },
    });

    if (!distillationResult.ok) {
      throw new Error(
        `Distillation creation failed: ${JSON.stringify(distillationResult.errors)}`,
      );
    }

    return {
      distiller_agent_id: config.distiller_agent_id,
      status: 'completed',
      distillation_id: distillationId,
      feedback_ids: feedbackIds,
      completed_at: nowIso(),
    };
  }

  async function collectWorkflowRecommendations(tasks) {
    const activeWorkflows = (await ring.list('workflow')).filter(
      (workflow) => workflow.status === 'active',
    );
    const latestWorkflowRuns = latestWorkflowRunsByTemplate(await ring.list('workflow-run'));
    const governanceBlocksByTemplate = new Map();
    const automaticReusePolicyByTemplate = new Map();
    const effectiveForceByTemplate = new Map();
    const recommendations = new Map();

    for (const workflow of activeWorkflows) {
      const latestRun = latestWorkflowRuns.get(workflow.id) ?? null;
      const activeCheckpointId = trimString(latestRun?.data?.node_execution?.active_checkpoint_id);
      const activeCheckpoint = activeCheckpointId
        ? await ring.read('checkpoint', activeCheckpointId).catch(() => null)
        : null;
      const governanceBlock = workflowReuseGovernanceBlock(latestRun, activeCheckpoint);
      const automaticReusePolicy = checkpointAutomaticReusePolicy(activeCheckpoint);
      governanceBlocksByTemplate.set(workflow.id, governanceBlock);
      automaticReusePolicyByTemplate.set(workflow.id, automaticReusePolicy);
      if (latestRun && activeCheckpoint && automaticReusePolicy.constrained && !governanceBlock) {
        const checkpointContext = await workflowRunCheckpointContext(ring, latestRun, activeCheckpoint);
        effectiveForceByTemplate.set(
          workflow.id,
          checkpointEffectiveForceState(activeCheckpoint, checkpointContext).effectiveForceScore,
        );
      } else {
        effectiveForceByTemplate.set(workflow.id, 0);
      }
    }

    for (const task of tasks) {
      const candidates = activeWorkflows.filter((workflow) =>
        workflow.data.applicable_to.includes(task.data.task_type),
      );
      const governanceBlockedCandidates = candidates
        .map((workflow) => ({
          workflow,
          block: governanceBlocksByTemplate.get(workflow.id) ?? null,
        }))
        .filter(({ block }) => block);
      const reusableCandidates = candidates.filter(
        (workflow) => !(governanceBlocksByTemplate.get(workflow.id) ?? null),
      );

      let registryPick = null;
      let registryRankings = [];
      try {
        registryRankings = await ring.registry.rank(task.data.task_type);
        registryPick = await ring.registry.select(task.data.task_type);
      } catch {
        registryPick = null;
      }

      const registryRanksByWorkflowId = new Map(
        registryRankings.map((entry, index) => [entry.workflow_id, index + 1]),
      );
      const rankedWorkflow = registryPick?.workflow_id
        ? reusableCandidates.find((workflow) => workflow.id === registryPick.workflow_id) ?? null
        : null;
      const defaultWorkflow = rankedWorkflow ?? reusableCandidates[0] ?? null;
      let recommendedWorkflow = defaultWorkflow;
      let recommendedRank = rankedWorkflow
        ? registryPick?.rank ?? registryRanksByWorkflowId.get(rankedWorkflow.id) ?? null
        : defaultWorkflow
          ? registryRanksByWorkflowId.get(defaultWorkflow.id) ?? null
          : null;
      let recommendedMode = rankedWorkflow ? registryPick?.mode ?? null : null;
      let recommendedNote = null;
      let recommendedSelectionContext = null;

      if (defaultWorkflow) {
        const governedSelection = governedAutomaticReuseSelectionState({
          defaultWorkflow,
          defaultRank: recommendedRank,
          reusableCandidates,
          automaticReusePolicyByTemplate,
          effectiveForceByTemplate,
          registryRanksByWorkflowId,
        });
        recommendedWorkflow = governedSelection.recommendedWorkflow;
        recommendedRank = governedSelection.recommendedRank;
        if (governedSelection.recommendedMode !== null) {
          recommendedMode = governedSelection.recommendedMode;
        }
        if (governedSelection.recommendedNote !== null) {
          recommendedNote = governedSelection.recommendedNote;
        }
        if (governedSelection.recommendedSelectionContext !== null) {
          recommendedSelectionContext = governedSelection.recommendedSelectionContext;
        }
      }

      recommendations.set(task.id, {
        recommended: recommendedWorkflow
          ? {
              workflow: recommendedWorkflow,
              rank: recommendedRank,
              mode: recommendedMode,
              note: recommendedNote,
              selection_context: recommendedSelectionContext,
            }
          : null,
        candidates: reusableCandidates.map((workflow) => ({
          id: workflow.id,
          name: workflow.data.name,
        })),
        governance_blocked_candidates: governanceBlockedCandidates.map(({ workflow, block }) => ({
          id: workflow.id,
          name: workflow.data.name,
          reason: block.reason,
          checkpoint_id: block.checkpoint_id,
          adoption_status: block.adoption_status,
          branch_budget: block.branch_budget ?? null,
          workflow_tightness: block.workflow_tightness ?? null,
          oversight_strength: block.oversight_strength ?? null,
        })),
      });
    }

    return recommendations;
  }

  async function dispatchWorkflowPreparation(job, note = null) {
    const config = await getConfig();
    const agentCards = mapAgentCards(await getAgents(config));
    const requirement = await ring.read('requirement', job.requirement_id);
    const tasks = await loadGeneratedTasks(job);
    const recommendations = await collectWorkflowRecommendations(tasks);
    const workflowPreparationPayloadWaitingTaskList = workflowPreparationPayloadWaitingTaskListState(
      tasks,
      recommendations,
    );
    const inspection = await ensureDocument(
      job.workflow_preparation.document.path,
      () =>
        Promise.resolve(
          buildWorkflowPreparationScaffold(
            requirement,
            workflowPreparationPayloadWaitingTaskList,
            job.post_milestone.task_dispatch.document.path,
          ),
        ),
    );
    const packet = buildMessageEnvelope(
      job,
      buildWorkflowPreparationPacket(
        requirement,
        workflowPreparationPayloadWaitingTaskList,
        job.workflow_preparation.document.path,
        job.id,
        config,
      ),
      config,
      agentCards,
      [
        {
          kind: 'task_dispatch_plan',
          id: null,
          path: job.post_milestone.task_dispatch.document.path,
          role: 'source',
        },
        {
          kind: 'workflow_plan',
          id: null,
          path: job.workflow_preparation.document.path,
          role: 'target',
        },
      ],
    );

    let next = clone(job);
    next.current_stage = 'workflow_preparation';
    resolveInterventions(
      next,
      (intervention) => intervention.stage === 'workflow_preparation',
      'Workflow preparation redispatched.',
    );
    next.workflow_preparation.status = 'planning';
    next.workflow_preparation.parse_error = null;
    next.workflow_preparation.completed_at = null;
    next.workflow_preparation.waiting_tasks = [];
    next.workflow_preparation.generated_workflow_ids = [];
    next.workflow_preparation.reused_workflow_ids = [];
    next.workflow_preparation.dispatch.packet = packet;
    next.workflow_preparation.dispatch.last_dispatched_at = nowIso();
    next.workflow_preparation.document.exists = inspection.exists;
    next.workflow_preparation.document.initial_signature = inspection.signature;
    next.workflow_preparation.document.current_signature = inspection.signature;
    next.workflow_preparation.document.last_modified_at = inspection.modified_at;
    next.workflow_preparation.document.last_activity_at = inspection.modified_at;
    next.workflow_preparation.document.has_observed_progress = false;
    next.workflow_preparation.document.completion_reason = null;
    next.workflow_preparation.document.completion_reported_at = null;
    next.session_dispatch = emptySessionDispatch();
    next.runtime = {
      ...touchRuntime(next.runtime, config),
      last_error: null,
    };
    openTraceSpan(next, {
      stage: 'workflow_preparation',
      kind: 'dispatch',
      agent_id: config.workflow_designer_agent_id,
      packet_id: packet.id,
      note: `${next.routing.workflow_strategy} workflow routing.`,
    });
    next = transitionJob(
      next,
      'workflow_dispatched',
      SESSION_DISPATCHER_ID,
      'workflow_assignment_dispatched',
      note,
      'workflow_preparation',
    );

    await writeJob(next, job.status);
    return next;
  }

  async function finalizeWorkflowPreparation(job) {
    if (
      job.workflow_preparation.status === 'completed' ||
      job.workflow_preparation.status === 'rework_required' ||
      !job.workflow_preparation.document.completion_reason
    ) {
      return job;
    }

    const config = await getConfig();
    const requirement = await ring.read('requirement', job.requirement_id);
    const tasks = await loadGeneratedTasks(job);
    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const recommendations = await collectWorkflowRecommendations(tasks);
    const activeWorkflows = (await ring.list('workflow')).filter(
      (workflow) => workflow.status === 'active',
    );
    const documentText = await readFile(
      join(repoRoot, job.workflow_preparation.document.path),
      'utf-8',
    ).catch(() => '');

    try {
      const assignments = parseWorkflowPreparationPlan(documentText, tasks);
      const assignedTaskIds = new Set(assignments.map((assignment) => assignment.task_id));
      if (assignedTaskIds.size !== tasks.length) {
        throw new Error(
          `Workflow plan must assign exactly one workflow to each waiting task. Expected ${tasks.length}, received ${assignedTaskIds.size}.`,
        );
      }
      const waitingTasks = [];
      const generatedWorkflowIds = [];
      const reusedWorkflowIds = [];

      for (const assignment of assignments) {
        const task = tasksById.get(assignment.task_id);
        if (!task) {
          throw new Error(`Workflow assignment references unknown task ${assignment.task_id}.`);
        }

        const taskDocumentPath = join('docs', 'tasks', task.id, `${task.id}.md`);
        const taskDocumentInspection = await inspectDocument(taskDocumentPath);
        if (!taskDocumentInspection.exists) {
          throw new Error(`Task document is missing for ${task.id}: ${taskDocumentPath}.`);
        }

        let workflowId;
        let workflowName;
        let workflowSource;
        let registryRank = null;
        let registryMode = null;
        let selectionNote = null;
        let governanceSelectionContext = null;
        const recommendationEntry = recommendations.get(task.id) ?? null;
        const recommendation = recommendationEntry?.recommended ?? null;
        if (
          assignment.action === 'create' &&
          job.routing.workflow_strategy === 'reuse_strict' &&
          recommendation?.workflow
        ) {
          throw new Error(
            `Task ${task.id} must reuse workflow ${recommendation.workflow.id} because routing is reuse_strict.`,
          );
        }

        if (assignment.action === 'reuse') {
          const workflow = activeWorkflows.find((item) => item.id === assignment.workflow_id);
          if (!workflow) {
            throw new Error(
              `Task ${task.id} references unknown or inactive workflow ${assignment.workflow_id}.`,
            );
          }
          if (!workflow.data.applicable_to.includes(task.data.task_type)) {
            throw new Error(
              `Workflow ${workflow.id} does not apply to task type ${task.data.task_type}.`,
            );
          }

          workflowId = workflow.id;
          workflowName = workflow.data.name;
          if (recommendation?.workflow.id === workflow.id) {
            workflowSource = 'registry_reuse';
            registryRank = recommendation.rank ?? null;
            registryMode = recommendation.mode ?? null;
            selectionNote = recommendation.note ?? null;
            governanceSelectionContext = recommendation.selection_context ?? null;
          } else {
            workflowSource = 'existing_reuse';
          }
          reusedWorkflowIds.push(workflow.id);
        } else {
          const workflowIdSeed = `${task.id} ${assignment.workflow_name}`;
          workflowId = await ring.newId('workflow', { name: workflowIdSeed });
          workflowName = assignment.workflow_name;
          const createResult = await ring.create('workflow', {
            id: workflowId,
            status: 'active',
            created_by: config.workflow_designer_agent_id,
            data: {
              name: assignment.workflow_name,
              description: assignment.workflow_description,
              applicable_to: [task.data.task_type],
              steps: assignment.steps,
            },
          });

          if (!createResult.ok) {
            throw new Error(
              `Workflow creation failed for task ${task.id}: ${JSON.stringify(createResult.errors)}`,
            );
          }

          workflowSource = 'custom_generated';
          generatedWorkflowIds.push(workflowId);
        }

        await safeTaskPatch(task.id, {
          status: 'ready',
          data: {
            workflow_template_id: workflowId,
            workflow_run_id: null,
          },
        });

        const governanceBlockedReuse = waitingTaskGovernanceBlockedReuse(
          recommendationEntry,
          workflowSource,
        );

        const waitingTask = buildWaitingTaskRecord({
          task_id: task.id,
          task_name: task.data.name,
          task_type: task.data.task_type,
          milestone_id: task.data.milestone_id,
          task_document_path: taskDocumentPath,
          task_document_ready: true,
          prerequisites_ready: true,
          workflow_ready: true,
          workflow_template_id: workflowId,
          workflow_name: workflowName,
          workflow_source: workflowSource,
          registry_rank: registryRank,
          registry_mode: registryMode,
          selection_note: selectionNote,
          governance_selection_context: governanceSelectionContext,
          governance_blocked_reuse: governanceBlockedReuse,
          ready_at: nowIso(),
          dispatched_at: null,
        });
        if (!waitingTask) {
          throw new Error(`Waiting-task assembly failed for ${task.id}.`);
        }
        waitingTasks.push(waitingTask);
      }

      const {
        workflowPreparationPayloadWaitingTasksForDispatchPacket,
        waitingTasksForDispatchPacket,
      } = await sessionDispatchWaitingTaskViews(
        job,
        waitingTasks,
      );

      const agentCards = mapAgentCards(await getAgents(config));
      const dispatchedAt = nowIso();
      const {
        packet: batchPacket,
        waitingTasks: refreshedWaitingTasks,
      } = sessionDispatchEnvelopeState({
        job,
        requirement,
        storedWaitingTasks: waitingTasksForDispatchPacket,
        workflowPreparationPayloadWaitingTasks: workflowPreparationPayloadWaitingTasksForDispatchPacket,
        config,
        agentCards,
        dispatchedAt,
      });
      let next = clone(job);
      next.workflow_preparation.status = 'completed';
      next.workflow_preparation.waiting_tasks = refreshedWaitingTasks;
      next.workflow_preparation.generated_workflow_ids = generatedWorkflowIds;
      next.workflow_preparation.reused_workflow_ids = reusedWorkflowIds;
      next.workflow_preparation.parse_error = null;
      next.workflow_preparation.completed_at = nowIso();
      next.session_dispatch.status = 'waiting';
      next.session_dispatch.waiting_task_ids = waitingTasksForDispatchPacket.map((item) => item.task_id);
      next.session_dispatch.session_id = null;
      next.session_dispatch.workflow_run_ids = [];
      next.session_dispatch.launched_at = null;
      next.session_dispatch.dispatch.packet = batchPacket;
      next.session_dispatch.dispatch.last_dispatched_at = null;
      next.current_stage = 'session_dispatch';
      next.updated_at = nowIso();
      closeTraceStage(
        next,
        'workflow_preparation',
        'completed',
        'Workflow preparation completed.',
      );
      openTraceSpan(next, {
        stage: 'session_dispatch',
        kind: 'dispatch',
        agent_id: SESSION_DISPATCHER_ID,
        packet_id: batchPacket.id,
        note: `${waitingTasks.length} tasks are waiting for the next batch launch.`,
      });
      next = transitionJob(
        next,
        'waiting_for_session_dispatch',
        SESSION_DISPATCHER_ID,
        'waiting_area_ready',
        `${waitingTasks.length} tasks are ready for the next batch session launch.`,
        'session_dispatch',
      );

      await writeJob(next, job.status);
      return next;
    } catch (error) {
      let next = clone(job);
      next.current_stage = 'workflow_preparation';
      next.workflow_preparation.status = 'rework_required';
      next.workflow_preparation.parse_error =
        error instanceof Error ? error.message : String(error);
      addIntervention(next, {
        stage: 'workflow_preparation',
        severity: 'warning',
        source: SESSION_DISPATCHER_ID,
        reason: 'Workflow preparation could not be parsed or applied.',
        recommendation: 'Rewrite the workflow plan or switch to an existing reusable workflow.',
        note: next.workflow_preparation.parse_error,
      });
      next = transitionJob(
        next,
        'workflow_rework_required',
        SESSION_DISPATCHER_ID,
        'workflow_plan_invalid',
        next.workflow_preparation.parse_error,
        'workflow_preparation',
      );
      await writeJob(next, job.status);
      return next;
    }
  }

  async function launchSessionBatch(job) {
    if (
      job.adaptive_dispatch?.bundle_id ||
      job.status !== 'waiting_for_session_dispatch' ||
      job.session_dispatch.status !== 'waiting' ||
      job.session_dispatch.waiting_task_ids.length === 0
    ) {
      return job;
    }

    const requirement = await ring.read('requirement', job.requirement_id);
    const waitingTasks = clone(job.workflow_preparation.waiting_tasks);
    const readyTasks = waitingTasks.filter(
      (item) => item.task_document_ready && item.prerequisites_ready && item.workflow_ready,
    );

    if (readyTasks.length === 0) {
      return job;
    }

    try {
      const milestoneIds = [...new Set(readyTasks.map((item) => item.milestone_id))];
      const sessionId = await ring.newId('session', {
        name: `${job.requirement_name} dispatch batch`,
      });
      const workflowRunIds = [];
      const {
        workflowPreparationPayloadWaitingTasksForDispatchPacket,
        waitingTasksForSessionContext: readyTasksForSessionContext,
        waitingTasksForDispatchPacket: readyTasksForDispatchPacket,
      } = await sessionDispatchWaitingTaskViews(
        job,
        readyTasks,
      );
      const governanceContext = buildSessionGovernanceContext(readyTasksForSessionContext);
      const sessionContextInjected = buildSessionContextInjected(readyTasksForSessionContext);

      const createSessionResult = await ring.create('session', {
        id: sessionId,
        status: 'preparing',
        created_by: SESSION_DISPATCHER_ID,
        session_id: sessionId,
        data: {
          requirement_id: requirement.id,
          milestone_id: milestoneIds[0] ?? readyTasks[0].milestone_id,
          milestone_ids: milestoneIds,
          task_ids: readyTasks.map((item) => item.task_id),
          workflow_run_ids: [],
          evaluation_id: null,
          distillation_id: null,
          context_injected: sessionContextInjected,
          execution_log: [
            {
              timestamp: nowIso(),
              event: 'batch_dispatch',
              actor: SESSION_DISPATCHER_ID,
              detail: `Launched ${readyTasks.length} waiting tasks into a single session.`,
            },
            {
              timestamp: nowIso(),
              event: 'status_transition',
              from: 'gate_pending',
              to: 'preparing',
              actor: SESSION_DISPATCHER_ID,
              detail: 'Dispatcher batch launch created the live session.',
            },
            ...(governanceContext
              ? [
                  {
                    timestamp: nowIso(),
                    event: 'governance_context_injected',
                    actor: SESSION_DISPATCHER_ID,
                    detail:
                      `Session carries governance-sensitive fallback context (${governanceContext.batch_signature ?? 'governed'}) `
                      + `for ${governanceContext.blocked_reuse.length} blocked reuse candidate(s).`,
                  },
                ]
              : []),
          ],
          governance_context: governanceContext,
        },
      });

      if (!createSessionResult.ok) {
        throw new Error(
          `Session creation failed: ${JSON.stringify(createSessionResult.errors)}`,
        );
      }

      for (const item of readyTasks) {
        const workflow = await ring.read('workflow', item.workflow_template_id);
        const runId = await ring.newId('workflow-run', {
          name: `${item.task_id} ${workflow.data.name}`,
        });
        const createRunResult = await ring.create('workflow-run', {
          id: runId,
          status: 'pending',
          created_by: SESSION_DISPATCHER_ID,
          session_id: sessionId,
          data: {
            workflow_template_id: workflow.id,
            workflow_template_version: workflow.version,
            task_id: item.task_id,
            current_step_index: 0,
            callback: emptyWorkflowRunCallback(),
            reports: [],
            node_execution: emptyWorkflowRunNodeExecution(),
            steps: workflow.data.steps.map((step) => ({
              step_id: step.id,
              status: 'pending',
              started_at: null,
              ended_at: null,
              outputs: {},
              notes: null,
            })),
          },
        });

        if (!createRunResult.ok) {
          throw new Error(
            `Workflow run creation failed for task ${item.task_id}: ${JSON.stringify(createRunResult.errors)}`,
          );
        }

        workflowRunIds.push(runId);
        await safeTaskPatch(item.task_id, {
          session_id: sessionId,
          status: 'in_progress',
          data: {
            workflow_template_id: workflow.id,
            workflow_run_id: runId,
          },
        });
      }

      const sessionUpdateResult = await ring.update('session', sessionId, {
        data: {
          workflow_run_ids: workflowRunIds,
        },
      });
      if (!sessionUpdateResult.ok) {
        throw new Error(
          `Session update failed after workflow runs were created: ${JSON.stringify(sessionUpdateResult.errors)}`,
        );
      }

      await safeRequirementStatus(requirement.id, 'in_progress');
      for (const milestoneId of milestoneIds) {
        const milestone = await ring.read('milestone', milestoneId);
        if (['draft', 'blocked'].includes(milestone.status)) {
          await safeMilestoneStatus(milestoneId, 'active');
        }
      }

      let next = clone(job);
      next.current_stage = 'completed';
      next.session_dispatch.status = 'dispatched';
      next.session_dispatch.session_id = sessionId;
      next.session_dispatch.workflow_run_ids = workflowRunIds;
      next.session_dispatch.launched_at = nowIso();
      const config = await getConfig();
      const agentCards = mapAgentCards(await getAgents(config));
      const dispatchedAt = nowIso();
      const {
        packet: sessionDispatchPacket,
        waitingTasks: refreshedWaitingTasks,
      } = sessionDispatchEnvelopeState({
        job,
        requirement,
        storedWaitingTasks: next.workflow_preparation.waiting_tasks,
        dispatchWaitingTasks: readyTasksForDispatchPacket,
        refreshedWaitingTasks: readyTasksForDispatchPacket,
        workflowPreparationPayloadWaitingTasks: workflowPreparationPayloadWaitingTasksForDispatchPacket,
        config,
        agentCards,
        dispatchedAt,
      });
      next.session_dispatch.dispatch.packet = sessionDispatchPacket;
      next.session_dispatch.dispatch.last_dispatched_at = dispatchedAt;
      next.workflow_preparation.waiting_tasks = refreshedWaitingTasks;
      closeTraceStage(
        next,
        'session_dispatch',
        'completed',
        `Batch session ${sessionId} launched.`,
      );
      next = transitionJob(
        next,
        'session_dispatched',
        SESSION_DISPATCHER_ID,
        'batch_session_started',
        `${readyTasks.length} tasks launched in session ${sessionId}.`,
        'completed',
      );

      await writeJob(next, job.status);
      return next;
    } catch (error) {
      let next = clone(job);
      next.current_stage = 'session_dispatch';
      next.runtime.last_error = error instanceof Error ? error.message : String(error);
      addIntervention(next, {
        stage: 'session_dispatch',
        severity: 'critical',
        source: SESSION_DISPATCHER_ID,
        reason: 'Batch session launch failed.',
        recommendation: 'Resolve the launch error and retry the waiting area batch.',
        note: next.runtime.last_error,
      });
      next = transitionJob(
        next,
        'failed',
        SESSION_DISPATCHER_ID,
        'session_batch_launch_failed',
        next.runtime.last_error,
        'session_dispatch',
      );
      await writeJob(next, job.status);
      return next;
    }
  }

  async function launchDispatchBundleGroup(bundles) {
    const readyBundles = bundles.filter(
      (bundle) =>
        bundle.status === 'ready_queued' &&
        bundle.batching.status === 'queued' &&
        bundle.workflows.waiting_tasks.some((item) => !item.dispatched_at),
    );
    if (readyBundles.length === 0) {
      return [];
    }

    const firstBundle = readyBundles[0];
    const requirement = await ring.read(
      'requirement',
      firstBundle.planning.requirement_id,
    );
    const milestoneIds = [
      ...new Set(
        readyBundles.map((bundle) => bundle.planning.milestone_id).filter(Boolean),
      ),
    ];
    const readyTasks = readyBundles.flatMap((bundle) =>
      bundle.workflows.waiting_tasks.filter(
        (item) =>
          item.task_document_ready &&
          item.prerequisites_ready &&
          item.workflow_ready &&
          !item.dispatched_at,
      ),
    );

    if (readyTasks.length === 0) {
      return [];
    }

    for (const bundle of readyBundles) {
      const next = clone(bundle);
      next.batching.status = 'batched';
      appendDispatchBundleHistory(
        next,
        'session_batched',
        SESSION_DISPATCHER_ID,
        'dispatch_batch_opened',
        `${readyTasks.length} tasks entered this session batch.`,
      );
      await writeDispatchBundle(next, 'ready_queued');
    }

    try {
      const sessionId = await ring.newId('session', {
        name: `${requirement.data.name} bundle batch`,
      });
      const workflowRunIds = [];
      const {
        waitingTasksForSessionContext: readyTasksForSessionContext,
        waitingTasksForDispatchPacket: readyTasksForBundleStorage,
      } = await waitingTaskGovernanceViewState(
        readyTasks,
        readyTasks,
      );
      const readyTaskForBundleStorageById = new Map(
        readyTasksForBundleStorage
          .map((item) => [trimString(item?.task_id), item])
          .filter(([taskId]) => Boolean(taskId)),
      );
      const governanceContext = buildSessionGovernanceContext(readyTasksForSessionContext);
      const sessionContextInjected = buildSessionContextInjected(readyTasksForSessionContext);

      const createSessionResult = await ring.create('session', {
        id: sessionId,
        status: 'preparing',
        created_by: SESSION_DISPATCHER_ID,
        session_id: sessionId,
        data: {
          requirement_id: requirement.id,
          milestone_id: milestoneIds[0] ?? readyTasks[0].milestone_id,
          milestone_ids: milestoneIds,
          task_ids: readyTasks.map((item) => item.task_id),
          workflow_run_ids: [],
          evaluation_id: null,
          distillation_id: null,
          context_injected: sessionContextInjected,
          execution_log: [
            {
              timestamp: nowIso(),
              event: 'bundle_batch_dispatch',
              actor: SESSION_DISPATCHER_ID,
              detail: `Launched ${readyTasks.length} ready bundle tasks into a single session.`,
            },
            ...(governanceContext
              ? [
                  {
                    timestamp: nowIso(),
                    event: 'governance_context_injected',
                    actor: SESSION_DISPATCHER_ID,
                    detail:
                      `Session carries governance-sensitive fallback context (${governanceContext.batch_signature ?? 'governed'}) `
                      + `for ${governanceContext.blocked_reuse.length} blocked reuse candidate(s).`,
                  },
                ]
              : []),
          ],
          governance_context: governanceContext,
        },
      });

      if (!createSessionResult.ok) {
        throw new DispatchBundleError(
          `Session creation failed: ${JSON.stringify(createSessionResult.errors)}`,
          { code: 'bundle_session_creation_failed', statusCode: 500 },
        );
      }

      for (const item of readyTasks) {
        const workflow = await ring.read('workflow', item.workflow_template_id);
        const runId = await ring.newId('workflow-run', {
          name: `${item.task_id} ${workflow.data.name}`,
        });
        const createRunResult = await ring.create('workflow-run', {
          id: runId,
          status: 'pending',
          created_by: SESSION_DISPATCHER_ID,
          session_id: sessionId,
          data: {
            workflow_template_id: workflow.id,
            workflow_template_version: workflow.version,
            task_id: item.task_id,
            current_step_index: 0,
            callback: emptyWorkflowRunCallback(),
            reports: [],
            node_execution: emptyWorkflowRunNodeExecution(),
            steps: workflow.data.steps.map((step) => ({
              step_id: step.id,
              status: 'pending',
              started_at: null,
              ended_at: null,
              outputs: {},
              notes: null,
            })),
          },
        });

        if (!createRunResult.ok) {
          throw new DispatchBundleError(
            `Workflow run creation failed for task ${item.task_id}: ${JSON.stringify(createRunResult.errors)}`,
            { code: 'bundle_workflow_run_creation_failed', statusCode: 500 },
          );
        }

        workflowRunIds.push(runId);
        await safeTaskPatch(item.task_id, {
          session_id: sessionId,
          status: 'in_progress',
          data: {
            workflow_template_id: workflow.id,
            workflow_run_id: runId,
          },
        });
      }

      const sessionUpdateResult = await ring.update('session', sessionId, {
        data: {
          workflow_run_ids: workflowRunIds,
        },
      });
      if (!sessionUpdateResult.ok) {
        throw new DispatchBundleError(
          `Session update failed after workflow runs were created: ${JSON.stringify(sessionUpdateResult.errors)}`,
          { code: 'bundle_session_update_failed', statusCode: 500 },
        );
      }

      await safeRequirementStatus(requirement.id, 'in_progress');
      for (const milestoneId of milestoneIds) {
        const milestone = await ring.read('milestone', milestoneId);
        if (['draft', 'blocked'].includes(milestone.status)) {
          await safeMilestoneStatus(milestoneId, 'active');
        }
      }

      const updatedBundles = [];
      for (const bundle of readyBundles) {
        const next = await readDispatchBundle(bundle.id);
        const dispatchedAt = nowIso();
        next.batching.status = 'launched';
        next.batching.session_id = sessionId;
        next.batching.workflow_run_ids = workflowRunIds.filter((runId, index) =>
          readyTasks[index] != null,
        );
        next.batching.launched_at = dispatchedAt;
        next.workflows.waiting_tasks = next.workflows.waiting_tasks.map((item) => {
          const refreshedReadyTask = readyTaskForBundleStorageById.get(trimString(item?.task_id));
          if (!refreshedReadyTask) {
            return item;
          }
          return {
            ...item,
            ...refreshedReadyTask,
            dispatched_at: dispatchedAt,
          };
        });
        appendDispatchBundleHistory(
          next,
          'session_launched',
          SESSION_DISPATCHER_ID,
          'bundle_session_launched',
          `Session ${sessionId} launched.`,
        );
        await writeDispatchBundle(next, 'session_batched');
        if (next.canonical?.trace?.job_id) {
          await syncJobFromAdaptiveBundle(next.canonical.trace.job_id, next);
        }
        updatedBundles.push(next);
      }

      return updatedBundles;
    } catch (error) {
      const failedBundles = [];
      for (const bundle of readyBundles) {
        const next = await readDispatchBundle(bundle.id);
        next.batching.status = 'failed';
        next.batching.error = error instanceof Error ? error.message : String(error);
        annotateBundleFailure(
          next,
          'launch_failed',
          error,
          SESSION_DISPATCHER_ID,
          'bundle_session_launch_failed',
        );
        await writeDispatchBundle(next, 'session_batched');
        if (next.canonical?.trace?.job_id) {
          await syncJobFromAdaptiveBundle(next.canonical.trace.job_id, next);
        }
        failedBundles.push(next);
      }
      return failedBundles;
    }
  }

  async function launchReadyDispatchBundles() {
    const bundles = await listDispatchBundles();
    const ready = bundles.filter(
      (bundle) =>
        bundle.status === 'ready_queued' &&
        bundle.batching.status === 'queued' &&
        bundle.planning.requirement_id,
    );
    if (ready.length === 0) {
      return [];
    }

    const groups = new Map();
    for (const bundle of ready) {
      const groupKey = bundle.batching.session_group_key ?? bundle.id;
      const existing = groups.get(groupKey) ?? [];
      existing.push(bundle);
      groups.set(groupKey, existing);
    }

    const processed = [];
    for (const groupBundles of groups.values()) {
      processed.push(...(await launchDispatchBundleGroup(groupBundles)));
    }
    return processed;
  }

  async function dispatchPostMilestoneOrchestration(job, note = null) {
    const config = await getConfig();
    const agentCards = mapAgentCards(await getAgents(config));
    const requirement = await ring.read('requirement', job.requirement_id);
    const milestones = await loadGeneratedMilestones(job);
    const prerequisiteInspection = await ensureDocument(
      job.post_milestone.prerequisite_analysis.document.path,
      () =>
        Promise.resolve(
          buildPrerequisiteAnalysisScaffold(
            requirement,
            milestones,
            job.milestone_plan.document.path,
            job.post_milestone.task_dispatch.document.path,
          ),
        ),
    );

    const prerequisitePacket = buildMessageEnvelope(
      job,
      buildPrerequisitePreparerPacket(
        requirement,
        milestones,
        job.milestone_plan.document.path,
        job.id,
        job.post_milestone.prerequisite_analysis.document.path,
        job.post_milestone.task_dispatch.document.path,
        config,
      ),
      config,
      agentCards,
      [
        {
          kind: 'milestone_plan',
          id: null,
          path: job.milestone_plan.document.path,
          role: 'source',
        },
        {
          kind: 'prerequisite_analysis',
          id: null,
          path: job.post_milestone.prerequisite_analysis.document.path,
          role: 'target',
        },
      ],
    );

    let next = clone(job);
    next.current_stage = 'post_milestone_orchestration';
    resolveInterventions(
      next,
      (intervention) => intervention.stage === 'prerequisite_analysis',
      'Prerequisite analysis redispatched.',
    );
    resolveInterventions(
      next,
      (intervention) => intervention.stage === 'task_dispatch',
      'Task dispatch redispatched.',
    );
    next.post_milestone.prerequisite_analysis.status = 'preparing';
    next.post_milestone.prerequisite_analysis.parse_error = null;
    next.post_milestone.prerequisite_analysis.ready_groups = [];
    next.post_milestone.prerequisite_analysis.blocked_groups = [];
    next.post_milestone.prerequisite_analysis.completed_at = null;
    next.post_milestone.prerequisite_analysis.distillation = emptyDistillation(
      config.distiller_agent_id,
    );
    next.post_milestone.prerequisite_analysis.dispatch.packet = prerequisitePacket;
    next.post_milestone.prerequisite_analysis.dispatch.last_dispatched_at = nowIso();
    next.post_milestone.prerequisite_analysis.document.exists = prerequisiteInspection.exists;
    next.post_milestone.prerequisite_analysis.document.initial_signature = prerequisiteInspection.signature;
    next.post_milestone.prerequisite_analysis.document.current_signature = prerequisiteInspection.signature;
    next.post_milestone.prerequisite_analysis.document.last_modified_at = prerequisiteInspection.modified_at;
    next.post_milestone.prerequisite_analysis.document.last_activity_at = prerequisiteInspection.modified_at;
    next.post_milestone.prerequisite_analysis.document.has_observed_progress = false;
    next.post_milestone.prerequisite_analysis.document.completion_reason = null;
    next.post_milestone.prerequisite_analysis.document.completion_reported_at = null;
    next.post_milestone.task_dispatch.status = 'pending';
    next.post_milestone.task_dispatch.parse_error = null;
    next.post_milestone.task_dispatch.completed_at = null;
    next.post_milestone.task_dispatch.generated_task_ids = [];
    next.post_milestone.task_dispatch.task_document_paths = [];
    next.post_milestone.task_dispatch.dispatch.packet = null;
    next.post_milestone.task_dispatch.dispatch.last_dispatched_at = null;
    next.post_milestone.task_dispatch.document.exists = false;
    next.post_milestone.task_dispatch.document.initial_signature = null;
    next.post_milestone.task_dispatch.document.current_signature = null;
    next.post_milestone.task_dispatch.document.last_modified_at = null;
    next.post_milestone.task_dispatch.document.last_activity_at = null;
    next.post_milestone.task_dispatch.document.has_observed_progress = false;
    next.post_milestone.task_dispatch.document.completion_reason = null;
    next.post_milestone.task_dispatch.document.completion_reported_at = null;

    next.runtime = {
      ...touchRuntime(next.runtime, config),
      last_error: null,
    };
    closeTraceStage(
      next,
      'milestone_plan',
      'completed',
      'Milestones ready for readiness routing.',
    );
    openTraceSpan(next, {
      stage: 'prerequisite_analysis',
      kind: 'dispatch',
      agent_id: config.prerequisite_preparer_agent_id,
      packet_id: prerequisitePacket.id,
      note: next.routing.explanation,
    });
    next = transitionJob(
      next,
      'post_milestone_dispatched',
      'dispatcher',
      'post_milestone_branches_dispatched',
      note ??
        'Prerequisite analysis started. Adaptive dispatcher will take over once readiness is finalized.',
      'post_milestone_orchestration',
    );

    await writeJob(next, job.status);
    return next;
  }

  async function finalizePrerequisiteAnalysis(job) {
    if (
      job.post_milestone.prerequisite_analysis.status === 'completed' ||
      job.post_milestone.prerequisite_analysis.status === 'rework_required' ||
      !job.post_milestone.prerequisite_analysis.document.completion_reason
    ) {
      return job;
    }

    const config = await getConfig();
    const requirement = await ring.read('requirement', job.requirement_id);
    const milestones = await loadGeneratedMilestones(job);
    const documentText = await readFile(
      join(repoRoot, job.post_milestone.prerequisite_analysis.document.path),
      'utf-8',
    ).catch(() => '');

    try {
      const groups = parsePrerequisiteAnalysis(documentText, milestones);
      const byMilestoneId = new Map(groups.map((group) => [group.milestone_id, group]));

      for (const milestone of milestones) {
        const group = byMilestoneId.get(milestone.id);
        if (!group) {
          continue;
        }

        const readyDescriptions = new Set(group.ready.map((item) => item.description));
        const blockedDescriptions = new Set(group.blocked.map((item) => item.description));
        const nextPrerequisites = [];
        const seenDescriptions = new Set();

        for (const prerequisite of milestone.data.prerequisites) {
          seenDescriptions.add(prerequisite.description);
          if (readyDescriptions.has(prerequisite.description)) {
            nextPrerequisites.push({
              ...prerequisite,
              status: 'satisfied',
              last_checked: nowIso(),
            });
            continue;
          }
          if (blockedDescriptions.has(prerequisite.description)) {
            nextPrerequisites.push({
              ...prerequisite,
              status: 'unsatisfied',
              last_checked: nowIso(),
            });
            continue;
          }
          nextPrerequisites.push(prerequisite);
        }

        for (const item of [...group.ready, ...group.blocked]) {
          if (seenDescriptions.has(item.description)) {
            continue;
          }

          const created = buildPrerequisite(
            `[${item.check_type}] ${item.description}`,
            nextPrerequisites.length,
          );
          nextPrerequisites.push({
            ...created,
            status: group.ready.includes(item) ? 'satisfied' : 'unsatisfied',
            last_checked: nowIso(),
          });
        }

        await safeMilestonePrerequisites(milestone.id, nextPrerequisites);
      }

      const distillation = await emitDistillationFeedback(
        job,
        groups.filter((group) => group.blocked.length > 0),
        requirement,
        config,
      );

      let next = clone(job);
      if (next.status === 'post_milestone_dispatched') {
        next = transitionJob(
          next,
          'post_milestone_in_progress',
          'dispatcher',
          'branch_progress_observed',
          'Prerequisite analysis completed.',
          'post_milestone_orchestration',
        );
      } else {
        next.current_stage = 'post_milestone_orchestration';
        next.updated_at = nowIso();
      }
      next.post_milestone.prerequisite_analysis.status = 'completed';
      next.post_milestone.prerequisite_analysis.ready_groups = groups.map((group) => ({
        milestone_id: group.milestone_id,
        milestone_name: group.milestone_name,
        items: group.ready,
      }));
      next.post_milestone.prerequisite_analysis.blocked_groups = groups.map((group) => ({
        milestone_id: group.milestone_id,
        milestone_name: group.milestone_name,
        items: group.blocked,
      }));
      next.post_milestone.prerequisite_analysis.parse_error = null;
      next.post_milestone.prerequisite_analysis.completed_at = nowIso();
      next.post_milestone.prerequisite_analysis.distillation = distillation;
      closeTraceStage(
        next,
        'prerequisite_analysis',
        'completed',
        'Prerequisite analysis completed.',
      );

      await writeJob(next, job.status);
      return next;
    } catch (error) {
      let next = clone(job);
      next.current_stage = 'post_milestone_orchestration';
      next.post_milestone.prerequisite_analysis.status = 'rework_required';
      next.post_milestone.prerequisite_analysis.parse_error =
        error instanceof Error ? error.message : String(error);
      addIntervention(next, {
        stage: 'prerequisite_analysis',
        severity: 'warning',
        source: SESSION_DISPATCHER_ID,
        reason: 'Prerequisite analysis could not be parsed or applied.',
        recommendation: 'Rewrite the prerequisite analysis document before task planning continues.',
        note: next.post_milestone.prerequisite_analysis.parse_error,
      });
      next = transitionJob(
        next,
        'post_milestone_rework_required',
        'dispatcher',
        'prerequisite_analysis_invalid',
        next.post_milestone.prerequisite_analysis.parse_error,
        'post_milestone_orchestration',
      );
      await writeJob(next, job.status);
      return next;
    }
  }

  async function maybeFinalizePostMilestone(job) {
    let current = job;

    if (POST_MILESTONE_ACTIVE_STATUSES.has(current.status)) {
      current = await finalizePrerequisiteAnalysis(current);
    }

    if (
      current.status === 'post_milestone_rework_required' ||
      current.status === 'failed'
    ) {
      return current;
    }

    if (
      ['post_milestone_dispatched', 'post_milestone_in_progress'].includes(current.status) &&
      current.post_milestone.prerequisite_analysis.status === 'completed' &&
      !current.adaptive_dispatch?.bundle_id
    ) {
      return submitInternalAdaptiveBundle(current);
    }

    if (
      current.adaptive_dispatch?.bundle_id &&
      ['post_milestone_dispatched', 'post_milestone_in_progress', 'workflow_dispatched', 'waiting_for_session_dispatch'].includes(current.status)
    ) {
      const bundle = await readDispatchBundle(current.adaptive_dispatch.bundle_id).catch(
        () => null,
      );
      if (bundle) {
        return syncJobFromAdaptiveBundle(current, bundle);
      }
    }

    return current;
  }

  async function dispatchRequirementDocument(job, note = null) {
    const config = await getConfig();
    const agentCards = mapAgentCards(await getAgents(config));
    const requirement = await ring.read('requirement', job.requirement_id);
    const inspection = await ensureDocument(
      job.requirement_document.document.path,
      () => Promise.resolve(buildRequirementScaffold(requirement)),
    );
    const packet = buildMessageEnvelope(
      job,
      buildWriterPacket(
        requirement,
        job.id,
        job.requirement_document.document.path,
        config,
      ),
      config,
      agentCards,
      [
        {
          kind: 'requirement',
          id: requirement.id,
          path: null,
          role: 'source',
        },
        {
          kind: 'requirement_document',
          id: null,
          path: job.requirement_document.document.path,
          role: 'target',
        },
      ],
    );

    let next = clone(job);
    next.current_stage = 'requirement_document';
    resolveInterventions(
      next,
      (intervention) => intervention.stage === 'requirement_document',
      'Requirement document redispatched.',
    );
    next.requirement_document.dispatch.packet = packet;
    next.requirement_document.dispatch.last_dispatched_at = nowIso();
    next.requirement_document.document.exists = inspection.exists;
    next.requirement_document.document.initial_signature = inspection.signature;
    next.requirement_document.document.current_signature = inspection.signature;
    next.requirement_document.document.last_modified_at = inspection.modified_at;
    next.requirement_document.document.last_activity_at = inspection.modified_at;
    next.requirement_document.document.has_observed_progress = false;
    next.requirement_document.document.completion_reason = null;
    next.requirement_document.document.completion_reported_at = null;
    next.requirement_document.audit = emptyAudit(config.auditor_agent_id);
    next.runtime = {
      ...touchRuntime(next.runtime, config),
      last_error: null,
    };
    openTraceSpan(next, {
      stage: 'requirement_document',
      kind: 'dispatch',
      agent_id: config.writer_agent_id,
      packet_id: packet.id,
      note: note ?? `Routing mode ${next.routing.mode}.`,
    });
    next = transitionJob(
      next,
      'requirement_dispatched',
      'dispatcher',
      'packet_dispatched',
      note,
      'requirement_document',
    );

    await writeJob(next, job.status);
    await safeRequirementStatus(job.requirement_id, 'analyzing');
    return next;
  }

  async function dispatchMilestonePlanning(job, note = null) {
    const config = await getConfig();
    const agentCards = mapAgentCards(await getAgents(config));
    const requirement = await ring.read('requirement', job.requirement_id);
    const inspection = await ensureDocument(
      job.milestone_plan.document.path,
      () =>
        Promise.resolve(
          buildMilestoneScaffold(
            requirement,
            job.requirement_document.document.path,
          ),
        ),
    );
    const packet = buildMessageEnvelope(
      job,
      buildMilestonePlannerPacket(
        requirement,
        job.requirement_document.document.path,
        job.id,
        job.milestone_plan.document.path,
        config,
      ),
      config,
      agentCards,
      [
        {
          kind: 'requirement_document',
          id: null,
          path: job.requirement_document.document.path,
          role: 'source',
        },
        {
          kind: 'milestone_plan',
          id: null,
          path: job.milestone_plan.document.path,
          role: 'target',
        },
      ],
    );

    let next = clone(job);
    next.current_stage = 'milestone_plan';
    resolveInterventions(
      next,
      (intervention) => intervention.stage === 'milestone_plan',
      'Milestone planning redispatched.',
    );
    next.milestone_plan.status = 'planning';
    next.milestone_plan.parse_error = null;
    next.milestone_plan.dispatch.packet = packet;
    next.milestone_plan.dispatch.last_dispatched_at = nowIso();
    next.milestone_plan.document.exists = inspection.exists;
    next.milestone_plan.document.initial_signature = inspection.signature;
    next.milestone_plan.document.current_signature = inspection.signature;
    next.milestone_plan.document.last_modified_at = inspection.modified_at;
    next.milestone_plan.document.last_activity_at = inspection.modified_at;
    next.milestone_plan.document.has_observed_progress = false;
    next.milestone_plan.document.completion_reason = null;
    next.milestone_plan.document.completion_reported_at = null;
    next.runtime = {
      ...touchRuntime(next.runtime, config),
      last_error: null,
    };
    closeTraceStage(next, 'requirement_document', 'completed', 'Requirement document accepted.');
    closeTraceStage(next, 'requirement_audit', 'completed', 'Requirement audit approved.');
    openTraceSpan(next, {
      stage: 'milestone_plan',
      kind: 'dispatch',
      agent_id: config.milestone_planner_agent_id,
      packet_id: packet.id,
      note,
    });
    next = transitionJob(
      next,
      'milestone_dispatched',
      'dispatcher',
      'milestone_planner_dispatched',
      note,
      'milestone_plan',
    );

    await writeJob(next, job.status);
    return next;
  }

  async function createRequirementDispatch(fields) {
    const config = await getConfig();
    const routing = buildRoutingPolicy(fields);
    const requirementId = await ring.newId('requirement', {
      name: fields.name,
    });

    const requirementResult = await ring.create('requirement', {
      id: requirementId,
      status: 'draft',
      created_by: fields.created_by ?? 'ring-gui',
      data: {
        name: fields.name,
        description: fields.description,
        acceptance_criteria: fields.acceptance_criteria,
        milestone_ids: [],
        priority: fields.priority,
      },
    });

    if (!requirementResult.ok) {
      throw new Error(
        `Requirement creation failed: ${JSON.stringify(requirementResult.errors)}`,
      );
    }

    const jobId = await nextJobId();
    const createdAt = nowIso();
    const requirementDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.document_output_dir, `${requirementId}.md`),
    );
    const milestoneDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.milestone_output_dir, `${requirementId}.md`),
    );
    const prerequisiteDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.prerequisite_output_dir, `${requirementId}.md`),
    );
    const taskDispatchDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.task_dispatch_output_dir, `${requirementId}.md`),
    );
    const workflowDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.workflow_output_dir, `${requirementId}.md`),
    );
    const followupDocumentPath = relative(
      repoRoot,
      join(repoRoot, config.followup_output_dir, `${requirementId}.md`),
    );

    const baseJob = {
      id: jobId,
      status: 'queued',
      current_stage: 'requirement_document',
      created_at: createdAt,
      updated_at: createdAt,
      created_by: fields.created_by ?? 'ring-gui',
      requirement_id: requirementId,
      requirement_name: fields.name,
      routing,
      interventions: [],
      trace: emptyTrace(jobId, createdAt),
      state_machine: clone(JOB_STATE_MACHINE),
      requirement_document: {
        writer_agent_id: config.writer_agent_id,
        document: emptyDocumentState(requirementDocumentPath),
        dispatch: emptyDispatch(config.writer_agent_id),
        audit: emptyAudit(config.auditor_agent_id),
      },
      milestone_plan: {
        planner_agent_id: config.milestone_planner_agent_id,
        status: 'pending',
        document: emptyDocumentState(milestoneDocumentPath),
        dispatch: emptyDispatch(config.milestone_planner_agent_id),
        generated_milestone_ids: [],
        completed_at: null,
        parse_error: null,
      },
      post_milestone: {
        prerequisite_analysis: {
          preparer_agent_id: config.prerequisite_preparer_agent_id,
          status: 'pending',
          document: emptyDocumentState(prerequisiteDocumentPath),
          dispatch: emptyDispatch(config.prerequisite_preparer_agent_id),
          ready_groups: [],
          blocked_groups: [],
          parse_error: null,
          completed_at: null,
          distillation: emptyDistillation(config.distiller_agent_id),
        },
        task_dispatch: {
          dispatcher_agent_id: config.task_dispatcher_agent_id,
          status: 'pending',
          document: emptyDocumentState(taskDispatchDocumentPath),
          dispatch: emptyDispatch(config.task_dispatcher_agent_id),
          generated_task_ids: [],
          task_document_paths: [],
          parse_error: null,
          completed_at: null,
        },
      },
      workflow_preparation: emptyWorkflowPreparation(
        config.workflow_designer_agent_id,
        workflowDocumentPath,
      ),
      session_dispatch: emptySessionDispatch(),
      followup: emptyFollowup(
        config.distiller_agent_id,
        followupDocumentPath,
      ),
      adaptive_dispatch: emptyAdaptiveDispatch(),
      runtime: {
        last_polled_at: null,
        next_poll_at: new Date(Date.now() + config.poll_interval_ms).toISOString(),
        poll_interval_ms: config.poll_interval_ms,
        idle_threshold_ms: config.document_idle_threshold_ms,
        last_error: null,
      },
      history: [
        {
          timestamp: createdAt,
          from: null,
          to: 'queued',
          actor: 'dispatcher',
          reason: 'job_created',
          note: `Requirement accepted by the dispatch center. Routing mode ${routing.mode}.`,
        },
      ],
    };

    await writeJob(baseJob);
    const job = await dispatchRequirementDocument(baseJob);
    const requirement = await ring.read('requirement', requirementId);

    return {
      requirement,
      job,
    };
  }

  async function runAudit(jobId) {
    const config = await getConfig();
    const job = typeof jobId === 'string' ? await readJob(jobId) : jobId;
    const beforeAuditStatus = job.status;

    if (beforeAuditStatus !== 'requirement_ready_for_audit') {
      return job;
    }

    let auditing = clone(job);
    auditing.current_stage = 'requirement_document';
    auditing.requirement_document.audit.status = 'running';
    auditing.requirement_document.audit.requested_at = nowIso();
    openTraceSpan(auditing, {
      stage: 'requirement_audit',
      kind: 'audit',
      agent_id: config.auditor_agent_id,
      packet_id: null,
      note: 'Requirement audit started.',
    });
    auditing = transitionJob(
      auditing,
      'requirement_auditing',
      'auditor',
      'audit_started',
      null,
      'requirement_document',
    );
    await writeJob(auditing, beforeAuditStatus);

    const documentPath = join(
      repoRoot,
      auditing.requirement_document.document.path,
    );
    const documentText = await readFile(documentPath, 'utf-8').catch(() => '');
    const audit = buildAudit(documentText, config);

    let reviewed = clone(auditing);
    reviewed.requirement_document.audit = {
      ...reviewed.requirement_document.audit,
      status: audit.approved ? 'approved' : 'rework_required',
      verdict: audit.approved ? 'approved' : 'rework_required',
      score: audit.score,
      findings: audit.findings,
      metrics: audit.metrics,
      completed_at: nowIso(),
    };

    if (!audit.approved) {
      closeTraceStage(
        reviewed,
        'requirement_audit',
        'intervention_required',
        'Requirement audit requested rework.',
      );
      addIntervention(reviewed, {
        stage: 'requirement_document',
        severity: 'warning',
        source: config.auditor_agent_id,
        reason: 'Requirement audit failed.',
        recommendation: 'Rewrite the requirement document and redispatch the writer.',
        note: reviewed.requirement_document.audit.findings
          .filter((finding) => !finding.passed)
          .map((finding) => finding.detail)
          .join(' '),
      });
      reviewed = transitionJob(
        reviewed,
        'requirement_rework_required',
        'auditor',
        'audit_failed',
        null,
        'requirement_document',
      );
      await writeJob(reviewed, 'requirement_auditing');
      await safeRequirementStatus(reviewed.requirement_id, 'analyzing');
      return reviewed;
    }

    await safeRequirementStatus(reviewed.requirement_id, 'ready');
    closeTraceStage(
      reviewed,
      'requirement_audit',
      'completed',
      'Requirement audit approved.',
    );
    return dispatchMilestonePlanning(
      reviewed,
      'Requirement document approved.',
    );
  }

  async function finalizeMilestones(jobId) {
    const job = typeof jobId === 'string' ? await readJob(jobId) : jobId;
    if (job.status !== 'milestone_ready_for_finalize') {
      return job;
    }

    const documentPath = join(repoRoot, job.milestone_plan.document.path);
    const documentText = await readFile(documentPath, 'utf-8').catch(() => '');

    try {
      const requirement = await ring.read('requirement', job.requirement_id);
      const plannedMilestones = parseMilestonePlan(documentText);
      const createdIds = [];

      for (const milestonePlan of plannedMilestones) {
        const milestoneId = await ring.newId('milestone', {
          name: milestonePlan.name,
          parentId: requirement.id,
        });

        const createResult = await ring.create('milestone', {
          id: milestoneId,
          status: 'draft',
          created_by: job.milestone_plan.dispatch.agent_id,
          data: {
            name: milestonePlan.name,
            requirement_id: requirement.id,
            description: milestonePlan.description,
            acceptance_checks: milestonePlan.acceptance_checks,
            prerequisites: milestonePlan.prerequisites,
          },
        });

        if (!createResult.ok) {
          throw new Error(
            `Milestone creation failed for "${milestonePlan.name}": ${JSON.stringify(createResult.errors)}`,
          );
        }

        createdIds.push(milestoneId);
      }

      const mergedMilestoneIds = [
        ...new Set([...(requirement.data.milestone_ids ?? []), ...createdIds]),
      ];
      await safeRequirementPatch(requirement.id, {
        data: { milestone_ids: mergedMilestoneIds },
      });

      let next = clone(job);
      next.current_stage = 'completed';
      next.milestone_plan.status = 'completed';
      next.milestone_plan.generated_milestone_ids = createdIds;
      next.milestone_plan.completed_at = nowIso();
      next.milestone_plan.parse_error = null;
      closeTraceStage(
        next,
        'milestone_plan',
        'completed',
        `${createdIds.length} milestones materialized.`,
      );
      next = transitionJob(
        next,
        'milestones_ready',
        'dispatcher',
        'milestones_materialized',
        `${createdIds.length} milestones generated from the plan.`,
        'completed',
      );

      await writeJob(next, job.status);
      return dispatchPostMilestoneOrchestration(
        next,
        `${createdIds.length} milestones generated from the plan.`,
      );
    } catch (error) {
      let next = clone(job);
      next.current_stage = 'milestone_plan';
      next.milestone_plan.status = 'rework_required';
      next.milestone_plan.parse_error =
        error instanceof Error ? error.message : String(error);
      addIntervention(next, {
        stage: 'milestone_plan',
        severity: 'warning',
        source: SESSION_DISPATCHER_ID,
        reason: 'Milestone plan could not be materialized.',
        recommendation: 'Fix the milestone planning document and redispatch milestone planning.',
        note: next.milestone_plan.parse_error,
      });
      next = transitionJob(
        next,
        'milestone_rework_required',
        'dispatcher',
        'milestone_plan_invalid',
        next.milestone_plan.parse_error,
        'milestone_plan',
      );

      await writeJob(next, job.status);
      return next;
    }
  }

  async function reportAgent(jobId, report) {
    const job = await readJob(jobId);
    const phase = phaseForAgent(job, report.agent_id);
    const status = report.status ?? 'completed';
    const reportEntry = {
      at: nowIso(),
      agent_id:
        report.agent_id ??
        (phase === 'task_dispatch'
          ? job.post_milestone.task_dispatch.dispatch.agent_id
          : phase === 'prerequisite_analysis'
            ? job.post_milestone.prerequisite_analysis.dispatch.agent_id
            : phase === 'milestone_plan'
              ? job.milestone_plan.dispatch.agent_id
              : job.requirement_document.dispatch.agent_id),
      status,
      note: report.note ?? null,
    };

    let next = clone(job);
    next.updated_at = nowIso();
    if (phase === 'prerequisite_analysis') {
      next.post_milestone.prerequisite_analysis.dispatch.reports = [
        ...next.post_milestone.prerequisite_analysis.dispatch.reports,
        reportEntry,
      ];

      if (status === 'completed' && isCurrentPhaseStatus(job, phase)) {
        next.post_milestone.prerequisite_analysis.document.completion_reason = 'agent_report';
        next.post_milestone.prerequisite_analysis.document.completion_reported_at = reportEntry.at;
        if (job.status === 'post_milestone_dispatched') {
          next = transitionJob(
            next,
            'post_milestone_in_progress',
            reportEntry.agent_id,
            'agent_reported_completion',
            reportEntry.note,
            'post_milestone_orchestration',
          );
          await writeJob(next, job.status);
        } else {
          next.current_stage = 'post_milestone_orchestration';
          await writeJob(next);
        }
        return maybeFinalizePostMilestone(next);
      }

      if (status === 'in_progress' && job.status === 'post_milestone_dispatched') {
        next = transitionJob(
          next,
          'post_milestone_in_progress',
          reportEntry.agent_id,
          'agent_reported_progress',
          reportEntry.note,
          'post_milestone_orchestration',
        );
        await writeJob(next, job.status);
        return next;
      }

      if (status === 'failed' && isCurrentPhaseStatus(job, phase)) {
        addIntervention(next, {
          stage: 'prerequisite_analysis',
          severity: 'warning',
          source: reportEntry.agent_id,
          reason: 'Prerequisite preparer reported failure.',
          recommendation: 'Inspect the prerequisite analysis task and redispatch when ready.',
          note: reportEntry.note,
        });
        next = transitionJob(
          next,
          'failed',
          reportEntry.agent_id,
          'agent_reported_failure',
          reportEntry.note,
          'post_milestone_orchestration',
        );
        await writeJob(next, job.status);
        return next;
      }

      await writeJob(next);
      return next;
    }

    if (phase === 'task_dispatch') {
      next.post_milestone.task_dispatch.dispatch.reports = [
        ...next.post_milestone.task_dispatch.dispatch.reports,
        reportEntry,
      ];

      if (status === 'completed' && isCurrentPhaseStatus(job, phase)) {
        next.post_milestone.task_dispatch.document.completion_reason = 'agent_report';
        next.post_milestone.task_dispatch.document.completion_reported_at = reportEntry.at;
        if (job.status === 'post_milestone_dispatched') {
          next = transitionJob(
            next,
            'post_milestone_in_progress',
            reportEntry.agent_id,
            'agent_reported_completion',
            reportEntry.note,
            'post_milestone_orchestration',
          );
          await writeJob(next, job.status);
        } else {
          next.current_stage = 'post_milestone_orchestration';
          await writeJob(next);
        }
        return maybeFinalizePostMilestone(next);
      }

      if (status === 'in_progress' && job.status === 'post_milestone_dispatched') {
        next = transitionJob(
          next,
          'post_milestone_in_progress',
          reportEntry.agent_id,
          'agent_reported_progress',
          reportEntry.note,
          'post_milestone_orchestration',
        );
        await writeJob(next, job.status);
        return next;
      }

      if (status === 'failed' && isCurrentPhaseStatus(job, phase)) {
        addIntervention(next, {
          stage: 'task_dispatch',
          severity: 'warning',
          source: reportEntry.agent_id,
          reason: 'Task dispatcher reported failure.',
          recommendation: 'Inspect the task planning branch and redispatch when ready.',
          note: reportEntry.note,
        });
        next = transitionJob(
          next,
          'failed',
          reportEntry.agent_id,
          'agent_reported_failure',
          reportEntry.note,
          'post_milestone_orchestration',
        );
        await writeJob(next, job.status);
        return next;
      }

      await writeJob(next);
      return next;
    }

    if (phase === 'workflow_preparation') {
      next.workflow_preparation.dispatch.reports = [
        ...next.workflow_preparation.dispatch.reports,
        reportEntry,
      ];

      if (status === 'completed' && isCurrentPhaseStatus(job, phase)) {
        next.workflow_preparation.document.completion_reason = 'agent_report';
        next.workflow_preparation.document.completion_reported_at = reportEntry.at;
        await writeJob(next);
        return finalizeWorkflowPreparation(next);
      }

      if (status === 'in_progress' && job.status === 'workflow_dispatched') {
        next = transitionJob(
          next,
          'workflow_in_progress',
          reportEntry.agent_id,
          'agent_reported_progress',
          reportEntry.note,
          'workflow_preparation',
        );
        await writeJob(next, job.status);
        return next;
      }

      if (status === 'failed' && isCurrentPhaseStatus(job, phase)) {
        addIntervention(next, {
          stage: 'workflow_preparation',
          severity: 'warning',
          source: reportEntry.agent_id,
          reason: 'Workflow architect reported failure.',
          recommendation: 'Review the workflow plan and retry workflow preparation.',
          note: reportEntry.note,
        });
        next = transitionJob(
          next,
          'failed',
          reportEntry.agent_id,
          'agent_reported_failure',
          reportEntry.note,
          'workflow_preparation',
        );
        await writeJob(next, job.status);
        return next;
      }

      await writeJob(next);
      return next;
    }

    if (phase === 'milestone_plan') {
      next.milestone_plan.dispatch.reports = [
        ...next.milestone_plan.dispatch.reports,
        reportEntry,
      ];

      if (status === 'completed' && isCurrentPhaseStatus(job, phase)) {
        next.milestone_plan.document.completion_reason = 'agent_report';
        next.milestone_plan.document.completion_reported_at = reportEntry.at;
        next = transitionJob(
          next,
          'milestone_ready_for_finalize',
          reportEntry.agent_id,
          'agent_reported_completion',
          reportEntry.note,
          'milestone_plan',
        );
        await writeJob(next, job.status);
        return finalizeMilestones(next);
      }

      if (status === 'in_progress' && job.status === 'milestone_dispatched') {
        next = transitionJob(
          next,
          'milestone_document_in_progress',
          reportEntry.agent_id,
          'agent_reported_progress',
          reportEntry.note,
          'milestone_plan',
        );
        await writeJob(next, job.status);
        return next;
      }

      if (status === 'failed' && isCurrentPhaseStatus(job, phase)) {
        addIntervention(next, {
          stage: 'milestone_plan',
          severity: 'warning',
          source: reportEntry.agent_id,
          reason: 'Milestone planner reported failure.',
          recommendation: 'Revise the milestone planning document and retry milestone planning.',
          note: reportEntry.note,
        });
        next = transitionJob(
          next,
          'failed',
          reportEntry.agent_id,
          'agent_reported_failure',
          reportEntry.note,
          'milestone_plan',
        );
        await writeJob(next, job.status);
        return next;
      }

      await writeJob(next);
      return next;
    }

    next.requirement_document.dispatch.reports = [
      ...next.requirement_document.dispatch.reports,
      reportEntry,
    ];

    if (status === 'completed' && isCurrentPhaseStatus(job, phase)) {
      next.requirement_document.document.completion_reason = 'agent_report';
      next.requirement_document.document.completion_reported_at = reportEntry.at;
      next = transitionJob(
        next,
        'requirement_ready_for_audit',
        reportEntry.agent_id,
        'agent_reported_completion',
        reportEntry.note,
        'requirement_document',
      );
      await writeJob(next, job.status);
      return runAudit(next.id);
    }

    if (status === 'in_progress' && job.status === 'requirement_dispatched') {
      next = transitionJob(
        next,
        'requirement_document_in_progress',
        reportEntry.agent_id,
        'agent_reported_progress',
        reportEntry.note,
        'requirement_document',
      );
      await writeJob(next, job.status);
      return next;
    }

    if (status === 'failed' && isCurrentPhaseStatus(job, phase)) {
      addIntervention(next, {
        stage: 'requirement_document',
        severity: 'warning',
        source: reportEntry.agent_id,
        reason: 'Writer reported failure.',
        recommendation: 'Revise the requirement drafting task and redispatch the writer.',
        note: reportEntry.note,
      });
      next = transitionJob(
        next,
        'failed',
        reportEntry.agent_id,
        'agent_reported_failure',
        reportEntry.note,
        'requirement_document',
      );
      await writeJob(next, job.status);
      return next;
    }

    await writeJob(next);
    return next;
  }

  async function updateIntervention(jobId, body = {}) {
    const job = await readJob(jobId);
    let next = clone(job);

    if (body.action === 'resolve') {
      if (!body.intervention_id) {
        throw new Error('intervention_id is required when resolving an intervention.');
      }
      resolveInterventions(
        next,
        (intervention) => intervention.id === body.intervention_id,
        body.note?.trim() || 'Resolved by operator.',
        body.actor ?? 'operator',
      );
      next.updated_at = nowIso();
      await writeJob(next);
      return next;
    }

    if (body.action === 'create') {
      if (!body.stage || !body.reason) {
        throw new Error('stage and reason are required when creating an intervention.');
      }
      addIntervention(next, {
        stage: body.stage,
        severity: body.severity ?? 'warning',
        source: body.actor ?? 'operator',
        reason: body.reason,
        recommendation: body.recommendation ?? 'Review the stage and decide the next safe action.',
        note: body.note ?? null,
      });
      next.updated_at = nowIso();
      await writeJob(next);
      return next;
    }

    throw new Error('action must be "create" or "resolve".');
  }

  async function dispatchFollowup(jobId, body = {}) {
    const config = await getConfig();
    const agentCards = mapAgentCards(await getAgents(config));
    const job = await readJob(jobId);
    const requirement = await ring.read('requirement', job.requirement_id);
    const selectedInterventions =
      (body.intervention_ids?.length
        ? job.interventions.filter((item) => body.intervention_ids.includes(item.id))
        : job.interventions.filter((item) => item.status === 'open')).length > 0
        ? (body.intervention_ids?.length
            ? job.interventions.filter((item) => body.intervention_ids.includes(item.id))
            : job.interventions.filter((item) => item.status === 'open'))
        : job.interventions.slice(-3);

    const inspection = await ensureDocument(
      job.followup.document.path,
      () => Promise.resolve(buildFollowupScaffold(job, requirement, selectedInterventions)),
    );
    const packet = buildMessageEnvelope(
      job,
      buildFollowupPacket(
        job,
        requirement,
        job.followup.document.path,
        config,
        selectedInterventions,
      ),
      config,
      agentCards,
      [
        {
          kind: 'orchestrator_job',
          id: job.id,
          path: null,
          role: 'source',
        },
        {
          kind: 'followup_requirement_brief',
          id: null,
          path: job.followup.document.path,
          role: 'target',
        },
      ],
    );

    const next = clone(job);
    next.followup.status = 'drafting';
    next.followup.source_intervention_ids = selectedInterventions.map((item) => item.id);
    next.followup.generated_requirement_id = null;
    next.followup.generated_job_id = null;
    next.followup.completed_at = null;
    next.followup.parse_error = null;
    next.followup.dispatch.packet = packet;
    next.followup.dispatch.last_dispatched_at = nowIso();
    next.followup.document.exists = inspection.exists;
    next.followup.document.initial_signature = inspection.signature;
    next.followup.document.current_signature = inspection.signature;
    next.followup.document.last_modified_at = inspection.modified_at;
    next.followup.document.last_activity_at = inspection.modified_at;
    next.followup.document.has_observed_progress = false;
    next.followup.document.completion_reason = null;
    next.followup.document.completion_reported_at = null;
    next.updated_at = nowIso();
    openTraceSpan(next, {
      stage: 'followup_distillation',
      kind: 'dispatch',
      agent_id: config.distiller_agent_id,
      packet_id: packet.id,
      note:
        body.note?.trim() ??
        `${selectedInterventions.length} interventions selected for follow-up distillation.`,
    });
    await writeJob(next);
    return next;
  }

  async function createFollowupRequirement(jobId, body = {}) {
    const job = await readJob(jobId);
    const documentText = await readFile(
      join(repoRoot, job.followup.document.path),
      'utf-8',
    ).catch(() => '');

    try {
      const parsed = parseFollowupRequirement(documentText);
      const created = await createRequirementDispatch({
        ...parsed,
        created_by: body.created_by ?? job.followup.distiller_agent_id ?? 'distiller',
      });

      const next = clone(job);
      next.followup.status = 'completed';
      next.followup.generated_requirement_id = created.requirement.id;
      next.followup.generated_job_id = created.job.id;
      next.followup.completed_at = nowIso();
      next.followup.parse_error = null;
      next.followup.document.completion_reason = 'agent_report';
      next.followup.document.completion_reported_at = nowIso();
      resolveInterventions(
        next,
        (intervention) =>
          next.followup.source_intervention_ids.includes(intervention.id),
        `Follow-up requirement ${created.requirement.id} was created.`,
        body.created_by ?? 'distiller',
      );
      closeTraceStage(
        next,
        'followup_distillation',
        'completed',
        `Follow-up requirement ${created.requirement.id} created from source job ${job.id}.`,
      );
      next.updated_at = nowIso();
      await writeJob(next);
      return {
        source_job: next,
        followup_requirement: created.requirement,
        followup_job: created.job,
      };
    } catch (error) {
      const next = clone(job);
      next.followup.status = 'failed';
      next.followup.parse_error = error instanceof Error ? error.message : String(error);
      addIntervention(next, {
        stage: 'followup_distillation',
        severity: 'warning',
        source: next.followup.distiller_agent_id,
        reason: 'Follow-up brief could not be parsed into a requirement.',
        recommendation: 'Edit the follow-up brief and try creating the requirement again.',
        note: next.followup.parse_error,
      });
      next.updated_at = nowIso();
      await writeJob(next);
      throw error;
    }
  }

  async function applyRequirementInspection(job) {
    const config = await getConfig();
    const inspection = await inspectDocument(job.requirement_document.document.path);
    let next = clone(job);
    next.current_stage = 'requirement_document';
    next.runtime = touchRuntime(next.runtime, config);
    next.requirement_document.document.exists = inspection.exists;
    next.requirement_document.document.last_modified_at = inspection.modified_at;

    if (!inspection.exists) {
      await writeJob(next);
      return next;
    }

    const changed =
      inspection.signature != null &&
      inspection.signature !== next.requirement_document.document.current_signature;

    if (changed) {
      next.requirement_document.document.current_signature = inspection.signature;
      next.requirement_document.document.last_activity_at = inspection.modified_at;
      next.requirement_document.document.has_observed_progress =
        next.requirement_document.document.initial_signature !== inspection.signature;

      if (
        next.requirement_document.document.has_observed_progress &&
        next.status === 'requirement_dispatched'
      ) {
        next = transitionJob(
          next,
          'requirement_document_in_progress',
          'dispatcher',
          'document_changed',
          null,
          'requirement_document',
        );
      }
    }

    const completionAnchor = next.requirement_document.document.last_activity_at;
    const idleDuration =
      completionAnchor != null
        ? Date.now() - new Date(completionAnchor).getTime()
        : 0;

    if (
      next.requirement_document.document.completion_reason === 'agent_report' &&
      ['requirement_dispatched', 'requirement_document_in_progress'].includes(
        next.status,
      )
    ) {
      next = transitionJob(
        next,
        'requirement_ready_for_audit',
        'dispatcher',
        'agent_report_acknowledged',
        null,
        'requirement_document',
      );
    } else if (
      next.requirement_document.document.has_observed_progress &&
      next.status === 'requirement_document_in_progress' &&
      idleDuration >= config.document_idle_threshold_ms
    ) {
      next.requirement_document.document.completion_reason = 'idle_timeout';
      next.requirement_document.document.completion_reported_at = nowIso();
      next = transitionJob(
        next,
        'requirement_ready_for_audit',
        'dispatcher',
        'document_idle_timeout',
        null,
        'requirement_document',
      );
    }

    await writeJob(next);

    if (next.status === 'requirement_ready_for_audit') {
      return runAudit(next);
    }

    return next;
  }

  async function applyMilestoneInspection(job) {
    const config = await getConfig();
    const inspection = await inspectDocument(job.milestone_plan.document.path);
    let next = clone(job);
    next.current_stage = 'milestone_plan';
    next.runtime = touchRuntime(next.runtime, config);
    next.milestone_plan.document.exists = inspection.exists;
    next.milestone_plan.document.last_modified_at = inspection.modified_at;

    if (!inspection.exists) {
      await writeJob(next);
      return next;
    }

    const changed =
      inspection.signature != null &&
      inspection.signature !== next.milestone_plan.document.current_signature;

    if (changed) {
      next.milestone_plan.document.current_signature = inspection.signature;
      next.milestone_plan.document.last_activity_at = inspection.modified_at;
      next.milestone_plan.document.has_observed_progress =
        next.milestone_plan.document.initial_signature !== inspection.signature;

      if (
        next.milestone_plan.document.has_observed_progress &&
        next.status === 'milestone_dispatched'
      ) {
        next = transitionJob(
          next,
          'milestone_document_in_progress',
          'dispatcher',
          'document_changed',
          null,
          'milestone_plan',
        );
      }
    }

    const completionAnchor = next.milestone_plan.document.last_activity_at;
    const idleDuration =
      completionAnchor != null
        ? Date.now() - new Date(completionAnchor).getTime()
        : 0;

    if (
      next.milestone_plan.document.completion_reason === 'agent_report' &&
      ['milestone_dispatched', 'milestone_document_in_progress'].includes(
        next.status,
      )
    ) {
      next = transitionJob(
        next,
        'milestone_ready_for_finalize',
        'dispatcher',
        'agent_report_acknowledged',
        null,
        'milestone_plan',
      );
    } else if (
      next.milestone_plan.document.has_observed_progress &&
      next.status === 'milestone_document_in_progress' &&
      idleDuration >= config.document_idle_threshold_ms
    ) {
      next.milestone_plan.document.completion_reason = 'idle_timeout';
      next.milestone_plan.document.completion_reported_at = nowIso();
      next = transitionJob(
        next,
        'milestone_ready_for_finalize',
        'dispatcher',
        'document_idle_timeout',
        null,
        'milestone_plan',
      );
    }

    await writeJob(next);

    if (next.status === 'milestone_ready_for_finalize') {
      return finalizeMilestones(next);
    }

    return next;
  }

  async function applyPostMilestoneInspection(job) {
    const config = await getConfig();
    const prerequisiteInspection = await inspectDocument(
      job.post_milestone.prerequisite_analysis.document.path,
    );

    let next = clone(job);
    next.current_stage = 'post_milestone_orchestration';
    next.runtime = touchRuntime(next.runtime, config);

    const branches = [next.post_milestone.prerequisite_analysis.document];
    const inspections = [prerequisiteInspection];
    let observedProgress = false;

    for (const [index, inspection] of inspections.entries()) {
      const document = branches[index];
      document.exists = inspection.exists;
      document.last_modified_at = inspection.modified_at;

      if (!inspection.exists) {
        continue;
      }

      const changed =
        inspection.signature != null &&
        inspection.signature !== document.current_signature;

      if (changed) {
        document.current_signature = inspection.signature;
        document.last_activity_at = inspection.modified_at;
        document.has_observed_progress =
          document.initial_signature !== inspection.signature;
        observedProgress = observedProgress || document.has_observed_progress;
      }

      const completionAnchor = document.last_activity_at;
      const idleDuration =
        completionAnchor != null
          ? Date.now() - new Date(completionAnchor).getTime()
          : 0;

      if (
        document.has_observed_progress &&
        !document.completion_reason &&
        idleDuration >= config.document_idle_threshold_ms
      ) {
        document.completion_reason = 'idle_timeout';
        document.completion_reported_at = nowIso();
      }
    }

    if (job.status === 'post_milestone_dispatched' && observedProgress) {
      next = transitionJob(
        next,
        'post_milestone_in_progress',
        'dispatcher',
        'branch_progress_observed',
        null,
        'post_milestone_orchestration',
      );
      await writeJob(next, job.status);
    } else {
      await writeJob(next);
    }

    return maybeFinalizePostMilestone(next);
  }

  async function applyWorkflowPreparationInspection(job) {
    const config = await getConfig();
    const inspection = await inspectDocument(job.workflow_preparation.document.path);
    let next = clone(job);
    next.current_stage = 'workflow_preparation';
    next.runtime = touchRuntime(next.runtime, config);
    next.workflow_preparation.document.exists = inspection.exists;
    next.workflow_preparation.document.last_modified_at = inspection.modified_at;

    if (!inspection.exists) {
      await writeJob(next);
      return next;
    }

    const changed =
      inspection.signature != null &&
      inspection.signature !== next.workflow_preparation.document.current_signature;

    if (changed) {
      next.workflow_preparation.document.current_signature = inspection.signature;
      next.workflow_preparation.document.last_activity_at = inspection.modified_at;
      next.workflow_preparation.document.has_observed_progress =
        next.workflow_preparation.document.initial_signature !== inspection.signature;

      if (
        next.workflow_preparation.document.has_observed_progress &&
        next.status === 'workflow_dispatched'
      ) {
        next = transitionJob(
          next,
          'workflow_in_progress',
          SESSION_DISPATCHER_ID,
          'document_changed',
          null,
          'workflow_preparation',
        );
      }
    }

    const completionAnchor = next.workflow_preparation.document.last_activity_at;
    const idleDuration =
      completionAnchor != null
        ? Date.now() - new Date(completionAnchor).getTime()
        : 0;

    if (
      next.workflow_preparation.document.completion_reason === 'agent_report' ||
      (
        next.workflow_preparation.document.has_observed_progress &&
        ['workflow_dispatched', 'workflow_in_progress'].includes(next.status) &&
        idleDuration >= config.document_idle_threshold_ms
      )
    ) {
      if (!next.workflow_preparation.document.completion_reason) {
        next.workflow_preparation.document.completion_reason = 'idle_timeout';
        next.workflow_preparation.document.completion_reported_at = nowIso();
      }
      await writeJob(next, changed && job.status !== next.status ? job.status : undefined);
      return finalizeWorkflowPreparation(next);
    }

    if (changed && job.status !== next.status) {
      await writeJob(next, job.status);
      return next;
    }

    await writeJob(next);
    return next;
  }

  async function retryJob(jobId) {
    const job = await readJob(jobId);
    if (
      ![
        'requirement_rework_required',
        'milestone_rework_required',
        'post_milestone_rework_required',
        'workflow_rework_required',
        'failed',
      ].includes(job.status)
    ) {
      throw new Error(`Job ${jobId} cannot be retried from status ${job.status}.`);
    }

    const targetPhase =
      job.current_stage === 'session_dispatch'
        ? 'session_dispatch'
        : job.status === 'workflow_rework_required' ||
      (job.status === 'failed' && job.current_stage === 'workflow_preparation')
        ? 'workflow_preparation'
        : job.status === 'post_milestone_rework_required' ||
      (job.status === 'failed' && job.current_stage === 'post_milestone_orchestration')
        ? 'post_milestone_orchestration'
        : job.status === 'milestone_rework_required' ||
          (job.status === 'failed' && job.current_stage === 'milestone_plan')
        ? 'milestone_plan'
        : 'requirement_document';

    if (targetPhase === 'session_dispatch') {
      if (job.adaptive_dispatch?.bundle_id) {
        const bundle = await readDispatchBundle(job.adaptive_dispatch.bundle_id).catch(
          () => null,
        );
        if (
          bundle
          && ['launch_failed', 'session_batched', 'ready_queued', 'session_launched'].includes(bundle.status)
        ) {
          const nextBundle = clone(bundle);
          const previousStatus = nextBundle.status;
          if (previousStatus === 'launch_failed') {
            nextBundle.batching.status = 'queued';
            nextBundle.batching.error = null;
            nextBundle.errors = nextBundle.errors.filter(
              (item) => item.code !== 'dispatch_bundle_error' || item.message !== bundle.errors.at(-1)?.message,
            );
            appendDispatchBundleHistory(
              nextBundle,
              'ready_queued',
              DISPATCH_CENTER_ID,
              'adaptive_bundle_retry_requested',
              'Retry requested by operator.',
            );
            await writeDispatchBundle(nextBundle, previousStatus);
          }
          const next = clone(job);
          resolveInterventions(
            next,
            (intervention) => intervention.stage === 'session_dispatch',
            'Adaptive dispatcher retry requested.',
          );
          await writeJob(next);
          return syncJobFromAdaptiveBundle(next, await readDispatchBundle(nextBundle.id));
        }
      }
      const next = clone(job);
      resolveInterventions(
        next,
        (intervention) => intervention.stage === 'session_dispatch',
        'Session dispatch retry requested.',
      );
      await writeJob(next);
      return launchSessionBatch(next);
    }

    return targetPhase === 'workflow_preparation'
      ? dispatchWorkflowPreparation(job, 'Retry requested by operator.')
      : targetPhase === 'post_milestone_orchestration'
      ? dispatchPostMilestoneOrchestration(job, 'Retry requested by operator.')
      : targetPhase === 'milestone_plan'
      ? dispatchMilestonePlanning(job, 'Retry requested by operator.')
      : dispatchRequirementDocument(job, 'Retry requested by operator.');
  }

  async function tick() {
    if (ticking) {
      return { ok: true, skipped: true, processed: [] };
    }

    ticking = true;
    try {
      const jobs = await listJobs();
      const processed = [];

      for (const job of jobs) {
        if (
          [
            'session_dispatched',
            'failed',
            'requirement_rework_required',
            'milestone_rework_required',
            'post_milestone_rework_required',
            'workflow_rework_required',
          ].includes(job.status)
        ) {
          continue;
        }

        if (job.status === 'queued') {
          processed.push(await dispatchRequirementDocument(job));
          continue;
        }

        if (
          ['requirement_dispatched', 'requirement_document_in_progress'].includes(
            job.status,
          )
        ) {
          processed.push(await applyRequirementInspection(job));
          continue;
        }

        if (job.status === 'requirement_ready_for_audit') {
          processed.push(await runAudit(job));
          continue;
        }

        if (
          ['milestone_dispatched', 'milestone_document_in_progress'].includes(
            job.status,
          )
        ) {
          processed.push(await applyMilestoneInspection(job));
          continue;
        }

        if (job.status === 'milestone_ready_for_finalize') {
          processed.push(await finalizeMilestones(job));
          continue;
        }

        if (job.status === 'milestones_ready') {
          processed.push(await dispatchPostMilestoneOrchestration(job));
          continue;
        }

        if (
          ['post_milestone_dispatched', 'post_milestone_in_progress'].includes(
            job.status,
          )
        ) {
          processed.push(await applyPostMilestoneInspection(job));
          continue;
        }

        if (
          ['workflow_dispatched', 'workflow_in_progress'].includes(job.status)
        ) {
          processed.push(await applyWorkflowPreparationInspection(job));
          continue;
        }

        if (job.status === 'waiting_for_session_dispatch') {
          processed.push(await launchSessionBatch(job));
        }
      }

      const processedBundles = await launchReadyDispatchBundles();
      const hookResults = [];
      for (const hook of tickHooks) {
        hookResults.push(
          await hook({
            processed,
            processed_bundles: processedBundles,
          }),
        );
      }

      return {
        ok: true,
        skipped: false,
        processed,
        processed_bundles: processedBundles,
        hook_results: hookResults,
      };
    } finally {
      ticking = false;
    }
  }

  function registerTickHook(hook) {
    tickHooks.add(hook);
    return () => {
      tickHooks.delete(hook);
    };
  }

  async function start() {
    const config = await getConfig();
    if (timer) {
      return config;
    }

    timer = setInterval(() => {
      void tick().catch(async (error) => {
        const jobs = await listJobs();
        for (const job of jobs) {
          if (['session_dispatched', 'failed'].includes(job.status)) continue;
          const next = clone(job);
          next.runtime.last_error = error.message ?? String(error);
          next.updated_at = nowIso();
          await writeJob(next);
        }
      });
    }, config.poll_interval_ms);

    void tick();
    return config;
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    getConfig,
    updateConfig,
    getAgents,
    getWorkers,
    getDispatchProtocols,
    listJobs,
    readJob,
    listDispatchBundles,
    readDispatchBundle,
    submitDispatchBundle,
    reportDispatchBundle,
    createRequirementDispatch,
    reportAgent,
    updateIntervention,
    dispatchFollowup,
    createFollowupRequirement,
    retryJob,
    runAudit,
    tick,
    registerTickHook,
    start,
    stop,
    stateMachine: clone(JOB_STATE_MACHINE),
    orchestratorDir,
    agentsPath,
    workersPath,
    jobsDir,
    bundlesDir,
  };
}
