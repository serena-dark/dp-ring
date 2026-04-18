import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import {
  createCheckpoint,
  continueFromCheckpoint,
  lineageForCheckpoint,
  synthesizeCheckpoint,
} from './checkpoint-tree.mjs';
import {
  createEmptyCapsuleState,
  recordCheckpoint,
  acquireLease,
  renewLease,
  leaseExpired,
  expireLease,
  recordHeartbeat,
  attachEvidence,
  requestReplay,
  completeReplay,
} from './node-capsule.mjs';
import { warmSemanticLineageState } from './governance-policy.mjs';

const DEFAULT_RUNNER_CONFIG = {
  report_timeout_ms: 120_000,
  max_report_retries: 2,
  retry_backoff_ms: 30_000,
  signature_ttl_ms: 300_000,
};
const RING_REPORT_PROTOCOL = 'ring.workflow-run-report.v1';
const A2A_REPORT_PROTOCOL = 'a2a.task-status.v1';
const CALLBACK_TOKEN_BYTES = 16;
const CALLBACK_SECRET_BYTES = 32;

class WorkflowRunReportError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = 'WorkflowRunReportError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function plusMs(base, amount) {
  return new Date(Date.parse(base) + amount).toISOString();
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === 'string' && value.trim()))];
}

function trimString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeRunnerConfig(config = {}) {
  return {
    ...DEFAULT_RUNNER_CONFIG,
    ...(config.session_runner ?? {}),
  };
}

function headerValue(headers, name) {
  const value = headers?.[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

function callbackSignaturePayload(timestamp, payload) {
  return `${timestamp}.${JSON.stringify(payload ?? {})}`;
}

function computeCallbackSignature(secret, timestamp, payload) {
  return createHmac('sha256', secret)
    .update(callbackSignaturePayload(timestamp, payload))
    .digest('hex');
}

function signaturesMatch(expected, actual) {
  const left = Buffer.from(expected, 'utf-8');
  const right = Buffer.from(actual, 'utf-8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function callbackToken() {
  return randomBytes(CALLBACK_TOKEN_BYTES).toString('hex');
}

function callbackSecret() {
  return randomBytes(CALLBACK_SECRET_BYTES).toString('hex');
}

function activeWorkers(workers = []) {
  return workers.filter((worker) => (worker?.status ?? 'active') === 'active');
}

function workerSupportsProtocol(worker, protocol) {
  return Array.isArray(worker?.callback_protocols) && worker.callback_protocols.includes(protocol);
}

function mapWorkerReportStatus(value) {
  const lowered = String(value ?? '').trim().toLowerCase();
  if (['progress', 'running', 'working', 'in_progress', 'in-progress', 'input-required'].includes(lowered)) {
    return 'progress';
  }
  if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(lowered)) {
    return 'completed';
  }
  if (['failed', 'failure', 'error', 'cancelled', 'canceled', 'rejected'].includes(lowered)) {
    return 'failed';
  }
  return null;
}

function artifactCommitSha(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return null;
  }
  if (typeof artifact.commit_sha === 'string' && artifact.commit_sha.trim()) {
    return artifact.commit_sha.trim();
  }
  if (
    artifact.metadata &&
    typeof artifact.metadata === 'object' &&
    typeof artifact.metadata.commit_sha === 'string' &&
    artifact.metadata.commit_sha.trim()
  ) {
    return artifact.metadata.commit_sha.trim();
  }
  if (typeof artifact.uri === 'string') {
    const match = artifact.uri.match(/^git\+commit:\/\/(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function normalizeWorkerReport(payload = {}, meta = {}) {
  const transportProtocol =
    typeof payload.protocol === 'string' && payload.protocol.trim()
      ? payload.protocol.trim()
      : typeof payload.envelope_protocol === 'string' && payload.envelope_protocol.trim()
        ? payload.envelope_protocol.trim()
        : null;
  const looksA2A =
    transportProtocol?.startsWith('a2a.') ||
    (payload.task && typeof payload.task === 'object');

  if (!looksA2A) {
    return {
      protocol: RING_REPORT_PROTOCOL,
      report: {
        status: mapWorkerReportStatus(payload.status),
        step_id: payload.step_id ?? null,
        actor: String(payload.actor ?? payload.worker_id ?? headerValue(meta.headers, 'x-ring-worker-id') ?? 'external-worker'),
        worker_id: String(
          payload.worker_id ??
            headerValue(meta.headers, 'x-ring-worker-id') ??
            payload.actor ??
            '',
        ).trim() || null,
        note: payload.note ?? null,
        commit_sha: payload.commit_sha != null ? String(payload.commit_sha).trim() : null,
        outputs:
          payload.outputs && typeof payload.outputs === 'object' && !Array.isArray(payload.outputs)
            ? clone(payload.outputs)
            : {},
        judge_agent_id: payload.judge_agent_id ?? null,
      },
      envelope: null,
    };
  }

  const task = payload.task && typeof payload.task === 'object' ? payload.task : {};
  const rawStatus = task.status;
  const mappedStatus =
    typeof rawStatus === 'string'
      ? mapWorkerReportStatus(rawStatus)
      : rawStatus && typeof rawStatus === 'object'
        ? mapWorkerReportStatus(rawStatus.state ?? rawStatus.status ?? rawStatus.value)
        : null;
  const artifacts = Array.isArray(task.artifacts) ? clone(task.artifacts) : [];
  const metadata = task.metadata && typeof task.metadata === 'object' ? task.metadata : {};
  const outputs = {
    ...(metadata.outputs && typeof metadata.outputs === 'object' && !Array.isArray(metadata.outputs)
      ? clone(metadata.outputs)
      : {}),
  };
  if (artifacts.length > 0) {
    outputs.artifacts = artifacts;
  }
  const commitSha =
    artifacts.map((artifact) => artifactCommitSha(artifact)).find(Boolean) ??
    (typeof metadata.commit_sha === 'string' && metadata.commit_sha.trim()
      ? metadata.commit_sha.trim()
      : null) ??
    (payload.commit_sha != null ? String(payload.commit_sha).trim() : null);
  const workerId =
    (payload.worker && typeof payload.worker === 'object' && typeof payload.worker.id === 'string'
      ? payload.worker.id
      : null) ??
    (typeof metadata.worker_id === 'string' ? metadata.worker_id : null) ??
    headerValue(meta.headers, 'x-ring-worker-id') ??
    (typeof payload.actor === 'string' ? payload.actor : null);
  return {
    protocol: transportProtocol ?? A2A_REPORT_PROTOCOL,
    report: {
      status: mappedStatus,
      step_id: metadata.step_id ?? task.step_id ?? payload.step_id ?? null,
      actor:
        (payload.worker && typeof payload.worker === 'object' && typeof payload.worker.display_name === 'string'
          ? payload.worker.display_name
          : null) ??
        workerId ??
        (typeof metadata.actor === 'string' ? metadata.actor : null) ??
        'external-worker',
      worker_id: typeof workerId === 'string' && workerId.trim() ? workerId.trim() : null,
      note:
        payload.note ??
        (rawStatus && typeof rawStatus === 'object'
          ? rawStatus.message ?? rawStatus.detail ?? null
          : null) ??
        task.message ??
        (typeof metadata.note === 'string' ? metadata.note : null) ??
        null,
      commit_sha: commitSha,
      outputs,
      judge_agent_id: metadata.judge_agent_id ?? payload.judge_agent_id ?? null,
    },
    envelope: {
      task_id: task.id ?? null,
      task_kind: task.kind ?? null,
    },
  };
}

function taskDocumentPath(taskId) {
  return join('docs', 'tasks', taskId, `${taskId}.md`);
}

function appendLog(session, entry) {
  return {
    ...session,
    data: {
      ...session.data,
      execution_log: [
        ...(session.data.execution_log ?? []),
        entry,
      ],
    },
  };
}

function emptyCallbackState(config = DEFAULT_RUNNER_CONFIG) {
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
    report_timeout_ms: config.report_timeout_ms,
    max_retries: config.max_report_retries,
    retry_count: 0,
    retry_backoff_ms: config.retry_backoff_ms,
    signature_ttl_ms: config.signature_ttl_ms,
    timeout_at: null,
    packet_path: null,
    allowed_worker_ids: [],
    accepted_protocols: [RING_REPORT_PROTOCOL],
    last_worker_id: null,
    last_protocol: null,
    last_error: null,
  };
}

function appendRunReport(run, report) {
  return {
    ...run,
    data: {
      ...run.data,
      reports: [
        ...(run.data.reports ?? []),
        report,
      ],
    },
  };
}

function contractSchema(schema, description) {
  return {
    kind: 'json_schema',
    schema,
    description: description ?? null,
    notes: null,
  };
}

function workflowRunNodeExecution() {
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

function workflowRunNodeArtifact(nodeId, sessionId, run, task, workflow, now) {
  return {
    id: nodeId,
    type: 'node',
    version: 1,
    created_at: now,
    updated_at: now,
    created_by: 'session-runner',
    session_id: sessionId,
    status: 'active',
    data: {
      node_type: 'workflow-run-executor',
      interface_version: 'node.interface.v1',
      input_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['workflow_run_id', 'task_id', 'packet_path'],
          properties: {
            workflow_run_id: { type: 'string' },
            task_id: { type: 'string' },
            packet_path: { type: 'string' },
          },
        },
        'Execution capsule input for a prepared workflow run.',
      ),
      output_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: {
            status: { type: 'string' },
            commit_sha: { type: ['string', 'null'] },
            outputs: { type: ['object', 'null'] },
            note: { type: ['string', 'null'] },
          },
        },
        'Normalized workflow-run report envelope seen by the global tree.',
      ),
      evidence_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['evidence_refs'],
          properties: {
            evidence_refs: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'ref'],
                properties: {
                  kind: { type: 'string' },
                  ref: { type: 'string' },
                  digest: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
        'Evidence references exported from the node boundary.',
      ),
      capability_summary: {
        purpose: 'Execute a workflow-run through a stable node-facing execution capsule.',
        responsibilities: [
          'Accept prepared execution packets.',
          'Emit normalized workflow-run reports.',
          'Expose semantic checkpoints and evidence refs to the global tree.',
        ],
        limits: [
          'Does not expose local worker internals beyond the published contract.',
        ],
      },
      governance_profile: {
        owner: 'session-runner',
        decision_policy: 'report-normalization',
        escalation_policy: 'task-judge',
        change_control: {
          requires_review: true,
          allows_internal_heterogeneity: true,
        },
      },
      checkpoint_policy: {
        strategy: 'on_decision',
        retention: 'rolling',
        evidence_binding: 'required',
        max_snapshots: 16,
      },
      runtime: {
        boundary_mode: 'contract_projection',
        tree_projection: 'contract_plus_summary',
        internals: {
          visibility: 'summarized',
          heterogeneous: true,
        },
        rag_profile: null,
        capsule_state: createEmptyCapsuleState({
          node_id: nodeId,
          runtime_status: 'prepared',
          current_checkpoint_id: null,
        }),
      },
    },
  };
}

function workflowRunPolicySnapshot(task, governance = null) {
  if (governance?.tightenedDispatch) {
    return {
      workflow_tightness: trimString(governance.workflowTightness) ?? 'tight',
      oversight_strength: trimString(governance.oversightStrength) ?? 'strong',
      branch_budget:
        typeof governance.branchBudget === 'number' && Number.isFinite(governance.branchBudget)
          ? governance.branchBudget
          : null,
      notes: trimString(governance.note) ?? null,
    };
  }
  return {
    workflow_tightness: task.data.execution_mode === 'parallel' ? 'loose' : 'balanced',
    oversight_strength: 'normal',
    branch_budget: null,
    notes: null,
  };
}

function workflowRunRecencyValue(run) {
  const parsed = Date.parse(run?.updated_at ?? run?.created_at ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestWorkflowRunsByTemplate(workflowRuns = []) {
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

async function mainlineCheckpointReuseDispatchGovernanceContext(
  ring,
  workflowRun,
  latestPriorWorkflowRunsByTemplate = new Map(),
) {
  const workflowTemplateId = trimString(workflowRun?.data?.workflow_template_id);
  const priorRun = workflowTemplateId
    ? latestPriorWorkflowRunsByTemplate.get(workflowTemplateId) ?? null
    : null;
  const workflowRunId = trimString(priorRun?.id);
  if (!workflowTemplateId || !priorRun || priorRun.status !== 'completed') {
    return {
      source: null,
      reasons: [],
      workflowRunId,
      checkpointId: null,
      adoptionStatus: null,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
    };
  }

  const checkpointId = trimString(priorRun?.data?.node_execution?.active_checkpoint_id);
  if (!checkpointId) {
    return {
      source: null,
      reasons: [],
      workflowRunId,
      checkpointId: null,
      adoptionStatus: null,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
    };
  }

  const checkpoint = await ring.read('checkpoint', checkpointId).catch(() => null);
  const adoptionStatus = trimString(checkpoint?.data?.adoption_status);
  const workflowTightness = trimString(checkpoint?.data?.policy_snapshot?.workflow_tightness) ?? 'balanced';
  const oversightStrength = trimString(checkpoint?.data?.policy_snapshot?.oversight_strength) ?? 'normal';
  const inheritedBranchBudget =
    Number.isInteger(checkpoint?.data?.policy_snapshot?.branch_budget)
      && checkpoint.data.policy_snapshot.branch_budget >= 0
      ? checkpoint.data.policy_snapshot.branch_budget
      : null;
  const branchBudget = inheritedBranchBudget === null ? null : Math.max(inheritedBranchBudget - 1, 0);
  const tightenedDispatch = adoptionStatus === 'mainline'
    && (workflowTightness !== 'balanced' || oversightStrength !== 'normal' || inheritedBranchBudget !== null);
  const inheritedNote = trimString(checkpoint?.data?.policy_snapshot?.notes);

  if (!tightenedDispatch) {
    return {
      source: null,
      reasons: [],
      workflowRunId,
      checkpointId,
      adoptionStatus,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
    };
  }

  const policyLabels = [
    workflowTightness !== 'balanced' ? `${workflowTightness} workflow_tightness` : null,
    oversightStrength !== 'normal' ? `${oversightStrength} oversight` : null,
    inheritedBranchBudget !== null ? `branch_budget=${inheritedBranchBudget}` : null,
  ].filter(Boolean);

  return {
    source: 'mainline_checkpoint_policy',
    reasons: ['mainline_checkpoint_policy'],
    workflowRunId,
    checkpointId,
    adoptionStatus,
    tightenedDispatch: true,
    workflowTightness,
    oversightStrength,
    branchBudget,
    note:
      `Inherited mainline checkpoint policy from ${checkpointId} on workflow run ${workflowRunId}`
      + `${policyLabels.length ? ` (${policyLabels.join(', ')})` : ''}.`
      + `${inheritedBranchBudget !== null
        ? ` Automatic reuse consumed one branch slot, leaving branch_budget=${branchBudget}.`
        : ''}`
      + `${inheritedNote ? ` Prior checkpoint note: ${inheritedNote}` : ''}`,
  };
}

async function semanticCheckpointDispatchGovernanceContext(ring, task) {
  const parentTaskId = trimString(task?.data?.replanning?.parent_task_id);
  if (!parentTaskId) {
    return {
      source: null,
      reasons: [],
      parentTaskId: null,
      workflowRunId: null,
      checkpointCount: 0,
      replayStatus: 'idle',
      sawProgressReport: false,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
    };
  }

  const parentTask = await ring.read('task', parentTaskId).catch(() => null);
  const workflowRunId = trimString(parentTask?.data?.workflow_run_id);
  if (parentTask?.data?.replanning?.source_failure !== 'workflow_timeout' || !workflowRunId) {
    return {
      source: null,
      reasons: [],
      parentTaskId,
      workflowRunId,
      checkpointCount: 0,
      replayStatus: 'idle',
      sawProgressReport: false,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
    };
  }

  const workflowRun = await ring.read('workflow-run', workflowRunId).catch(() => null);
  const governance = warmSemanticLineageState(workflowRun);

  return {
    source: 'warm_semantic_lineage',
    reasons: ['warm_semantic_lineage'],
    parentTaskId,
    workflowRunId,
    checkpointCount: governance.checkpointCount,
    replayStatus: governance.replayStatus,
    sawProgressReport: governance.sawProgressReport,
    tightenedDispatch: governance.hasWarmSemanticLineage,
    workflowTightness: 'tight',
    oversightStrength: 'strong',
    branchBudget: 0,
    note: `Tightened dispatch after warm semantic checkpoint lineage on ${workflowRunId}.`,
  };
}

function governanceBlockedReuseDispatchContext(session) {
  const context = session?.data?.governance_context;
  const source = trimString(context?.source);
  const reasons = uniqueStrings([
    ...(Array.isArray(context?.reasons) ? context.reasons : []),
    ...((Array.isArray(context?.blocked_reuse) ? context.blocked_reuse : [])
      .map((item) => trimString(item?.reason))
      .filter(Boolean)),
  ]);
  if (source !== 'governance_blocked_reuse' || reasons.length === 0) {
    return {
      source,
      reasons,
      tightenedDispatch: false,
      workflowTightness: null,
      oversightStrength: null,
      branchBudget: null,
      note: null,
      summary: null,
    };
  }

  const summary = trimString(context?.batch_signature) ?? reasons.join(', ');
  return {
    source,
    reasons,
    tightenedDispatch: true,
    workflowTightness: 'tight',
    oversightStrength: 'strong',
    branchBudget: null,
    note:
      `Tightened dispatch for governance-blocked fallback session (${summary}) `
      + 'after automatic workflow reuse was withheld.',
    summary,
  };
}

function governanceBlockedReuseCompletionContext(session) {
  const dispatchContext = governanceBlockedReuseDispatchContext(session);
  if (!dispatchContext.tightenedDispatch) {
    return {
      preserveSynthesizedLineage: false,
      note: null,
    };
  }

  return {
    preserveSynthesizedLineage: true,
    note:
      `Governance-blocked fallback completion (${dispatchContext.summary ?? dispatchContext.reasons.join(', ')}) `
      + 'stays on synthesized lineage until an explicit adoption decision promotes it to mainline.',
  };
}

async function semanticCheckpointTimeoutTerminalContext(ring, task, run) {
  const parentTaskId = trimString(task?.data?.replanning?.parent_task_id);
  const activeCheckpointId = trimString(run?.data?.node_execution?.active_checkpoint_id);
  if (!parentTaskId || !activeCheckpointId) {
    return {
      parentTaskId,
      activeCheckpointId,
      branchBudget: null,
      terminalOnTimeout: false,
    };
  }

  const activeCheckpoint = await ring.read('checkpoint', activeCheckpointId).catch(() => null);
  const branchBudget = activeCheckpoint?.data?.policy_snapshot?.branch_budget ?? null;

  return {
    parentTaskId,
    activeCheckpointId,
    branchBudget,
    terminalOnTimeout: branchBudget === 0,
  };
}

function applyGovernanceDispatchPolicy(callback, workers, automationConfig = {}, governance = null) {
  if (!governance?.tightenedDispatch) {
    return callback;
  }

  const preferredProtocol =
    trimString(automationConfig.default_callback_protocol) ?? RING_REPORT_PROTOCOL;
  const preferredWorkerId = trimString(automationConfig.worker_id);

  let eligibleWorkers = workers.filter((worker) => workerSupportsProtocol(worker, preferredProtocol));
  if (preferredWorkerId) {
    const preferredWorker = eligibleWorkers.find((worker) => worker.id === preferredWorkerId) ?? null;
    if (preferredWorker) {
      eligibleWorkers = [preferredWorker];
    }
  }

  const acceptedProtocols = [preferredProtocol];
  if (eligibleWorkers.length === 0) {
    eligibleWorkers = workers.filter((worker) => workerSupportsProtocol(worker, RING_REPORT_PROTOCOL));
    acceptedProtocols[0] = RING_REPORT_PROTOCOL;
  }

  if (eligibleWorkers.length === 0) {
    return {
      ...callback,
      max_retries: 0,
    };
  }

  return {
    ...callback,
    allowed_worker_ids: eligibleWorkers.map((worker) => worker.id),
    accepted_protocols: acceptedProtocols,
    max_retries: 0,
  };
}

function hasSemanticTimeoutLineage(run) {
  const nodeExecution = run.data.node_execution ?? workflowRunNodeExecution();
  return (nodeExecution.checkpoint_ids?.length ?? 0) > 1;
}

function checkpointEvidenceRefsFromRun(run) {
  const refs = [];
  const packetPath = run.data.callback?.packet_path;
  if (packetPath) {
    refs.push({ kind: 'execution_packet', ref: packetPath, digest: null });
  }
  return refs;
}

function checkpointEvidenceRefsFromReport(normalizedReport, callback) {
  const refs = [];
  if (normalizedReport.report.commit_sha) {
    refs.push({ kind: 'git_commit', ref: String(normalizedReport.report.commit_sha).trim(), digest: null });
  }
  for (const artifact of normalizedReport.report.outputs?.artifacts ?? []) {
    const ref = artifact?.uri ?? artifact?.path ?? null;
    if (typeof ref === 'string' && ref.trim()) {
      refs.push({ kind: artifact.kind ?? 'artifact', ref: ref.trim(), digest: null });
    }
  }
  if (callback?.packet_path) {
    refs.push({ kind: 'execution_packet', ref: callback.packet_path, digest: null });
  }
  return refs;
}

async function appendBranchEvent(ring, fields) {
  const id = await ring.newId('branch-event', { name: fields.event_type.replace(/_/g, ' ') });
  const createdAt = fields.occurred_at ?? nowIso();
  const result = await ring.create('branch-event', {
    id,
    status: 'recorded',
    created_by: fields.actor ?? 'session-runner',
    session_id: fields.session_id ?? null,
    data: {
      event_type: fields.event_type,
      branch_id: fields.branch_id,
      checkpoint_id: fields.checkpoint_id,
      actor: fields.actor ?? 'session-runner',
      occurred_at: createdAt,
      details: {
        parent_checkpoint_id: fields.parent_checkpoint_id ?? null,
        synthesis_inputs: clone(fields.synthesis_inputs ?? []),
        reason: fields.reason ?? null,
      },
    },
  });
  if (!result.ok) {
    throw new Error(`Branch event creation failed: ${JSON.stringify(result.errors)}`);
  }
  return result.artifact;
}

export function createSessionRunner(
  repoRoot,
  ring,
  {
    orchestrator,
    taskExecution,
  },
) {
  const runnerDir = join(orchestrator.orchestratorDir, 'runner');

  async function writeSession(session, nextStatus = null) {
    const patch = {
      data: session.data,
    };
    if (nextStatus) {
      patch.status = nextStatus;
    }
    const result = await ring.update('session', session.id, patch);
    if (!result.ok) {
      throw new Error(`Session update failed for ${session.id}: ${JSON.stringify(result.errors)}`);
    }
    return result.artifact;
  }

  async function writeWorkflowRun(run, nextStatus = null) {
    const patch = {
      data: run.data,
    };
    if (nextStatus) {
      patch.status = nextStatus;
    }
    const result = await ring.update('workflow-run', run.id, patch);
    if (!result.ok) {
      throw new Error(`Workflow run update failed for ${run.id}: ${JSON.stringify(result.errors)}`);
    }
    return result.artifact;
  }

  async function listBundlesIndexedByTaskId() {
    const bundles = await orchestrator.listDispatchBundles();
    const index = new Map();
    for (const bundle of bundles) {
      for (const taskId of bundle.planning?.planned_task_ids ?? []) {
        index.set(taskId, bundle);
      }
    }
    return index;
  }

  async function buildBundleIndex(bundleIndex = null) {
    return bundleIndex ?? listBundlesIndexedByTaskId();
  }

  function createCallbackState(
    workflowRun,
    runnerConfig,
    preparedAt,
    workers = [],
    automationConfig = {},
    governance = null,
  ) {
    const active = activeWorkers(workers);
    const acceptedProtocols = uniqueStrings(
      active.flatMap((worker) => worker.callback_protocols ?? []),
    );
    const callback = {
      ...emptyCallbackState(runnerConfig),
      report_url: `/api/workflow-run/${workflowRun.id}/report`,
      token: callbackToken(),
      signing_secret: callbackSecret(),
      status: 'active',
      issued_at: preparedAt,
      prepared_at: preparedAt,
      allowed_worker_ids: active.map((worker) => worker.id),
      accepted_protocols: acceptedProtocols.length > 0 ? acceptedProtocols : [RING_REPORT_PROTOCOL],
      timeout_at: plusMs(preparedAt, runnerConfig.report_timeout_ms),
    };
    return applyGovernanceDispatchPolicy(callback, active, automationConfig, governance);
  }

  function rotateCallbackState(callback, rotatedAt) {
    return {
      ...callback,
      token: callbackToken(),
      signing_secret: callbackSecret(),
      key_version: Math.max(1, Number(callback.key_version ?? 1)) + 1,
      last_rotated_at: rotatedAt,
    };
  }

  async function bindWorkflowRunNodeExecution(session, workflowRun, task, workflow, preparedAt, governance = null) {
    const existing = workflowRun.data.node_execution ?? workflowRunNodeExecution();
    if (existing.node_id && existing.active_checkpoint_id) {
      return {
        workflowRun,
        node: await ring.read('node', existing.node_id),
        activeCheckpoint: await ring.read('checkpoint', existing.active_checkpoint_id),
      };
    }

    const nodeId = await ring.newId('node', {
      name: `${task.id} ${workflowRun.id} executor`,
    });
    const rootCheckpointId = await ring.newId('checkpoint', {
      name: `${workflowRun.id} root`,
    });
    const rootCheckpoint = createCheckpoint({
      id: rootCheckpointId,
      created_by: 'session-runner',
      session_id: session.id,
      status: 'mainline',
      branch_id: existing.branch_id ?? 'main',
      node_id: nodeId,
      scope_ref: { kind: 'workflow-run', id: workflowRun.id, path: null },
      policy_snapshot: workflowRunPolicySnapshot(task, governance),
      execution_cursor: {
        phase: 'prepared',
        step_id: workflowRun.data.steps[Math.min(1, (workflowRun.data.steps ?? []).length - 1)]?.step_id ?? null,
        ordinal: workflowRun.data.current_step_index ?? 0,
      },
      evidence_refs: checkpointEvidenceRefsFromRun(workflowRun),
      adoption_status: 'mainline',
      replay_state: {
        status: 'idle',
        cursor: null,
        replayable: true,
        last_replayed_at: null,
      },
      synthesis_inputs: [],
      parent_checkpoint_id: null,
    });
    const nodeArtifact = workflowRunNodeArtifact(nodeId, session.id, workflowRun, task, workflow, preparedAt);
    nodeArtifact.data.runtime.capsule_state = recordCheckpoint(
      createEmptyCapsuleState({
        node_id: nodeId,
        runtime_status: 'prepared',
        current_checkpoint_id: null,
      }),
      rootCheckpointId,
      { now: preparedAt, metadata: { workflow_run_id: workflowRun.id } },
    );

    const nodeResult = await ring.create('node', {
      id: nodeArtifact.id,
      status: nodeArtifact.status,
      created_by: nodeArtifact.created_by,
      session_id: nodeArtifact.session_id,
      data: nodeArtifact.data,
    });
    if (!nodeResult.ok) {
      throw new Error(`Node creation failed for workflow run ${workflowRun.id}: ${JSON.stringify(nodeResult.errors)}`);
    }

    const checkpointResult = await ring.create('checkpoint', {
      id: rootCheckpoint.id,
      status: rootCheckpoint.status,
      created_by: rootCheckpoint.created_by,
      session_id: rootCheckpoint.session_id,
      data: rootCheckpoint.data,
    });
    if (!checkpointResult.ok) {
      throw new Error(`Checkpoint creation failed for workflow run ${workflowRun.id}: ${JSON.stringify(checkpointResult.errors)}`);
    }

    const branchEvent = await appendBranchEvent(ring, {
      event_type: 'checkpoint_created',
      branch_id: rootCheckpoint.data.branch_id,
      checkpoint_id: rootCheckpoint.id,
      actor: 'session-runner',
      occurred_at: preparedAt,
      session_id: session.id,
      parent_checkpoint_id: null,
    });

    const nextRun = {
      ...workflowRun,
      data: {
        ...workflowRun.data,
        node_execution: {
          node_id: nodeId,
          branch_id: rootCheckpoint.data.branch_id,
          active_checkpoint_id: rootCheckpoint.id,
          checkpoint_ids: [rootCheckpoint.id],
          branch_event_ids: [branchEvent.id],
          capsule_state: clone(nodeArtifact.data.runtime.capsule_state),
        },
      },
    };

    return {
      workflowRun: nextRun,
      node: nodeResult.artifact,
      activeCheckpoint: checkpointResult.artifact,
      branchEvent,
    };
  }

  async function recoverWorkflowRunNodeState(runId) {
    const workflowRun = await ring.read('workflow-run', runId);
    const nodeExecution = workflowRun.data.node_execution ?? null;
    if (!nodeExecution?.node_id) {
      return null;
    }
    const node = await ring.read('node', nodeExecution.node_id);
    const checkpoints = await Promise.all((nodeExecution.checkpoint_ids ?? []).map((id) => ring.read('checkpoint', id)));
    const activeCheckpoint = nodeExecution.active_checkpoint_id
      ? checkpoints.find((checkpoint) => checkpoint.id === nodeExecution.active_checkpoint_id) ?? await ring.read('checkpoint', nodeExecution.active_checkpoint_id)
      : null;
    const branchEvents = await Promise.all((nodeExecution.branch_event_ids ?? []).map((id) => ring.read('branch-event', id)));
    return {
      workflow_run: workflowRun,
      node,
      capsule_state: clone(node.data.runtime?.capsule_state ?? nodeExecution.capsule_state ?? null),
      active_checkpoint: activeCheckpoint,
      checkpoints,
      lineage: activeCheckpoint ? lineageForCheckpoint(checkpoints, activeCheckpoint.id) : [],
      branch_events: branchEvents,
    };
  }

  function verifyCallbackAuth(workflowRun, payload, meta = {}) {
    const callback = workflowRun.data.callback ?? emptyCallbackState();
    if (!callback.token || !callback.signing_secret) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} is not prepared for signed callbacks.`,
        409,
      );
    }
    const authorization = headerValue(meta.headers, 'authorization');
    if (authorization !== `Bearer ${callback.token}`) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback token is invalid.`,
        401,
      );
    }

    const timestamp = headerValue(meta.headers, 'x-ring-timestamp');
    const signatureHeader = headerValue(meta.headers, 'x-ring-signature');
    if (!timestamp || !signatureHeader) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback is missing signature headers.`,
        401,
      );
    }

    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback timestamp is invalid.`,
        401,
      );
    }

    const signatureAge = Math.abs(Date.now() - timestampMs);
    if (signatureAge > callback.signature_ttl_ms) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback signature is expired.`,
        401,
        { signature_age_ms: signatureAge },
      );
    }

    const expected = `sha256=${computeCallbackSignature(
      callback.signing_secret,
      timestamp,
      payload,
    )}`;
    if (!signaturesMatch(expected, signatureHeader)) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback signature is invalid.`,
        401,
      );
    }

    const keyVersionHeader = headerValue(meta.headers, 'x-ring-key-version');
    if (
      keyVersionHeader &&
      Number(keyVersionHeader) !== Math.max(1, Number(callback.key_version ?? 1))
    ) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback key version is invalid.`,
        401,
      );
    }

    return {
      timestamp,
      signature: signatureHeader,
    };
  }

  function verifyWorkerIdentity(workflowRun, normalizedReport, workers = []) {
    const callback = workflowRun.data.callback ?? emptyCallbackState();
    const workerId = normalizedReport.report.worker_id;
    if (!workerId) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback is missing a worker identity.`,
        401,
      );
    }

    const active = activeWorkers(workers);
    const worker = active.find((item) => item.id === workerId);
    if (!worker) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} callback worker "${workerId}" is not registered.`,
        403,
      );
    }

    const acceptedProtocols = uniqueStrings(callback.accepted_protocols ?? []);
    if (acceptedProtocols.length > 0 && !acceptedProtocols.includes(normalizedReport.protocol)) {
      throw new WorkflowRunReportError(
        `Workflow run ${workflowRun.id} does not accept callback protocol "${normalizedReport.protocol}".`,
        422,
      );
    }

    const workerProtocols = uniqueStrings(worker.callback_protocols ?? []);
    if (workerProtocols.length > 0 && !workerProtocols.includes(normalizedReport.protocol)) {
      throw new WorkflowRunReportError(
        `Worker "${workerId}" cannot report protocol "${normalizedReport.protocol}".`,
        422,
      );
    }

    const allowedWorkerIds = uniqueStrings(callback.allowed_worker_ids ?? []);
    if (allowedWorkerIds.length > 0 && !allowedWorkerIds.includes(workerId)) {
      throw new WorkflowRunReportError(
        `Worker "${workerId}" is not allowed to report for workflow run ${workflowRun.id}.`,
        403,
      );
    }

    return worker;
  }

  async function buildExecutionPacket(session, workflowRun, task, workflow, bundle) {
    const requirement = await ring.read('requirement', task.data.requirement_id);
    const milestone = await ring.read('milestone', task.data.milestone_id);
    const callback = clone(workflowRun.data.callback ?? emptyCallbackState());
    const packet = {
      schema_version: 'ring.session-runner.v1',
      created_at: nowIso(),
      session_id: session.id,
      workflow_run_id: workflowRun.id,
      task_id: task.id,
      requirement_id: requirement.id,
      milestone_id: milestone.id,
      workflow_template_id: workflow.id,
      repo_root: task.data.scope?.repo_root ?? '.',
      task_document_path: taskDocumentPath(task.id),
      scope: clone(task.data.scope ?? {}),
      goal: {
        title: task.data.name,
        description: task.data.description,
        acceptance_criteria: clone(task.data.acceptance_criteria ?? []),
      },
      workflow: {
        id: workflow.id,
        name: workflow.data.name,
        description: workflow.data.description,
        steps: clone(workflow.data.steps ?? []),
      },
      materials: clone(bundle?.staging?.materials ?? []),
      context: {
        artifact_refs: clone(bundle?.canonical?.context?.artifact_refs ?? []),
        prompts: clone(bundle?.canonical?.context?.prompts ?? []),
        brief_ref: bundle?.canonical?.context?.brief_ref ?? null,
        bundle_id: bundle?.id ?? null,
      },
      node: {
        node_id: workflowRun.data.node_execution?.node_id ?? null,
        branch_id: workflowRun.data.node_execution?.branch_id ?? 'main',
        active_checkpoint_id: workflowRun.data.node_execution?.active_checkpoint_id ?? null,
      },
      callbacks: {
        workflow_run_report: {
          url: callback.report_url,
          accepted_protocols: clone(callback.accepted_protocols ?? [RING_REPORT_PROTOCOL]),
          auth: {
            type: callback.auth_scheme,
            token: callback.token,
          },
          signing: {
            algorithm: callback.signature_algorithm,
            secret: callback.signing_secret,
            key_version: Math.max(1, Number(callback.key_version ?? 1)),
            timestamp_header: 'x-ring-timestamp',
            signature_header: 'x-ring-signature',
            key_version_header: 'x-ring-key-version',
            payload_format: '<timestamp>.<json-body>',
            ttl_ms: callback.signature_ttl_ms,
          },
          worker_identity: {
            required: true,
            registry_endpoint: '/api/orchestrator/workers',
            worker_id_header: 'x-ring-worker-id',
            allowed_worker_ids: clone(callback.allowed_worker_ids ?? []),
          },
          retry_policy: {
            timeout_ms: callback.report_timeout_ms,
            max_retries: callback.max_retries,
            retry_backoff_ms: callback.retry_backoff_ms,
          },
        },
        task_finalize: `/api/task/${task.id}/finalize`,
        task_judge: `/api/task/${task.id}/judge`,
      },
    };

    const packetPath = join(
      runnerDir,
      'sessions',
      session.id,
      `${workflowRun.id}.json`,
    );
    await mkdir(dirname(packetPath), { recursive: true });
    await writeFile(packetPath, JSON.stringify(packet, null, 2) + '\n', 'utf-8');
    return {
      packet,
      packet_path: relative(repoRoot, packetPath),
    };
  }

  async function rewriteExecutionPacket(session, workflowRun, bundleIndex = null) {
    const bundlesByTaskId = await buildBundleIndex(bundleIndex);
    const task = await ring.read('task', workflowRun.data.task_id);
    const workflow = await ring.read('workflow', workflowRun.data.workflow_template_id);
    const bundle = bundlesByTaskId.get(task.id) ?? null;
    return buildExecutionPacket(session, workflowRun, task, workflow, bundle);
  }

  async function prepareSession(session, bundleIndex = null) {
    if (session.status !== 'preparing') {
      return session;
    }

    const orchestratorConfig = await orchestrator.getConfig();
    const runnerConfig = normalizeRunnerConfig(orchestratorConfig);
    const workers = await orchestrator.getWorkers();
    const bundlesByTaskId = bundleIndex ?? await listBundlesIndexedByTaskId();
    const workflowRuns = await Promise.all(
      (session.data.workflow_run_ids ?? []).map((id) => ring.read('workflow-run', id)),
    );
    if (workflowRuns.length === 0) {
      return session;
    }

    const currentRunIds = new Set(workflowRuns.map((run) => run.id));
    const latestPriorWorkflowRunsByTemplate = latestWorkflowRunsByTemplate(
      (await ring.list('workflow-run')).filter((run) => !currentRunIds.has(run.id)),
    );

    let preparedCount = 0;
    const sessionEvents = [];

    for (const run of workflowRuns) {
      if (run.status !== 'pending') {
        continue;
      }

      const task = await ring.read('task', run.data.task_id);
      const workflow = await ring.read('workflow', run.data.workflow_template_id);
      const bundle = bundlesByTaskId.get(task.id) ?? null;
      const preparedAt = nowIso();
      const lineageGovernance = await semanticCheckpointDispatchGovernanceContext(ring, task);
      const inheritedCheckpointGovernance = await mainlineCheckpointReuseDispatchGovernanceContext(
        ring,
        run,
        latestPriorWorkflowRunsByTemplate,
      );
      const sessionGovernance = governanceBlockedReuseDispatchContext(session);
      const governance = lineageGovernance.tightenedDispatch
        ? lineageGovernance
        : inheritedCheckpointGovernance.tightenedDispatch
          ? inheritedCheckpointGovernance
          : sessionGovernance;
      const callback = createCallbackState(
        run,
        runnerConfig,
        preparedAt,
        workers,
        orchestratorConfig.automation ?? {},
        governance,
      );
      let nextRun = {
        ...run,
        data: {
          ...run.data,
          callback,
          reports: clone(run.data.reports ?? []),
          node_execution: clone(run.data.node_execution ?? workflowRunNodeExecution()),
        },
      };
      let executionPacket = await buildExecutionPacket(
        session,
        nextRun,
        task,
        workflow,
        bundle,
      );
      const steps = clone(run.data.steps ?? []);
      nextRun.data.callback.packet_path = executionPacket.packet_path;
      const nodeBinding = await bindWorkflowRunNodeExecution(
        session,
        nextRun,
        task,
        workflow,
        preparedAt,
        governance,
      );
      nextRun = nodeBinding.workflowRun;
      executionPacket = await buildExecutionPacket(
        session,
        nextRun,
        task,
        workflow,
        bundle,
      );
      nextRun.data.callback.packet_path = executionPacket.packet_path;

      if (steps.length === 0) {
        continue;
      }

      if (steps.length === 1) {
        steps[0] = {
          ...steps[0],
          status: 'running',
          started_at: steps[0].started_at ?? preparedAt,
          outputs: {
            ...(steps[0].outputs ?? {}),
            execution_packet_path: executionPacket.packet_path,
            material_count: executionPacket.packet.materials.length,
          },
          notes: 'Session runner prepared the workflow execution packet.',
        };
      } else {
        steps[0] = {
          ...steps[0],
          status: 'completed',
          started_at: steps[0].started_at ?? preparedAt,
          ended_at: preparedAt,
          outputs: {
            ...(steps[0].outputs ?? {}),
            execution_packet_path: executionPacket.packet_path,
            material_count: executionPacket.packet.materials.length,
            materials: executionPacket.packet.materials,
          },
          notes: 'Session runner injected staged materials and completed the inspect step.',
        };
        steps[1] = {
          ...steps[1],
          status: 'running',
          started_at: steps[1].started_at ?? preparedAt,
          outputs: {
            ...(steps[1].outputs ?? {}),
            execution_packet_path: executionPacket.packet_path,
          },
          notes: 'Execution is ready for the external worker.',
        };
      }

      nextRun = appendRunReport(
        {
          ...nextRun,
          data: {
            ...nextRun.data,
            callback: {
              ...nextRun.data.callback,
              packet_path: executionPacket.packet_path,
            },
          },
        },
        {
          at: preparedAt,
          status: 'prepared',
          actor: 'session-runner',
          step_id: steps[Math.min(1, steps.length - 1)]?.step_id ?? null,
          note: 'Execution packet prepared and callback credentials issued.',
          commit_sha: null,
          worker_id: null,
          protocol: null,
          authenticated: true,
          outputs: {
            execution_packet_path: executionPacket.packet_path,
          },
        },
      );
      nextRun = {
        ...run,
        data: {
          ...nextRun.data,
          current_step_index: steps.length === 1 ? 0 : 1,
          steps,
        },
      };
      await writeWorkflowRun(nextRun, 'running');
      preparedCount += 1;
      sessionEvents.push({
        timestamp: preparedAt,
        event: 'workflow_run_prepared',
        actor: 'session-runner',
        detail: `Prepared ${run.id} for task ${task.id} using ${executionPacket.packet.materials.length} staged materials.`,
      });
    }

    if (preparedCount === 0) {
      return session;
    }

    let nextSession = clone(session);
    nextSession = appendLog(nextSession, {
      timestamp: nowIso(),
      event: 'status_transition',
      from: 'preparing',
      to: 'executing',
      actor: 'session-runner',
      detail: `Prepared ${preparedCount} workflow runs for execution.`,
    });
    for (const entry of sessionEvents) {
      nextSession = appendLog(nextSession, entry);
    }

    return writeSession(nextSession, 'executing');
  }

  async function persistNodeCapsuleState(node, capsuleState) {
    const result = await ring.update('node', node.id, {
      data: {
        runtime: {
          ...node.data.runtime,
          capsule_state: clone(capsuleState),
        },
      },
    });
    if (!result.ok) {
      throw new Error(`Node update failed for ${node.id}: ${JSON.stringify(result.errors)}`);
    }
    return result.artifact;
  }

  async function advanceWorkflowRunNodeExecution(run, session, normalizedReport, worker, callback, reportedAt) {
    const nodeExecution = run.data.node_execution ?? workflowRunNodeExecution();
    if (!nodeExecution.node_id || !nodeExecution.active_checkpoint_id) {
      return { workflowRun: run, node: null, activeCheckpoint: null };
    }

    const node = await ring.read('node', nodeExecution.node_id);
    const activeCheckpoint = await ring.read('checkpoint', nodeExecution.active_checkpoint_id);
    let capsuleState = clone(node.data.runtime?.capsule_state ?? nodeExecution.capsule_state ?? createEmptyCapsuleState({
      node_id: node.id,
      runtime_status: 'prepared',
      current_checkpoint_id: activeCheckpoint.id,
    }));

    if (worker?.id) {
      if (!capsuleState.lease?.holder) {
        capsuleState = acquireLease(capsuleState, worker.id, { now: reportedAt, runtime_status: 'leased' });
      } else if (capsuleState.lease.holder === worker.id) {
        if (!leaseExpired(capsuleState, { now: reportedAt })) {
          capsuleState = renewLease(capsuleState, worker.id, { now: reportedAt, runtime_status: capsuleState.runtime_status });
        } else {
          capsuleState = expireLease(capsuleState, { now: reportedAt, reason: 'expired_before_renew' });
          capsuleState = acquireLease(capsuleState, worker.id, { now: reportedAt, runtime_status: 'leased' });
        }
      } else if (leaseExpired(capsuleState, { now: reportedAt })) {
        capsuleState = expireLease(capsuleState, { now: reportedAt, reason: 'worker_takeover' });
        capsuleState = acquireLease(capsuleState, worker.id, { now: reportedAt, runtime_status: 'leased' });
      } else {
        throw new WorkflowRunReportError(
          `Workflow run ${run.id} is currently leased to worker "${capsuleState.lease.holder}".`,
          409,
        );
      }
    }

    capsuleState = recordHeartbeat(capsuleState, {
      now: reportedAt,
      runtime_status:
        normalizedReport.report.status === 'progress'
          ? 'running'
          : normalizedReport.report.status === 'completed'
            ? 'completed'
            : 'failed',
      detail: {
        worker_id: worker?.id ?? null,
        status: normalizedReport.report.status,
        step_id: normalizedReport.report.step_id ?? null,
      },
    });

    const evidenceRefs = checkpointEvidenceRefsFromReport(normalizedReport, callback);
    if (evidenceRefs.length > 0) {
      capsuleState = attachEvidence(capsuleState, evidenceRefs, {
        now: reportedAt,
        checkpoint_id: activeCheckpoint.id,
      });
    }

    const completionGovernance = governanceBlockedReuseCompletionContext(session);
    const preserveSynthesizedCompletion =
      normalizedReport.report.status === 'completed' && completionGovernance.preserveSynthesizedLineage;
    const nextCheckpointPolicy = preserveSynthesizedCompletion
      ? {
          ...clone(activeCheckpoint.data.policy_snapshot ?? {}),
          notes:
            uniqueStrings([
              trimString(activeCheckpoint.data?.policy_snapshot?.notes),
              completionGovernance.note,
            ]).join(' | ') || null,
        }
      : activeCheckpoint.data.policy_snapshot;

    const nextCheckpoint = preserveSynthesizedCompletion
      ? synthesizeCheckpoint([activeCheckpoint], {
          id: await ring.newId('checkpoint', {
            name: `${run.id} ${normalizedReport.report.status} ${normalizedReport.report.step_id ?? 'step'}`,
          }),
          created_by: worker?.id ?? 'session-runner',
          session_id: session.id,
          status: 'synthesized',
          branch_id: nodeExecution.branch_id,
          node_id: node.id,
          scope_ref: { kind: 'workflow-run', id: run.id, path: callback.packet_path ?? null },
          policy_snapshot: nextCheckpointPolicy,
          execution_cursor: {
            phase: 'completed',
            step_id: normalizedReport.report.step_id ?? null,
            ordinal: run.data.current_step_index ?? 0,
          },
          evidence_refs: capsuleState.last_accepted_evidence_refs,
          adoption_status: 'synthesized',
          replay_state: capsuleState.replay,
          synthesis_inputs: [activeCheckpoint.id],
        })
      : continueFromCheckpoint(activeCheckpoint, {
          id: await ring.newId('checkpoint', {
            name: `${run.id} ${normalizedReport.report.status} ${normalizedReport.report.step_id ?? 'step'}`,
          }),
          created_by: worker?.id ?? 'session-runner',
          session_id: session.id,
          status:
            normalizedReport.report.status === 'completed'
              ? 'mainline'
              : normalizedReport.report.status === 'failed'
                ? 'candidate'
                : activeCheckpoint.status,
          branch_id: nodeExecution.branch_id,
          node_id: node.id,
          scope_ref: { kind: 'workflow-run', id: run.id, path: callback.packet_path ?? null },
          policy_snapshot: nextCheckpointPolicy,
          execution_cursor: {
            phase:
              normalizedReport.report.status === 'progress'
                ? 'running'
                : normalizedReport.report.status === 'completed'
                  ? 'completed'
                  : 'failed',
            step_id: normalizedReport.report.step_id ?? null,
            ordinal: run.data.current_step_index ?? 0,
          },
          evidence_refs: capsuleState.last_accepted_evidence_refs,
          adoption_status:
            normalizedReport.report.status === 'completed' ? 'mainline' : activeCheckpoint.data.adoption_status,
          replay_state: capsuleState.replay,
          synthesis_inputs: [],
        });

    let recoveryEvent = null;
    if (normalizedReport.report.status === 'failed') {
      capsuleState = requestReplay(capsuleState, {
        now: reportedAt,
        requested_by: 'session-runner',
        reason: normalizedReport.report.note ?? 'workflow execution failed',
        source_checkpoint_id: activeCheckpoint.id,
        target_checkpoint_id: nextCheckpoint.id,
        cursor: {
          workflow_run_id: run.id,
          step_id: normalizedReport.report.step_id ?? null,
        },
        runtime_status: 'recovering',
      });
      nextCheckpoint.data.replay_state = capsuleState.replay;
    } else if (capsuleState.replay?.status === 'requested') {
      capsuleState = completeReplay(capsuleState, {
        now: reportedAt,
        checkpoint_id: nextCheckpoint.id,
        runtime_status:
          normalizedReport.report.status === 'progress' ? 'running' : 'completed',
        evidence_refs: evidenceRefs,
      });
      nextCheckpoint.data.replay_state = capsuleState.replay;
      recoveryEvent = await appendBranchEvent(ring, {
        event_type: 'recovery_completed',
        branch_id: nodeExecution.branch_id,
        checkpoint_id: nextCheckpoint.id,
        actor: worker?.id ?? 'session-runner',
        occurred_at: reportedAt,
        session_id: session.id,
        parent_checkpoint_id: activeCheckpoint.id,
      });
    }

    const checkpointResult = await ring.create('checkpoint', {
      id: nextCheckpoint.id,
      status: nextCheckpoint.status,
      created_by: nextCheckpoint.created_by,
      session_id: nextCheckpoint.session_id,
      data: nextCheckpoint.data,
    });
    if (!checkpointResult.ok) {
      throw new Error(`Checkpoint continuation failed for workflow run ${run.id}: ${JSON.stringify(checkpointResult.errors)}`);
    }

    const continuedEvent = await appendBranchEvent(ring, {
      event_type: 'checkpoint_continued',
      branch_id: nodeExecution.branch_id,
      checkpoint_id: nextCheckpoint.id,
      actor: worker?.id ?? 'session-runner',
      occurred_at: reportedAt,
      session_id: session.id,
      parent_checkpoint_id: activeCheckpoint.id,
      reason: normalizedReport.report.status,
    });

    if (normalizedReport.report.status === 'failed') {
      recoveryEvent = await appendBranchEvent(ring, {
        event_type: 'recovery_triggered',
        branch_id: nodeExecution.branch_id,
        checkpoint_id: nextCheckpoint.id,
        actor: 'session-runner',
        occurred_at: reportedAt,
        session_id: session.id,
        parent_checkpoint_id: activeCheckpoint.id,
        reason: normalizedReport.report.note ?? 'workflow execution failed',
      });
    }

    const updatedNode = await persistNodeCapsuleState(node, recordCheckpoint(capsuleState, nextCheckpoint.id, {
      now: reportedAt,
      metadata: {
        workflow_run_id: run.id,
        report_status: normalizedReport.report.status,
      },
    }));

    const nextRun = {
      ...run,
      data: {
        ...run.data,
        node_execution: {
          ...nodeExecution,
          active_checkpoint_id: nextCheckpoint.id,
          checkpoint_ids: [...nodeExecution.checkpoint_ids, nextCheckpoint.id],
          branch_event_ids: [
            ...nodeExecution.branch_event_ids,
            continuedEvent.id,
            ...(recoveryEvent ? [recoveryEvent.id] : []),
          ],
          capsule_state: clone(updatedNode.data.runtime.capsule_state),
        },
      },
    };

    return {
      workflowRun: nextRun,
      node: updatedNode,
      activeCheckpoint: checkpointResult.artifact,
    };
  }

  async function processWorkflowTimeouts(session, bundleIndex = null) {
    if (session.status !== 'executing') {
      return session;
    }

    const runnerConfig = normalizeRunnerConfig(await orchestrator.getConfig());
    const workflowRuns = await Promise.all(
      (session.data.workflow_run_ids ?? []).map((id) => ring.read('workflow-run', id)),
    );
    let nextSession = clone(session);
    let changed = false;
    const now = nowIso();

    for (const run of workflowRuns) {
      if (run.status !== 'running') {
        continue;
      }
      const callback = {
        ...emptyCallbackState(runnerConfig),
        ...(run.data.callback ?? {}),
      };
      if (!callback.timeout_at || Date.parse(callback.timeout_at) > Date.now()) {
        continue;
      }

      const stepIndex = Math.min(run.data.current_step_index ?? 0, (run.data.steps ?? []).length - 1);
      const steps = clone(run.data.steps ?? []);
      const hasLineage = hasSemanticTimeoutLineage(run);
      const canBlindRetry = callback.retry_count < callback.max_retries && !hasLineage;
      const detail = canBlindRetry
        ? `No signed callback report arrived before ${callback.timeout_at}; scheduling retry ${callback.retry_count + 1}/${callback.max_retries}.`
        : hasLineage
          ? `No signed callback report arrived before ${callback.timeout_at}; node checkpoint lineage already exists, so the runner is skipping blind callback retry and routing the task into semantic replay.`
          : `No signed callback report arrived before ${callback.timeout_at}; retry budget exhausted.`;

      if (canBlindRetry) {
        let nextRun = {
          ...run,
          data: {
            ...run.data,
            callback: rotateCallbackState(
              {
                ...callback,
                status: 'retry_scheduled',
                retry_count: callback.retry_count + 1,
                last_retry_at: now,
                next_retry_at: plusMs(now, callback.retry_backoff_ms),
                timeout_at: plusMs(
                  plusMs(now, callback.retry_backoff_ms),
                  callback.report_timeout_ms,
                ),
                last_error: detail,
              },
              now,
            ),
            steps: steps.map((step, index) =>
              index === stepIndex
                ? {
                    ...step,
                    notes: detail,
                  }
                : step,
            ),
          },
        };
        const refreshedPacket = await rewriteExecutionPacket(session, nextRun, bundleIndex);
        nextRun = appendRunReport(
          {
            ...nextRun,
            data: {
              ...nextRun.data,
              callback: {
                ...nextRun.data.callback,
                packet_path: refreshedPacket.packet_path,
              },
            },
          },
          {
            at: now,
            status: 'retry_scheduled',
            actor: 'session-runner',
            step_id: steps[stepIndex]?.step_id ?? null,
            note: detail,
            commit_sha: null,
            worker_id: null,
            protocol: null,
            authenticated: true,
            outputs: {
              execution_packet_path: refreshedPacket.packet_path,
              key_version: nextRun.data.callback.key_version,
            },
          },
        );
        await writeWorkflowRun(nextRun);
        nextSession = appendLog(nextSession, {
          timestamp: now,
          event: 'workflow_run_retry_scheduled',
          actor: 'session-runner',
          detail: `Workflow run ${run.id} missed its callback deadline. Retry ${callback.retry_count + 1}/${callback.max_retries} scheduled and callback credentials rotated to key version ${nextRun.data.callback.key_version}.`,
        });
        changed = true;
        continue;
      }

      const failedTask = await taskExecution.fail(run.data.task_id, {
        reason_code: 'workflow_timeout',
        judge_agent_id: null,
        note: detail,
      });
      const timeoutGovernance = await semanticCheckpointTimeoutTerminalContext(ring, failedTask, run);
      const finalTask = timeoutGovernance.terminalOnTimeout
        ? await taskExecution.replan(failedTask.id, {
            verdict: 'terminal',
            replanner_agent_id: 'session-runner',
            note:
              `Workflow run ${run.id} timed out under a checkpoint policy with branch_budget=${timeoutGovernance.branchBudget} `
              + `at ${timeoutGovernance.activeCheckpointId}, so no further redispatch will be scheduled after the warm-lineage governed retry.`,
          })
        : failedTask;
      const nodeAdvance = await advanceWorkflowRunNodeExecution(
        run,
        session,
        {
          protocol: RING_REPORT_PROTOCOL,
          report: {
            status: 'failed',
            step_id: steps[stepIndex]?.step_id ?? null,
            actor: 'session-runner',
            worker_id: null,
            note: detail,
            commit_sha: null,
            outputs: {},
            judge_agent_id: null,
          },
        },
        null,
        callback,
        now,
      );
      const advancedRun = nodeAdvance.workflowRun;
      const failedRun = appendRunReport(
        {
          ...advancedRun,
          data: {
            ...advancedRun.data,
            callback: {
              ...callback,
              status: 'timed_out',
              last_error: detail,
              next_retry_at: null,
              timeout_at: null,
            },
            steps: steps.map((step, index) =>
              index === stepIndex
                ? {
                    ...step,
                    status: 'failed',
                    ended_at: now,
                    notes: detail,
                    outputs: {
                      ...(step.outputs ?? {}),
                      timeout_reason: detail,
                    },
                  }
                : step,
            ),
          },
        },
        {
          at: now,
          status: 'timed_out',
          actor: 'session-runner',
          step_id: steps[stepIndex]?.step_id ?? null,
          note: detail,
          commit_sha: null,
          worker_id: null,
          protocol: null,
          authenticated: true,
          outputs: {
            replanning_status: finalTask.data.replanning?.status ?? null,
            branch_budget: timeoutGovernance.branchBudget,
          },
        },
      );
      await writeWorkflowRun(failedRun, 'failed');
      nextSession = appendLog(nextSession, {
        timestamp: now,
        event: 'workflow_run_timeout',
        actor: 'session-runner',
        detail: timeoutGovernance.terminalOnTimeout
          ? `Workflow run ${run.id} timed out after a warm-lineage governed redispatch and task ${finalTask.id} was marked terminal because checkpoint policy exhausted the branch budget.`
          : `Workflow run ${run.id} timed out and task ${finalTask.id} was routed into replanning.`,
      });
      changed = true;
    }

    return changed ? writeSession(nextSession) : session;
  }

  async function reconcileSession(session) {
    const workflowRuns = await Promise.all(
      (session.data.workflow_run_ids ?? []).map((id) => ring.read('workflow-run', id)),
    );
    const tasks = await Promise.all(
      (session.data.task_ids ?? []).map((id) => ring.read('task', id)),
    );

    if (session.status === 'executing') {
      if (workflowRuns.some((run) => run.status === 'failed')) {
        let failedSession = clone(session);
        failedSession = appendLog(failedSession, {
          timestamp: nowIso(),
          event: 'status_transition',
          from: 'executing',
          to: 'failed',
          actor: 'session-runner',
          detail: 'At least one workflow run failed during execution.',
        });
        return writeSession(failedSession, 'failed');
      }

      if (workflowRuns.length > 0 && workflowRuns.every((run) => run.status === 'completed')) {
        let reviewingSession = clone(session);
        reviewingSession = appendLog(reviewingSession, {
          timestamp: nowIso(),
          event: 'status_transition',
          from: 'executing',
          to: 'reviewing',
          actor: 'session-runner',
          detail: 'All workflow runs completed. Waiting for task judgement outcomes.',
        });
        return writeSession(reviewingSession, 'reviewing');
      }
    }

    if (session.status === 'reviewing') {
      if (tasks.some((task) => task.status === 'failed')) {
        let failedSession = clone(session);
        failedSession = appendLog(failedSession, {
          timestamp: nowIso(),
          event: 'status_transition',
          from: 'reviewing',
          to: 'failed',
          actor: 'session-runner',
          detail: 'A task failed during review.',
        });
        return writeSession(failedSession, 'failed');
      }

      if (tasks.length > 0 && tasks.every((task) => task.status === 'completed')) {
        let closingSession = clone(session);
        closingSession = appendLog(closingSession, {
          timestamp: nowIso(),
          event: 'status_transition',
          from: 'reviewing',
          to: 'closing',
          actor: 'session-runner',
          detail: 'All tasks are complete. Closing the session.',
        });
        return writeSession(closingSession, 'closing');
      }
    }

    if (session.status === 'closing') {
      let closedSession = clone(session);
      closedSession = appendLog(closedSession, {
        timestamp: nowIso(),
        event: 'status_transition',
        from: 'closing',
        to: 'closed',
        actor: 'session-runner',
        detail: 'Session closed after all workflow runs and tasks completed.',
      });
      return writeSession(closedSession, 'closed');
    }

    return session;
  }

  async function tick() {
    const sessions = await ring.list('session');
    const bundleIndex = await listBundlesIndexedByTaskId();
    const processed = [];

    for (const session of sessions) {
      if (session.status === 'preparing') {
        processed.push(await prepareSession(session, bundleIndex));
        continue;
      }
      if (['executing', 'reviewing', 'closing'].includes(session.status)) {
        const afterTimeouts =
          session.status === 'executing'
            ? await processWorkflowTimeouts(session, bundleIndex)
            : session;
        processed.push(await reconcileSession(afterTimeouts));
      }
    }

    return {
      ok: true,
      processed,
    };
  }

  async function reportWorkflowRun(runId, payload = {}, meta = {}) {
    const run = await ring.read('workflow-run', runId);
    const session = await ring.read('session', run.session_id);
    const task = await ring.read('task', run.data.task_id);
    verifyCallbackAuth(run, payload, meta);
    const normalized = normalizeWorkerReport(payload, meta);
    const status = normalized.report.status;
    if (!['progress', 'completed', 'failed'].includes(status)) {
      throw new WorkflowRunReportError(
        'workflow-run report status must be one of "progress", "completed", or "failed".',
        400,
      );
    }
    const worker = verifyWorkerIdentity(run, normalized, await orchestrator.getWorkers());
    const steps = clone(run.data.steps ?? []);
    if (steps.length === 0) {
      throw new WorkflowRunReportError(`Workflow run ${runId} has no steps.`, 409);
    }

    const stepIndex =
      normalized.report.step_id != null
        ? steps.findIndex((step) => step.step_id === normalized.report.step_id)
        : Math.min(run.data.current_step_index ?? 0, steps.length - 1);
    if (stepIndex < 0) {
      throw new WorkflowRunReportError(
        `Workflow run ${runId} does not contain step ${normalized.report.step_id}.`,
        400,
      );
    }

    const step = steps[stepIndex];
    const reportedAt = nowIso();
    const outputs = {
      ...(step.outputs ?? {}),
      ...(normalized.report.outputs ?? {}),
    };
    if (normalized.report.commit_sha) {
      outputs.commit_sha = String(normalized.report.commit_sha).trim();
    }

    let nextRun;
    let nextSession = clone(session);
    const callback = {
      ...emptyCallbackState(normalizeRunnerConfig(await orchestrator.getConfig())),
      ...(run.data.callback ?? {}),
      status: status === 'failed' ? 'failed' : status === 'completed' ? 'completed' : 'active',
      last_report_at: reportedAt,
      last_worker_id: worker.id,
      last_protocol: normalized.protocol,
      last_error: null,
      next_retry_at: null,
      timeout_at:
        status === 'completed' || status === 'failed'
          ? null
          : plusMs(reportedAt, run.data.callback?.report_timeout_ms ?? DEFAULT_RUNNER_CONFIG.report_timeout_ms),
    };
    const reportRecord = {
      at: reportedAt,
      status,
      actor: normalized.report.actor ?? worker.display_name ?? worker.id,
      step_id: steps[stepIndex]?.step_id ?? null,
      note: normalized.report.note ?? null,
      commit_sha:
        normalized.report.commit_sha != null ? String(normalized.report.commit_sha).trim() : null,
      worker_id: worker.id,
      protocol: normalized.protocol,
      authenticated: true,
      outputs:
        Object.keys(normalized.report.outputs ?? {}).length > 0
          ? normalized.report.outputs
          : null,
    };

    const nodeAdvance = await advanceWorkflowRunNodeExecution(
      run,
      session,
      normalized,
      worker,
      callback,
      reportedAt,
    );
    nextRun = clone(nodeAdvance.workflowRun);

    if (status === 'progress') {
      steps[stepIndex] = {
        ...step,
        status: step.status === 'pending' ? 'running' : step.status,
        started_at: step.started_at ?? reportedAt,
        outputs,
        notes: normalized.report.note ?? step.notes ?? null,
      };
      nextRun = appendRunReport({
        ...nextRun,
        data: {
          ...nextRun.data,
          callback,
          current_step_index: stepIndex,
          steps,
        },
      }, reportRecord);
      nextRun = await writeWorkflowRun(nextRun, 'running');
      nextSession = appendLog(nextSession, {
        timestamp: reportedAt,
        event: 'workflow_run_progress',
        actor: worker.id,
        detail: `Workflow run ${run.id} reported progress on step ${steps[stepIndex].step_id}.`,
      });
      return {
        workflow_run: nextRun,
        session: await writeSession(nextSession),
        task,
      };
    }

    if (status === 'failed') {
      const failedTask = await taskExecution.fail(task.id, {
        reason_code: 'workflow_failed',
        note: normalized.report.note ?? 'Workflow execution failed.',
      });
      steps[stepIndex] = {
        ...step,
        status: 'failed',
        started_at: step.started_at ?? reportedAt,
        ended_at: reportedAt,
        outputs,
        notes: normalized.report.note ?? 'Workflow execution failed.',
      };
      nextRun = appendRunReport({
        ...nextRun,
        data: {
          ...nextRun.data,
          callback: {
            ...callback,
            last_error: normalized.report.note ?? 'Workflow execution failed.',
          },
          current_step_index: stepIndex,
          steps,
        },
      }, {
        ...reportRecord,
        outputs: {
          ...(reportRecord.outputs ?? {}),
          replanning_status: failedTask.data.replanning?.status ?? null,
        },
      });
      nextRun = await writeWorkflowRun(nextRun, 'failed');
      nextSession = appendLog(nextSession, {
        timestamp: reportedAt,
        event: 'workflow_run_failed',
        actor: worker.id,
        detail: `Workflow run ${run.id} failed on step ${steps[stepIndex].step_id}; task ${failedTask.id} entered replanning.`,
      });
      const updatedSession = await writeSession(nextSession);
      return {
        workflow_run: nextRun,
        session: await reconcileSession(updatedSession),
        task: failedTask,
      };
    }

    steps[stepIndex] = {
      ...step,
      status: 'completed',
      started_at: step.started_at ?? reportedAt,
      ended_at: reportedAt,
      outputs,
      notes: normalized.report.note ?? step.notes ?? null,
    };

    if (normalized.report.commit_sha) {
      const finalizedTask = await taskExecution.finalize(task.id, {
        commit_sha: String(normalized.report.commit_sha).trim(),
        judge_agent_id: normalized.report.judge_agent_id,
        note: normalized.report.note ?? null,
      });
      for (let index = stepIndex + 1; index < steps.length; index += 1) {
        steps[index] = {
          ...steps[index],
          status: 'completed',
          started_at: steps[index].started_at ?? reportedAt,
          ended_at: reportedAt,
          outputs: {
            ...(steps[index].outputs ?? {}),
            task_summary_path: finalizedTask.data.execution?.summary_path ?? null,
            review_status: finalizedTask.data.execution?.review_status ?? null,
          },
          notes:
            index === steps.length - 1
              ? 'Runner finalized the task and handed it to the judge.'
              : 'Completed by the runner after external execution finished.',
        };
      }

      nextRun = appendRunReport({
        ...nextRun,
        data: {
          ...nextRun.data,
          callback,
          current_step_index: Math.max(steps.length - 1, 0),
          steps,
        },
      }, {
        ...reportRecord,
        outputs: {
          ...(reportRecord.outputs ?? {}),
          task_summary_path: finalizedTask.data.execution?.summary_path ?? null,
          review_status: finalizedTask.data.execution?.review_status ?? null,
        },
      });
      nextRun = await writeWorkflowRun(nextRun, finalizedTask.status === 'failed' ? 'failed' : 'completed');
      nextSession = appendLog(nextSession, {
        timestamp: reportedAt,
        event: finalizedTask.status === 'failed' ? 'workflow_run_failed' : 'workflow_run_completed',
        actor: worker.id,
        detail:
          finalizedTask.status === 'failed'
            ? `Workflow run ${run.id} finished but task finalization failed for ${task.id}.`
            : `Workflow run ${run.id} completed and task ${task.id} entered judgement.`,
      });
      const updatedSession = await writeSession(nextSession);
      return {
        workflow_run: nextRun,
        session: await reconcileSession(updatedSession),
        task: finalizedTask,
      };
    }

    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < steps.length) {
      steps[nextStepIndex] = {
        ...steps[nextStepIndex],
        status: 'running',
        started_at: steps[nextStepIndex].started_at ?? reportedAt,
        outputs: {
          ...(steps[nextStepIndex].outputs ?? {}),
        },
        notes: steps[nextStepIndex].notes ?? 'Started after the previous step completed.',
      };
      nextRun.data = {
        ...nextRun.data,
        callback,
        current_step_index: nextStepIndex,
        steps,
      };
      nextRun = appendRunReport(nextRun, reportRecord);
      nextRun = await writeWorkflowRun(nextRun, 'running');
    } else {
      nextRun.data = {
        ...nextRun.data,
        callback,
        current_step_index: stepIndex,
        steps,
      };
      nextRun = appendRunReport(nextRun, reportRecord);
      nextRun = await writeWorkflowRun(nextRun, 'completed');
    }

    nextSession = appendLog(nextSession, {
      timestamp: reportedAt,
      event: 'workflow_run_completed',
      actor: worker.id,
      detail: `Workflow run ${run.id} completed step ${steps[stepIndex].step_id}.`,
    });
    const updatedSession = await writeSession(nextSession);
    return {
      workflow_run: nextRun,
      session: await reconcileSession(updatedSession),
      task,
    };
  }

  return {
    tick,
    reportWorkflowRun,
    recoverWorkflowRunNodeState,
    runnerDir,
  };
}
