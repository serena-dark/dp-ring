import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createRing } from '../../ring/index.mjs';
import { createCheckpoint } from '../../ring/lib/checkpoint-tree.mjs';
import { createEmptyCapsuleState } from '../../ring/lib/node-capsule.mjs';
import { signedWorkflowRunHeaders } from '../../ring/lib/workflow-run-callback.mjs';

const execFileAsync = promisify(execFile);

async function run(command, args, cwd) {
  return execFileAsync(command, args, {
    cwd,
    encoding: 'utf-8',
  });
}

function signedHeaders(workflowRun, payload, options = {}) {
  return signedWorkflowRunHeaders(workflowRun, payload, options);
}

async function readValidationArtifactsForCheckpoint(ring, checkpointId) {
  const checkpoint = await ring.read('checkpoint', checkpointId);
  const reportId = checkpoint.data.validation_report_id;
  let report = null;
  if (reportId) {
    try {
      report = await ring.read('validation-report', reportId);
    } catch {
      report = null;
    }
  }
  const results = report
    ? await Promise.all(report.data.result_ids.map((id) => ring.read('validation-result', id)))
    : [];

  return {
    checkpoint,
    report,
    results,
  };
}

async function createRedispatchSession(ring, task, workflow) {
  const sessionId = await ring.newId('session', {
    name: `${task.data.name} governed redispatch`,
  });
  const runId = await ring.newId('workflow-run', {
    name: `${task.id} ${workflow.data.name} governed redispatch`,
  });

  const sessionResult = await ring.create('session', {
    id: sessionId,
    status: 'preparing',
    created_by: 'session-runner-test',
    session_id: sessionId,
    data: {
      requirement_id: task.data.requirement_id,
      milestone_id: task.data.milestone_id,
      milestone_ids: [task.data.milestone_id],
      task_ids: [task.id],
      workflow_run_ids: [runId],
      evaluation_id: null,
      distillation_id: null,
      context_injected: {
        workflow_template: workflow.id,
        distillations_applied: [],
        registry_rank_at_selection: null,
      },
      execution_log: [],
    },
  });
  assert.equal(sessionResult.ok, true, JSON.stringify(sessionResult.errors));

  const taskUpdate = await ring.update('task', task.id, {
    session_id: sessionId,
    status: 'in_progress',
  });
  assert.equal(taskUpdate.ok, true, JSON.stringify(taskUpdate.errors));

  const workflowRunResult = await ring.create('workflow-run', {
    id: runId,
    status: 'pending',
    created_by: 'session-runner-test',
    session_id: sessionId,
    data: {
      workflow_template_id: workflow.id,
      workflow_template_version: workflow.version,
      task_id: task.id,
      current_step_index: 0,
      callback: {
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
        report_timeout_ms: 120_000,
        max_retries: 2,
        retry_count: 0,
        retry_backoff_ms: 30_000,
        signature_ttl_ms: 300_000,
        timeout_at: null,
        packet_path: null,
        allowed_worker_ids: [],
        accepted_protocols: ['ring.workflow-run-report.v1', 'a2a.task-status.v1'],
        last_worker_id: null,
        last_protocol: null,
        last_error: null,
      },
      reports: [],
      steps: workflow.data.steps.map((step) => ({
        step_id: step.id,
        status: 'pending',
        started_at: null,
        ended_at: null,
        outputs: {},
        notes: null,
      })),
      node_execution: {
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
      },
    },
  });
  assert.equal(workflowRunResult.ok, true, JSON.stringify(workflowRunResult.errors));

  return {
    sessionId,
    runId,
  };
}

async function createPreparingTaskFixture(ring, repoRoot, name, workflow, taskPatch = {}) {
  const requirementResult = await ring.create('requirement', {
    id: await ring.newId('requirement', { name }),
    status: 'ready',
    created_by: 'session-runner-test',
    data: {
      name,
      description: `${name} requirement`,
      acceptance_criteria: [{ id: 'ac1', description: 'Done', satisfied: false }],
      milestone_ids: [],
      priority: 'high',
    },
  });
  assert.equal(requirementResult.ok, true, JSON.stringify(requirementResult.errors));

  const milestoneId = await ring.newId('milestone', {
    name: `${name} milestone`,
    parentId: requirementResult.artifact.id,
  });
  const milestoneResult = await ring.create('milestone', {
    id: milestoneId,
    status: 'active',
    created_by: 'session-runner-test',
    data: {
      name: `${name} milestone`,
      requirement_id: requirementResult.artifact.id,
      description: `${name} milestone`,
      prerequisites: [],
    },
  });
  assert.equal(milestoneResult.ok, true, JSON.stringify(milestoneResult.errors));

  const taskId = await ring.newId('task', { name });
  const taskResult = await ring.create('task', {
    id: taskId,
    status: 'ready',
    created_by: 'session-runner-test',
    session_id: null,
    data: {
      name,
      description: `${name} task`,
      task_type: workflow.data.applicable_to[0] ?? 'feature-implementation',
      requirement_id: requirementResult.artifact.id,
      milestone_id: milestoneId,
      workflow_template_id: workflow.id,
      workflow_run_id: null,
      execution_mode: 'serial',
      scope: {
        target_type: 'file',
        target_path: 'README.md',
        repo_root: repoRoot,
        file_paths: ['README.md'],
      },
      execution: {
        judge_agent_id: null,
        review_status: 'pending',
        completion_commit_sha: null,
        changed_files: [],
        scope_match: null,
        build_required: false,
        build_command: null,
        build_status: 'skipped',
        cleanup_paths: [],
        cleanup_status: 'skipped',
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
      },
      acceptance_criteria: [{ id: 'ac1', description: 'Done', satisfied: false }],
      ...taskPatch,
    },
  });
  assert.equal(taskResult.ok, true, JSON.stringify(taskResult.errors));

  return {
    requirement: requirementResult.artifact,
    milestone: milestoneResult.artifact,
    task: taskResult.artifact,
  };
}

describe('session runner', async () => {
  let tempDir;
  let ring;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-session-runner-'));
    const ringDir = join(tempDir, '.ring');

    await cp(resolve(import.meta.dirname, '../../.ring/schemas'), join(ringDir, 'schemas'), {
      recursive: true,
    });
    await cp(resolve(import.meta.dirname, '../../.ring/config.json'), join(ringDir, 'config.json'));
    await cp(resolve(import.meta.dirname, '../../.ring/orchestrator'), join(ringDir, 'orchestrator'), {
      recursive: true,
    });

    const dirs = [
      'sessions',
      'requirements',
      'milestones',
      'tasks',
      'workflows',
      'workflow-runs',
      'evaluations',
      'feedback',
      'distillations',
      'registry',
    ];
    for (const dir of dirs) {
      await mkdir(join(ringDir, dir), { recursive: true });
    }

    await writeFile(
      join(ringDir, 'registry', 'leaderboard.json'),
      JSON.stringify({ updated_at: '2026-04-08T00:00:00Z', rankings: {} }),
    );

    await run('git', ['init'], tempDir);
    await run('git', ['config', 'user.email', 'runner@test.local'], tempDir);
    await run('git', ['config', 'user.name', 'Runner Test'], tempDir);
    await writeFile(join(tempDir, 'README.md'), '# Session Runner Fixture\n', 'utf-8');
    await run('git', ['add', '.'], tempDir);
    await run('git', ['commit', '-m', 'initial'], tempDir);

    ring = await createRing(tempDir);
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: false,
      },
    });
  });

  after(async () => {
    ring.orchestrator.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('prepares launched sessions with execution packets and staged materials', async () => {
    const linkage = {
      publication_root_id: 'pr-session-runner-prepared',
      validation_report_id: 'vrpt-session-runner-prepared',
      trace_id: 'trace-session-runner-prepared',
      span_id: 'span-session-runner-prepared',
      parent_span_id: 'span-session-runner-parent',
    };
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-test',
      payload: {
        trace: {
          trace_id: linkage.trace_id,
          span_id: linkage.span_id,
          parent_span_id: linkage.parent_span_id,
          source_kind: 'session-runner-test',
        },
        goal: {
          title: 'Session Runner Preparation',
          description: 'The runner should inject staged materials into the workflow execution packet.',
          acceptance_criteria: ['Execution packet exists'],
        },
        environment: {
          project_id: 'runner-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner',
            required: true,
            inline_data: '{"stage":"runner"}',
          },
        ],
        context: {
          publication_root_id: linkage.publication_root_id,
          validation_report_id: linkage.validation_report_id,
        },
      },
    });

    const tickResult = await ring.orchestrator.tick();
    const launchedBundle = tickResult.processed_bundles.find((item) => item.id === bundle.id);
    assert.ok(launchedBundle);
    assert.equal(launchedBundle.status, 'session_launched');

    const session = await ring.read('session', launchedBundle.batching.session_id);
    assert.equal(session.status, 'executing');

    const workflowRun = await ring.read('workflow-run', session.data.workflow_run_ids[0]);
    assert.equal(workflowRun.status, 'running');
    assert.equal(workflowRun.data.steps[0].status, 'completed');
    assert.equal(workflowRun.data.steps[1].status, 'running');
    assert.ok(workflowRun.data.steps[0].outputs.execution_packet_path);
    assert.equal(workflowRun.data.callback.status, 'active');
    assert.ok(workflowRun.data.callback.token);
    assert.ok(workflowRun.data.callback.signing_secret);
    assert.ok(workflowRun.data.node_execution.node_id);
    assert.ok(workflowRun.data.node_execution.active_checkpoint_id);
    assert.equal(workflowRun.data.node_execution.branch_id, 'main');
    assert.equal(workflowRun.data.node_execution.checkpoint_ids.length, 1);
    assert.equal(workflowRun.data.node_execution.branch_event_ids.length, 1);

    const node = await ring.read('node', workflowRun.data.node_execution.node_id);
    assert.equal(node.type, 'node');
    assert.equal(node.data.runtime.capsule_state.current_checkpoint_id, workflowRun.data.node_execution.active_checkpoint_id);

    const checkpoint = await ring.read('checkpoint', workflowRun.data.node_execution.active_checkpoint_id);
    assert.equal(checkpoint.type, 'checkpoint');
    assert.equal(checkpoint.status, 'mainline');
    assert.equal(checkpoint.data.scope_ref.kind, 'workflow-run');
    assert.equal(checkpoint.data.publication_statements.length, 1);
    assert.equal(checkpoint.data.publication_statements[0].predicateType, 'https://dp-ring.dev/predicate/checkpoint-publication/v1');
    assert.equal(checkpoint.data.publication_root_id, linkage.publication_root_id);
    assert.equal(checkpoint.data.validation_report_id, linkage.validation_report_id);
    assert.equal(checkpoint.data.trace_id, linkage.trace_id);
    assert.equal(checkpoint.data.span_id, linkage.span_id);
    assert.equal(checkpoint.data.parent_span_id, linkage.parent_span_id);

    const branchEvent = await ring.read('branch-event', workflowRun.data.node_execution.branch_event_ids[0]);
    assert.equal(branchEvent.data.event_type, 'checkpoint_created');
    assert.equal(branchEvent.data.message_class, 'commit');
    assert.equal(branchEvent.data.statement.predicateType, 'https://dp-ring.dev/predicate/branch-event-commit/v1');
    assert.equal(branchEvent.data.statement.predicate.context.checkpoint_id, workflowRun.data.node_execution.active_checkpoint_id);
    assert.equal(branchEvent.data.publication_root_id, linkage.publication_root_id);
    assert.equal(branchEvent.data.validation_report_id, linkage.validation_report_id);
    assert.equal(branchEvent.data.trace_id, linkage.trace_id);
    assert.equal(branchEvent.data.span_id, linkage.span_id);
    assert.equal(branchEvent.data.parent_span_id, linkage.parent_span_id);

    const packetPath = join(tempDir, workflowRun.data.steps[0].outputs.execution_packet_path);
    const packet = JSON.parse(await readFile(packetPath, 'utf-8'));
    assert.equal(packet.session_id, session.id);
    assert.equal(packet.workflow_run_id, workflowRun.id);
    assert.equal(packet.context.publication_root_id, linkage.publication_root_id);
    assert.equal(packet.context.validation_report_id, linkage.validation_report_id);
    assert.equal(packet.context.trace_id, linkage.trace_id);
    assert.equal(packet.context.span_id, linkage.span_id);
    assert.equal(packet.context.parent_span_id, linkage.parent_span_id);
    assert.equal(packet.materials.length, 1);
    assert.ok(packet.materials[0].resolved_path);
    assert.equal(packet.node.node_id, workflowRun.data.node_execution.node_id);
    assert.equal(packet.node.active_checkpoint_id, workflowRun.data.node_execution.active_checkpoint_id);
    assert.equal(packet.callbacks.workflow_run_report.auth.type, 'bearer');
    assert.equal(packet.callbacks.workflow_run_report.auth.token, workflowRun.data.callback.token);
    assert.equal(packet.callbacks.workflow_run_report.signing.secret, workflowRun.data.callback.signing_secret);
    assert.equal(packet.callbacks.workflow_run_report.signing.key_version, 1);
    assert.deepEqual(packet.callbacks.workflow_run_report.accepted_protocols, [
      'ring.workflow-run-report.v1',
      'a2a.task-status.v1',
    ]);
    assert.deepEqual(packet.callbacks.workflow_run_report.worker_identity.allowed_worker_ids, [
      'worker-agent',
      'a2a-worker',
    ]);

    const stagedMaterial = await readFile(join(tempDir, packet.materials[0].resolved_path), 'utf-8');
    assert.match(stagedMaterial, /runner/);
  });

  it('inherits and consumes adopted mainline checkpoint policy when reusing a workflow template', async () => {
    const workflowResult = await ring.create('workflow', {
      id: 'wf-runner-mainline-policy-reuse',
      status: 'active',
      created_by: 'session-runner-test',
      data: {
        name: 'Runner Mainline Policy Reuse',
        description: 'Reusable workflow whose adopted mainline checkpoint should shape the next dispatch contract.',
        applicable_to: ['feature-implementation'],
        steps: [
          { id: 'inspect', name: 'Inspect', description: 'Inspect the governed context.' },
          { id: 'execute', name: 'Execute', description: 'Execute the reusable workflow.' },
          { id: 'report', name: 'Report', description: 'Report the governed result.' },
        ],
      },
    });
    assert.equal(workflowResult.ok, true, JSON.stringify(workflowResult.errors));
    const workflow = workflowResult.artifact;

    const priorCheckpoint = createCheckpoint({
      id: 'cp-runner-mainline-policy-active',
      created_at: '2026-04-18T05:00:00Z',
      updated_at: '2026-04-18T05:00:45Z',
      created_by: 'session-runner-test',
      session_id: 'session-runner-mainline-policy-prior',
      status: 'mainline',
      node_id: 'n-runner-mainline-policy',
      scope_ref: { kind: 'workflow-run', id: 'run-runner-mainline-policy-prior', path: null },
      execution_cursor: { phase: 'completed', step_id: 'report', ordinal: 3 },
      adoption_status: 'mainline',
      policy_snapshot: {
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
        branch_budget: 1,
        notes: 'Adopted mainline checkpoint still requires tight oversight for the next reuse.',
      },
    });
    const priorCheckpointResult = await ring.create('checkpoint', {
      id: priorCheckpoint.id,
      status: priorCheckpoint.status,
      created_at: priorCheckpoint.created_at,
      updated_at: priorCheckpoint.updated_at,
      created_by: priorCheckpoint.created_by,
      session_id: priorCheckpoint.session_id,
      data: priorCheckpoint.data,
    });
    assert.equal(priorCheckpointResult.ok, true, JSON.stringify(priorCheckpointResult.errors));

    const priorRunResult = await ring.create('workflow-run', {
      id: 'run-runner-mainline-policy-prior',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-18T05:00:00Z',
      updated_at: '2026-04-18T05:01:00Z',
      created_by: 'session-runner-test',
      session_id: 'session-runner-mainline-policy-prior',
      status: 'completed',
      data: {
        workflow_template_id: workflow.id,
        workflow_template_version: workflow.version,
        task_id: 'task-runner-mainline-policy-prior',
        current_step_index: 2,
        callback: {
          auth_scheme: 'bearer',
          report_url: `http://127.0.0.1:3100/api/workflow-run/run-runner-mainline-policy-prior/report`,
          token: 'token-runner-mainline-policy-prior',
          signing_secret: 'secret-runner-mainline-policy-prior',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'completed',
          issued_at: '2026-04-18T05:00:00Z',
          prepared_at: '2026-04-18T05:00:05Z',
          last_report_at: '2026-04-18T05:00:50Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 0,
          retry_count: 0,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-18T05:05:00Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-runner-mainline-policy-prior/run-runner-mainline-policy-prior.json',
          allowed_worker_ids: ['worker-agent'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-agent',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: null,
        },
        reports: [
          {
            at: '2026-04-18T05:00:50Z',
            status: 'completed',
            actor: 'worker-agent',
            step_id: 'report',
            note: 'Completed under an adopted mainline checkpoint policy.',
            commit_sha: null,
            worker_id: 'worker-agent',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Governed reusable workflow completed.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-runner-mainline-policy',
          branch_id: 'main',
          active_checkpoint_id: priorCheckpoint.id,
          checkpoint_ids: [priorCheckpoint.id],
          branch_event_ids: ['be-runner-mainline-policy-prior'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-runner-mainline-policy',
            runtime_status: 'completed',
            current_checkpoint_id: priorCheckpoint.id,
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T05:00:10Z',
            ended_at: '2026-04-18T05:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'execute',
            status: 'completed',
            started_at: '2026-04-18T05:00:21Z',
            ended_at: '2026-04-18T05:00:35Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'report',
            status: 'completed',
            started_at: '2026-04-18T05:00:36Z',
            ended_at: '2026-04-18T05:00:50Z',
            outputs: {},
            notes: 'Completed under inherited mainline checkpoint policy.',
          },
        ],
      },
    });
    assert.equal(priorRunResult.ok, true, JSON.stringify(priorRunResult.errors));

    const fixture = await createPreparingTaskFixture(
      ring,
      tempDir,
      'Mainline checkpoint policy reuse',
      workflow,
    );
    const { sessionId, runId } = await createRedispatchSession(ring, fixture.task, workflow);

    await ring.sessionRunner.tick();

    const preparedSession = await ring.read('session', sessionId);
    const preparedRun = await ring.read('workflow-run', runId);
    assert.equal(preparedSession.status, 'executing');
    assert.equal(preparedRun.status, 'running');
    assert.deepEqual(preparedRun.data.callback.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(preparedRun.data.callback.allowed_worker_ids, ['worker-agent']);
    assert.equal(preparedRun.data.callback.max_retries, 0);

    const preparedCheckpoint = await ring.read('checkpoint', preparedRun.data.node_execution.active_checkpoint_id);
    assert.equal(preparedCheckpoint.data.policy_snapshot.workflow_tightness, 'tight');
    assert.equal(preparedCheckpoint.data.policy_snapshot.oversight_strength, 'strong');
    assert.equal(preparedCheckpoint.data.policy_snapshot.branch_budget, 0);
    assert.match(preparedCheckpoint.data.policy_snapshot.notes ?? '', /Inherited mainline checkpoint policy/i);
    assert.match(preparedCheckpoint.data.policy_snapshot.notes ?? '', /cp-runner-mainline-policy-active/i);
    assert.match(preparedCheckpoint.data.policy_snapshot.notes ?? '', /branch_budget=1/i);
    assert.match(preparedCheckpoint.data.policy_snapshot.notes ?? '', /leaving branch_budget=0/i);
    assert.match(preparedCheckpoint.data.policy_snapshot.notes ?? '', /tight oversight for the next reuse/i);

    const preparedPacketPath = join(tempDir, preparedRun.data.steps[0].outputs.execution_packet_path);
    const preparedPacket = JSON.parse(await readFile(preparedPacketPath, 'utf-8'));
    assert.deepEqual(preparedPacket.callbacks.workflow_run_report.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(preparedPacket.callbacks.workflow_run_report.worker_identity.allowed_worker_ids, ['worker-agent']);
    assert.equal(preparedPacket.callbacks.workflow_run_report.retry_policy.max_retries, 0);

    const archivedWorkflow = await ring.update('workflow', workflow.id, {
      status: 'archived',
    });
    assert.equal(archivedWorkflow.ok, true, JSON.stringify(archivedWorkflow.errors));
  });

  it('tightens governed fallback sessions when automatic workflow reuse was blocked by warm lineage', async () => {
    const governedWorkflow = await ring.create('workflow', {
      id: 'wf-runner-fallback-lineage-hold',
      status: 'active',
      created_by: 'session-runner-test',
      data: {
        name: 'Runner Governed Fallback Hold',
        description: 'Reusable bug-fix workflow whose latest run already established warm semantic lineage.',
        applicable_to: ['bug-fix'],
        steps: [
          { id: 'inspect', name: 'Inspect', description: 'Inspect the regression context.' },
          { id: 'execute', name: 'Execute', description: 'Execute the fix.' },
          { id: 'verify', name: 'Verify', description: 'Verify the result.' },
        ],
      },
    });
    assert.equal(governedWorkflow.ok, true, JSON.stringify(governedWorkflow.errors));
    await ring.registry.recordScore('bug-fix', 'wf-runner-fallback-lineage-hold', 9.99);

    const warmLineageRun = await ring.create('workflow-run', {
      id: 'run-runner-fallback-lineage-hold',
      status: 'failed',
      created_by: 'session-runner',
      session_id: 'session-runner-fallback-lineage-hold',
      data: {
        workflow_template_id: 'wf-runner-fallback-lineage-hold',
        workflow_template_version: 1,
        task_id: 'task-runner-fallback-lineage-hold',
        current_step_index: 1,
        callback: {
          auth_scheme: 'bearer',
          report_url: '/api/workflow-run/run-runner-fallback-lineage-hold/report',
          token: 'token-runner-fallback-lineage-hold',
          signing_secret: 'secret-runner-fallback-lineage-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'timed_out',
          issued_at: '2026-04-18T03:00:00Z',
          prepared_at: '2026-04-18T03:00:05Z',
          last_report_at: '2026-04-18T03:00:40Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 120000,
          max_retries: 2,
          retry_count: 1,
          retry_backoff_ms: 30000,
          signature_ttl_ms: 300000,
          timeout_at: '2026-04-18T03:02:05Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-runner-fallback-lineage-hold/run-runner-fallback-lineage-hold.json',
          allowed_worker_ids: ['worker-agent'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-agent',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: 'Timed out after semantic progress already advanced checkpoint lineage.',
        },
        reports: [
          {
            at: '2026-04-18T03:00:40Z',
            status: 'progress',
            actor: 'worker-agent',
            step_id: 'execute',
            note: 'Warm semantic checkpoint lineage exists before timeout.',
            commit_sha: null,
            worker_id: 'worker-agent',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Semantic progress exists.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-runner-fallback-lineage-hold',
          branch_id: 'main',
          active_checkpoint_id: 'cp-runner-fallback-lineage-2',
          checkpoint_ids: [
            'cp-runner-fallback-root',
            'cp-runner-fallback-lineage-1',
            'cp-runner-fallback-lineage-2',
          ],
          branch_event_ids: ['be-runner-fallback-lineage-1'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-runner-fallback-lineage-hold',
            runtime_status: 'recovering',
            current_checkpoint_id: 'cp-runner-fallback-lineage-2',
            replay: {
              status: 'requested',
              requested_at: '2026-04-18T03:00:45Z',
              completed_at: null,
              requested_by: 'session-runner',
              reason: 'workflow_timeout',
              source_checkpoint_id: 'cp-runner-fallback-lineage-2',
              target_checkpoint_id: 'cp-runner-fallback-lineage-2',
              cursor: { phase: 'execute', step_id: 'execute' },
              journal_state: {
                mode: 'semantic',
                last_applied_entry_id: 'journal-runner-fallback-1',
                pending_entry_ids: ['journal-runner-fallback-2'],
              },
            },
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T03:00:10Z',
            ended_at: '2026-04-18T03:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'execute',
            status: 'failed',
            started_at: '2026-04-18T03:00:21Z',
            ended_at: '2026-04-18T03:01:00Z',
            outputs: {},
            notes: 'Timed out after semantic progress.',
          },
          {
            step_id: 'verify',
            status: 'pending',
            started_at: null,
            ended_at: null,
            outputs: {},
            notes: null,
          },
        ],
      },
    });
    assert.equal(warmLineageRun.ok, true, JSON.stringify(warmLineageRun.errors));

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-governed-fallback',
      payload: {
        goal: {
          title: 'Governed fallback session launch',
          description: 'Fix the governed failure with a fallback workflow after semantic timeout lineage.',
          acceptance_criteria: ['The replacement workflow starts under tighter oversight.'],
        },
        environment: {
          project_id: 'runner-governed-fallback-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['tests/governed-fallback.test.mjs'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-governed-fallback-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/governed-fallback',
            required: true,
            inline_data: '{"mode":"governed-fallback"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();

    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    assert.equal(launched.status, 'session_launched');
    assert.equal(launched.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.equal(launched.workflows.waiting_tasks[0].governance_blocked_reuse.length, 1);
    assert.equal(
      launched.workflows.waiting_tasks[0].governance_blocked_reuse[0].reason,
      'warm_semantic_lineage',
    );

    const session = await ring.read('session', launched.batching.session_id);
    const workflowRun = await ring.read('workflow-run', session.data.workflow_run_ids[0]);
    assert.equal(session.status, 'executing');
    assert.deepEqual(session.data.governance_context?.reasons, ['warm_semantic_lineage']);
    assert.equal(workflowRun.status, 'running');
    assert.deepEqual(workflowRun.data.callback.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(workflowRun.data.callback.allowed_worker_ids, ['worker-agent']);
    assert.equal(workflowRun.data.callback.max_retries, 0);

    const checkpoint = await ring.read('checkpoint', workflowRun.data.node_execution.active_checkpoint_id);
    assert.equal(checkpoint.data.policy_snapshot.workflow_tightness, 'tight');
    assert.equal(checkpoint.data.policy_snapshot.oversight_strength, 'strong');
    assert.equal(checkpoint.data.policy_snapshot.branch_budget, null);
    assert.match(checkpoint.data.policy_snapshot.notes ?? '', /governance-blocked fallback session/i);
    assert.match(checkpoint.data.policy_snapshot.notes ?? '', /warm_semantic_lineage/i);

    const packetPath = join(tempDir, workflowRun.data.steps[0].outputs.execution_packet_path);
    const packet = JSON.parse(await readFile(packetPath, 'utf-8'));
    assert.deepEqual(packet.callbacks.workflow_run_report.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(packet.callbacks.workflow_run_report.worker_identity.allowed_worker_ids, ['worker-agent']);
    assert.equal(packet.callbacks.workflow_run_report.retry_policy.max_retries, 0);

    const archivedGoverned = await ring.update('workflow', 'wf-runner-fallback-lineage-hold', {
      status: 'archived',
    });
    assert.equal(archivedGoverned.ok, true, JSON.stringify(archivedGoverned.errors));

    if (launched.workflows.generated_workflow_ids[0]) {
      const archivedGenerated = await ring.update(
        'workflow',
        launched.workflows.generated_workflow_ids[0],
        {
          status: 'archived',
        },
      );
      assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
    }
  });

  it('keeps governed fallback completions on synthesized lineage so automatic reuse stays blocked until adoption', async () => {
    const governedWorkflowId = 'wf-runner-fallback-completion-lineage-hold';
    const governedRunId = 'run-runner-fallback-completion-lineage-hold';
    const governedSessionId = 'session-runner-fallback-completion-lineage-hold';
    const governedTaskId = 'task-runner-fallback-completion-lineage-hold';
    const bundle = await ring.create('workflow', {
      id: governedWorkflowId,
      status: 'active',
      created_by: 'session-runner-test',
      data: {
        name: 'Runner Governed Fallback Completion Hold',
        description: 'Reusable bug-fix workflow whose warm lineage should force fallback completions to stay synthesized.',
        applicable_to: ['bug-fix'],
        steps: [
          { id: 'inspect', name: 'Inspect', description: 'Inspect the regression context.' },
          { id: 'execute', name: 'Execute', description: 'Execute the fix.' },
          { id: 'verify', name: 'Verify', description: 'Verify the result.' },
        ],
      },
    });
    assert.equal(bundle.ok, true, JSON.stringify(bundle.errors));
    await ring.registry.recordScore('bug-fix', governedWorkflowId, 9.98);

    const warmLineageRun = await ring.create('workflow-run', {
      id: governedRunId,
      status: 'failed',
      created_by: 'session-runner',
      session_id: governedSessionId,
      data: {
        workflow_template_id: governedWorkflowId,
        workflow_template_version: 1,
        task_id: governedTaskId,
        current_step_index: 1,
        callback: {
          auth_scheme: 'bearer',
          report_url: `/api/workflow-run/${governedRunId}/report`,
          token: 'token-runner-fallback-completion-lineage-hold',
          signing_secret: 'secret-runner-fallback-completion-lineage-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'timed_out',
          issued_at: '2026-04-18T04:00:00Z',
          prepared_at: '2026-04-18T04:00:05Z',
          last_report_at: '2026-04-18T04:00:40Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 120000,
          max_retries: 2,
          retry_count: 1,
          retry_backoff_ms: 30000,
          signature_ttl_ms: 300000,
          timeout_at: '2026-04-18T04:02:05Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-runner-fallback-completion-lineage-hold/run-runner-fallback-completion-lineage-hold.json',
          allowed_worker_ids: ['worker-agent'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-agent',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: 'Timed out after semantic progress already advanced checkpoint lineage.',
        },
        reports: [
          {
            at: '2026-04-18T04:00:40Z',
            status: 'progress',
            actor: 'worker-agent',
            step_id: 'execute',
            note: 'Warm semantic checkpoint lineage exists before timeout.',
            commit_sha: null,
            worker_id: 'worker-agent',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Semantic progress exists.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-runner-fallback-completion-lineage-hold',
          branch_id: 'main',
          active_checkpoint_id: 'cp-runner-fallback-completion-lineage-2',
          checkpoint_ids: [
            'cp-runner-fallback-completion-root',
            'cp-runner-fallback-completion-lineage-1',
            'cp-runner-fallback-completion-lineage-2',
          ],
          branch_event_ids: ['be-runner-fallback-completion-lineage-1'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-runner-fallback-completion-lineage-hold',
            runtime_status: 'recovering',
            current_checkpoint_id: 'cp-runner-fallback-completion-lineage-2',
            replay: {
              status: 'requested',
              requested_at: '2026-04-18T04:00:45Z',
              completed_at: null,
              requested_by: 'session-runner',
              reason: 'workflow_timeout',
              source_checkpoint_id: 'cp-runner-fallback-completion-lineage-2',
              target_checkpoint_id: 'cp-runner-fallback-completion-lineage-2',
              cursor: { phase: 'execute', step_id: 'execute' },
              journal_state: {
                mode: 'semantic',
                last_applied_entry_id: 'journal-runner-fallback-completion-1',
                pending_entry_ids: ['journal-runner-fallback-completion-2'],
              },
            },
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T04:00:10Z',
            ended_at: '2026-04-18T04:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'execute',
            status: 'failed',
            started_at: '2026-04-18T04:00:21Z',
            ended_at: '2026-04-18T04:01:00Z',
            outputs: {},
            notes: 'Timed out after semantic progress.',
          },
          {
            step_id: 'verify',
            status: 'pending',
            started_at: null,
            ended_at: null,
            outputs: {},
            notes: null,
          },
        ],
      },
    });
    assert.equal(warmLineageRun.ok, true, JSON.stringify(warmLineageRun.errors));

    const launchBundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-governed-fallback-completion',
      payload: {
        goal: {
          title: 'Governed fallback completion lineage',
          description: 'Fix the governed failure with a fallback workflow whose successful completion should still require explicit adoption.',
          acceptance_criteria: ['Governed fallback completion stays synthesized until adoption.'],
        },
        environment: {
          project_id: 'runner-governed-fallback-completion-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-governed-fallback-completion-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/governed-fallback-completion',
            required: true,
            inline_data: '{"mode":"governed-fallback-completion"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();

    const launched = await ring.orchestrator.readDispatchBundle(launchBundle.id);
    assert.equal(launched.status, 'session_launched');
    assert.equal(launched.workflows.waiting_tasks[0].workflow_source, 'custom_generated');

    const session = await ring.read('session', launched.batching.session_id);
    const runId = session.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', runId);
    const generatedWorkflowId = preparedRun.data.workflow_template_id;
    const priorCheckpointId = preparedRun.data.node_execution.active_checkpoint_id;

    await writeFile(join(tempDir, 'README.md'), '# Governed Fallback Completion\n', 'utf-8');
    await run('git', ['add', 'README.md'], tempDir);
    await run('git', ['commit', '-m', 'governed fallback completion'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();

    const completionPayload = {
      status: 'completed',
      actor: 'worker-agent',
      note: 'Governed fallback finished under tighter oversight.',
      commit_sha: commitSha,
    };
    const completionResult = await ring.sessionRunner.reportWorkflowRun(
      runId,
      completionPayload,
      signedHeaders(preparedRun, completionPayload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );
    assert.equal(completionResult.workflow_run.status, 'completed');

    const completedRun = await ring.read('workflow-run', runId);
    const completedCheckpoint = await ring.read('checkpoint', completedRun.data.node_execution.active_checkpoint_id);
    assert.equal(completedCheckpoint.status, 'synthesized');
    assert.equal(completedCheckpoint.data.adoption_status, 'synthesized');
    assert.deepEqual(completedCheckpoint.data.synthesis_inputs, [priorCheckpointId]);
    assert.match(completedCheckpoint.data.policy_snapshot.notes ?? '', /governance-blocked fallback completion/i);
    assert.match(completedCheckpoint.data.policy_snapshot.notes ?? '', /explicit adoption decision/i);
    assert.match(completedCheckpoint.data.policy_snapshot.notes ?? '', /warm_semantic_lineage/i);

    await ring.registry.recordScore('bug-fix', generatedWorkflowId, 10.5);

    const followupBundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-governed-fallback-followup',
      payload: {
        goal: {
          title: 'Governed fallback follow-up reuse check',
          description: 'Fix the next governed failure without blindly reusing a template that only completed on synthesized lineage.',
          acceptance_criteria: ['Automatic workflow reuse stays blocked until adoption.'],
        },
        environment: {
          project_id: 'runner-governed-fallback-followup-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-governed-fallback-followup-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/governed-fallback-followup',
            required: true,
            inline_data: '{"mode":"governed-fallback-followup"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const followup = await ring.orchestrator.readDispatchBundle(followupBundle.id);
    assert.equal(followup.status, 'session_launched');
    assert.equal(followup.workflows.reused_workflow_ids.length, 0);
    assert.equal(followup.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.ok(
      followup.workflows.waiting_tasks[0].governance_blocked_reuse.some(
        (item) => item.id === generatedWorkflowId && item.reason === 'checkpoint_synthesized',
      ),
    );

    for (const workflowId of new Set([
      governedWorkflowId,
      generatedWorkflowId,
      ...followup.workflows.generated_workflow_ids,
    ].filter(Boolean))) {
      const archived = await ring.update('workflow', workflowId, {
        status: 'archived',
      });
      assert.equal(archived.ok, true, JSON.stringify(archived.errors));
    }
  });

  it('accepts workflow-run completion reports, finalizes tasks, and closes the session after judgement', async () => {
    const linkage = {
      publication_root_id: 'pr-session-runner-complete',
      validation_report_id: 'vrpt-session-runner-complete',
      trace_id: 'trace-session-runner-complete',
      span_id: 'span-session-runner-complete',
      parent_span_id: 'span-session-runner-complete-parent',
    };
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-report',
      payload: {
        trace: {
          trace_id: linkage.trace_id,
          span_id: linkage.span_id,
          parent_span_id: linkage.parent_span_id,
          source_kind: 'session-runner-report',
        },
        goal: {
          title: 'Workflow Run Completion',
          description: 'A completed workflow run should finalize the task and move the session to closure.',
          acceptance_criteria: ['Task reaches judgement'],
        },
        environment: {
          project_id: 'runner-report-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-complete-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-complete',
            required: true,
            inline_data: '{"stage":"complete"}',
          },
        ],
        context: {
          publication_root_id: linkage.publication_root_id,
          validation_report_id: linkage.validation_report_id,
        },
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];

    await writeFile(join(tempDir, 'README.md'), '# Session Runner Updated\n', 'utf-8');
    await run('git', ['add', 'README.md'], tempDir);
    await run('git', ['commit', '-m', 'runner update'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const workflowRun = await ring.read('workflow-run', runId);
    const preparedValidation = await readValidationArtifactsForCheckpoint(
      ring,
      workflowRun.data.node_execution.active_checkpoint_id,
    );
    const payload = {
      status: 'completed',
      commit_sha: commitSha,
      actor: 'worker-agent',
      note: 'Execution finished and is ready for verification.',
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(workflowRun, payload),
    );

    assert.equal(reported.workflow_run.status, 'completed');
    assert.equal(reported.task.status, 'in_progress');
    assert.equal(reported.task.data.execution.review_status, 'awaiting_judgement');
    assert.ok(reported.task.data.execution.summary_path);

    const reviewingTick = await ring.sessionRunner.tick();
    const reviewingSession =
      reviewingTick.processed.find((item) => item.id === sessionId) ??
      await ring.read('session', sessionId);
    assert.equal(reviewingSession.status, 'reviewing');

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'Looks correct.',
    });
    assert.equal(judgedTask.status, 'completed');

    await ring.sessionRunner.tick();
    const closingSession = await ring.read('session', sessionId);
    assert.equal(closingSession.status, 'closing');

    await ring.sessionRunner.tick();
    const closedSession = await ring.read('session', sessionId);
    assert.equal(closedSession.status, 'closed');

    const recovered = await ring.sessionRunner.recoverWorkflowRunNodeState(runId);
    assert.ok(recovered);
    assert.equal(recovered.node.id, workflowRun.data.node_execution.node_id);
    assert.equal(recovered.active_checkpoint.id, recovered.workflow_run.data.node_execution.active_checkpoint_id);
    assert.ok(recovered.lineage.length >= 2);
    assert.equal(recovered.capsule_state.current_checkpoint_id, recovered.active_checkpoint.id);
    assert.equal(recovered.active_checkpoint.data.publication_root_id, linkage.publication_root_id);
    assert.notEqual(recovered.active_checkpoint.data.validation_report_id, linkage.validation_report_id);
    assert.notEqual(
      recovered.active_checkpoint.data.validation_report_id,
      preparedValidation.checkpoint.data.validation_report_id,
    );
    assert.equal(recovered.active_checkpoint.data.trace_id, linkage.trace_id);
    assert.equal(recovered.active_checkpoint.data.span_id, linkage.span_id);
    assert.equal(recovered.active_checkpoint.data.parent_span_id, linkage.parent_span_id);

    const completionValidation = await readValidationArtifactsForCheckpoint(ring, recovered.active_checkpoint.id);
    assert.equal(completionValidation.report.id, recovered.active_checkpoint.data.validation_report_id);
    assert.deepEqual(completionValidation.report.data.subject_ref, {
      type: 'checkpoint',
      id: recovered.active_checkpoint.id,
    });
    assert.equal(completionValidation.report.data.profile_id, 'workflow-run-callback-profile-v1');
    assert.equal(completionValidation.report.data.conforms, true);
    assert.equal(completionValidation.report.data.outcome, 'conformant');
    assert.deepEqual(completionValidation.report.data.result_ids, []);
    assert.deepEqual(completionValidation.report.data.summary, {
      info: 0,
      warning: 0,
      violation: 0,
    });
    assert.deepEqual(completionValidation.results, []);

    const continuedEvent = recovered.branch_events.find((item) => item.data.event_type === 'checkpoint_continued');
    assert.ok(continuedEvent);
    assert.equal(continuedEvent.data.publication_root_id, linkage.publication_root_id);
    assert.equal(continuedEvent.data.validation_report_id, completionValidation.report.id);
    assert.equal(continuedEvent.data.trace_id, linkage.trace_id);
    assert.equal(continuedEvent.data.span_id, linkage.span_id);
    assert.equal(continuedEvent.data.parent_span_id, linkage.parent_span_id);
  });

  it('emits blocking validation artifacts for failed workflow-run callback reports', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-failure-report',
      payload: {
        goal: {
          title: 'Workflow Run Failure Validation',
          description: 'A failed workflow-run callback should emit a blocking validation report and durable results.',
          acceptance_criteria: ['Failure callback creates validation artifacts'],
        },
        environment: {
          project_id: 'runner-failure-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-failure-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-failure',
            required: true,
            inline_data: '{"stage":"failure"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const runId = session.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', runId);
    const rootCheckpointId = preparedRun.data.node_execution.active_checkpoint_id;
    const failureNote = 'Validation shell should retain this workflow failure note.';
    const payload = {
      status: 'failed',
      actor: 'worker-agent',
      note: failureNote,
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(preparedRun, payload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );

    assert.equal(reported.workflow_run.status, 'failed');
    assert.equal(reported.task.status, 'failed');
    assert.equal(reported.task.data.replanning.status, 'awaiting_replan');
    assert.equal(reported.session.status, 'failed');

    const failedRun = await ring.read('workflow-run', runId);
    const failedValidation = await readValidationArtifactsForCheckpoint(
      ring,
      failedRun.data.node_execution.active_checkpoint_id,
    );
    assert.notEqual(failedValidation.checkpoint.id, rootCheckpointId);
    assert.ok(failedValidation.report);
    assert.equal(failedValidation.report.id, failedValidation.checkpoint.data.validation_report_id);
    assert.deepEqual(failedValidation.report.data.subject_ref, {
      type: 'checkpoint',
      id: failedValidation.checkpoint.id,
    });
    assert.equal(failedValidation.report.data.profile_id, 'workflow-run-callback-profile-v1');
    assert.equal(failedValidation.report.data.conforms, false);
    assert.equal(failedValidation.report.data.outcome, 'blocking');
    assert.ok(failedValidation.report.data.result_ids.length >= 1);
    assert.equal(failedValidation.report.data.summary.info, 0);
    assert.equal(failedValidation.report.data.summary.warning, 0);
    assert.ok(failedValidation.report.data.summary.violation >= 1);
    assert.ok(failedValidation.results.length >= 1);

    const primaryResult = failedValidation.results[0];
    assert.equal(primaryResult.data.report_id, failedValidation.report.id);
    assert.deepEqual(primaryResult.data.subject_ref, {
      type: 'checkpoint',
      id: failedValidation.checkpoint.id,
    });
    assert.equal(primaryResult.data.rule_id, 'workflow-run-callback-status');
    assert.equal(primaryResult.data.severity, 'violation');
    assert.equal(primaryResult.data.message, failureNote);

    const recovered = await ring.sessionRunner.recoverWorkflowRunNodeState(runId);
    assert.equal(recovered.active_checkpoint.data.validation_report_id, failedValidation.report.id);
    const continuedEvent = recovered.branch_events.find((item) => item.data.event_type === 'checkpoint_continued');
    const recoveryEvent = recovered.branch_events.find((item) => item.data.event_type === 'recovery_triggered');
    assert.ok(continuedEvent);
    assert.ok(recoveryEvent);
    assert.equal(continuedEvent.data.validation_report_id, failedValidation.report.id);
    assert.equal(recoveryEvent.data.validation_report_id, failedValidation.report.id);
  });

  it('requests semantic replay from node capsule lineage when a workflow run times out', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-timeout',
      payload: {
        goal: {
          title: 'Workflow Run Timeout Recovery',
          description: 'Timeouts should trigger semantic replay state in the node capsule.',
          acceptance_criteria: ['Replay is requested from checkpoint lineage'],
        },
        environment: {
          project_id: 'runner-timeout-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-timeout-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-timeout',
            required: true,
            inline_data: '{"stage":"timeout"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const runId = session.data.workflow_run_ids[0];
    const workflowRun = await ring.read('workflow-run', runId);

    const expired = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          retry_count: workflowRun.data.callback.max_retries,
          timeout_at: '2000-01-01T00:00:00Z',
        },
      },
    });
    assert.equal(expired.ok, true, JSON.stringify(expired.errors));

    await ring.sessionRunner.tick();
    const failedRun = await ring.read('workflow-run', runId);
    assert.equal(failedRun.status, 'failed');
    assert.ok(failedRun.data.node_execution.checkpoint_ids.length >= 2);
    assert.ok(failedRun.data.node_execution.branch_event_ids.length >= 3);

    const recovered = await ring.sessionRunner.recoverWorkflowRunNodeState(runId);
    assert.ok(recovered);
    assert.equal(recovered.capsule_state.replay.status, 'requested');
    assert.equal(recovered.active_checkpoint.id, failedRun.data.node_execution.active_checkpoint_id);
    assert.ok(recovered.lineage.length >= 2);
    assert.ok(recovered.branch_events.some((item) => item.data.event_type === 'recovery_triggered'));
  });

  it('skips blind callback retry once checkpoint lineage has advanced beyond the root checkpoint', async () => {
    await ring.orchestrator.updateConfig({
      session_runner: {
        report_timeout_ms: 10,
        max_report_retries: 3,
        retry_backoff_ms: 10,
        signature_ttl_ms: 300_000,
      },
    });

    const linkage = {
      publication_root_id: 'pr-session-runner-lineage-timeout',
      validation_report_id: 'vrpt-session-runner-lineage-timeout',
      trace_id: 'trace-session-runner-lineage-timeout',
      span_id: 'span-session-runner-lineage-timeout',
      parent_span_id: 'span-session-runner-lineage-timeout-parent',
    };
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-lineage-timeout',
      payload: {
        trace: {
          trace_id: linkage.trace_id,
          span_id: linkage.span_id,
          parent_span_id: linkage.parent_span_id,
          source_kind: 'session-runner-lineage-timeout',
        },
        goal: {
          title: 'Workflow Run Timeout With Lineage',
          description: 'Once a workflow-run has semantic checkpoint lineage, timeout handling should stop doing blind callback retries.',
          acceptance_criteria: ['Warm workflow-run timeout skips blind retry'],
        },
        environment: {
          project_id: 'runner-lineage-timeout-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-lineage-timeout-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-lineage-timeout',
            required: true,
            inline_data: '{"stage":"lineage-timeout"}',
          },
        ],
        context: {
          publication_root_id: linkage.publication_root_id,
          validation_report_id: linkage.validation_report_id,
        },
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', runId);
    const preparedCheckpoint = await ring.read('checkpoint', preparedRun.data.node_execution.active_checkpoint_id);
    const progressPayload = {
      status: 'progress',
      actor: 'worker-agent',
      note: 'First semantic checkpoint recorded before timeout.',
    };

    const progressReport = await ring.sessionRunner.reportWorkflowRun(
      runId,
      progressPayload,
      signedHeaders(preparedRun, progressPayload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );
    assert.equal(progressReport.workflow_run.status, 'running');

    const progressedRun = await ring.read('workflow-run', runId);
    const progressedCheckpoint = await ring.read('checkpoint', progressedRun.data.node_execution.active_checkpoint_id);
    const refreshedPacket = JSON.parse(
      await readFile(join(tempDir, progressedRun.data.callback.packet_path), 'utf-8'),
    );
    assert.ok(progressedRun.data.node_execution.checkpoint_ids.length >= 2);
    assert.equal(progressedRun.data.callback.retry_count, 0);
    assert.equal(refreshedPacket.node.active_checkpoint_id, progressedRun.data.node_execution.active_checkpoint_id);
    assert.equal(refreshedPacket.context.publication_root_id, linkage.publication_root_id);
    assert.equal(refreshedPacket.context.validation_report_id, progressedCheckpoint.data.validation_report_id);
    assert.notEqual(
      refreshedPacket.context.validation_report_id,
      preparedCheckpoint.data.validation_report_id,
    );
    assert.equal(refreshedPacket.context.trace_id, linkage.trace_id);
    assert.equal(refreshedPacket.context.span_id, linkage.span_id);
    assert.equal(refreshedPacket.context.parent_span_id, linkage.parent_span_id);

    const expired = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...progressedRun.data.callback,
          timeout_at: '2000-01-01T00:00:00Z',
        },
      },
    });
    assert.equal(expired.ok, true, JSON.stringify(expired.errors));

    await ring.sessionRunner.tick();

    const failedRun = await ring.read('workflow-run', runId);
    const failedTask = await ring.read('task', taskId);
    const failedSession = await ring.read('session', sessionId);
    assert.equal(failedRun.status, 'failed');
    assert.equal(failedRun.data.callback.status, 'timed_out');
    assert.equal(failedRun.data.callback.retry_count, 0);
    assert.match(failedRun.data.callback.last_error, /skipping blind callback retry/);
    assert.equal(failedTask.status, 'failed');
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');
    assert.equal(failedSession.status, 'failed');

    const recovered = await ring.sessionRunner.recoverWorkflowRunNodeState(runId);
    assert.ok(recovered);
    assert.equal(recovered.capsule_state.replay.status, 'requested');
    assert.ok(recovered.lineage.length >= 3);
    assert.ok(recovered.branch_events.some((item) => item.data.event_type === 'recovery_triggered'));
  });

  it('tightens callback dispatch policy when a warm-lineage timeout is explicitly redispatched', async () => {
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: false,
      },
      session_runner: {
        report_timeout_ms: 10,
        max_report_retries: 3,
        retry_backoff_ms: 10,
        signature_ttl_ms: 300_000,
      },
    });

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-lineage-governed-redispatch',
      payload: {
        goal: {
          title: 'Governed Warm-Lineage Redispatch',
          description: 'Explicit workflow reuse after warm semantic checkpoint lineage should tighten the next dispatch contract.',
          acceptance_criteria: ['Redispatched execution uses a tighter callback governance profile'],
        },
        environment: {
          project_id: 'runner-lineage-governed-redispatch',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-lineage-governed-redispatch-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-lineage-governed-redispatch',
            required: true,
            inline_data: '{"stage":"governed-redispatch"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const originalSessionId = launched.batching.session_id;
    const originalSession = await ring.read('session', originalSessionId);
    const originalTaskId = originalSession.data.task_ids[0];
    const originalRunId = originalSession.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', originalRunId);
    const progressPayload = {
      status: 'progress',
      actor: 'worker-agent',
      note: 'Warm semantic checkpoint lineage established before timeout.',
    };

    await ring.sessionRunner.reportWorkflowRun(
      originalRunId,
      progressPayload,
      signedHeaders(preparedRun, progressPayload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );

    const progressedRun = await ring.read('workflow-run', originalRunId);
    const expired = await ring.update('workflow-run', originalRunId, {
      data: {
        callback: {
          ...progressedRun.data.callback,
          timeout_at: '2000-01-01T00:00:00Z',
        },
      },
    });
    assert.equal(expired.ok, true, JSON.stringify(expired.errors));

    await ring.sessionRunner.tick();

    const failedTask = await ring.read('task', originalTaskId);
    assert.equal(failedTask.status, 'failed');
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');

    const replannedTask = await ring.taskExecution.replan(originalTaskId, {
      verdict: 'redispatch',
      replanner_agent_id: 'task-replanner',
      note: 'Explicitly reuse the existing workflow template under tighter governance.',
      task: {
        workflow_template_id: failedTask.data.workflow_template_id,
      },
    });
    assert.equal(replannedTask.data.replanning.status, 'redispatched');

    const successorTask = await ring.read('task', replannedTask.data.replanning.successor_task_id);
    assert.equal(successorTask.status, 'ready');
    assert.equal(successorTask.data.workflow_template_id, failedTask.data.workflow_template_id);

    const workflow = await ring.read('workflow', successorTask.data.workflow_template_id);
    const { sessionId, runId } = await createRedispatchSession(ring, successorTask, workflow);

    await ring.sessionRunner.tick();

    const governedSession = await ring.read('session', sessionId);
    const governedRun = await ring.read('workflow-run', runId);
    assert.equal(governedSession.status, 'executing');
    assert.equal(governedRun.status, 'running');
    assert.deepEqual(governedRun.data.callback.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(governedRun.data.callback.allowed_worker_ids, ['worker-agent']);
    assert.equal(governedRun.data.callback.max_retries, 0);

    const packetPath = join(tempDir, governedRun.data.steps[0].outputs.execution_packet_path);
    const packet = JSON.parse(await readFile(packetPath, 'utf-8'));
    assert.deepEqual(packet.callbacks.workflow_run_report.accepted_protocols, ['ring.workflow-run-report.v1']);
    assert.deepEqual(packet.callbacks.workflow_run_report.worker_identity.allowed_worker_ids, ['worker-agent']);
    assert.equal(packet.callbacks.workflow_run_report.retry_policy.max_retries, 0);

    const checkpoint = await ring.read('checkpoint', governedRun.data.node_execution.active_checkpoint_id);
    assert.equal(checkpoint.data.policy_snapshot.workflow_tightness, 'tight');
    assert.equal(checkpoint.data.policy_snapshot.oversight_strength, 'strong');
    assert.equal(checkpoint.data.policy_snapshot.branch_budget, 0);
    assert.match(checkpoint.data.policy_snapshot.notes ?? '', new RegExp(originalRunId));

    await writeFile(join(tempDir, 'README.md'), '# Governed Warm-Lineage Redispatch\n', 'utf-8');
    await run('git', ['add', 'README.md'], tempDir);
    await run('git', ['commit', '-m', 'governed redispatch'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const completionPayload = {
      status: 'completed',
      commit_sha: commitSha,
      actor: 'worker-agent',
      note: 'Governed redispatch completed under tighter callback policy.',
    };
    await ring.sessionRunner.reportWorkflowRun(
      runId,
      completionPayload,
      signedHeaders(governedRun, completionPayload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );
    await ring.sessionRunner.tick();
    await ring.taskExecution.judge(successorTask.id, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'Governed redispatch looks correct.',
    });
    await ring.sessionRunner.tick();
    await ring.sessionRunner.tick();
    const closedSession = await ring.read('session', sessionId);
    assert.equal(closedSession.status, 'closed');
  });

  it('marks a governed warm-lineage redispatch terminal when branch budget is already exhausted', async () => {
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: false,
      },
      session_runner: {
        report_timeout_ms: 10,
        max_report_retries: 3,
        retry_backoff_ms: 10,
        signature_ttl_ms: 300_000,
      },
    });

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-lineage-terminal-redispatch',
      payload: {
        goal: {
          title: 'Governed Warm-Lineage Terminal Redispatch',
          description: 'A tighter redispatch that already consumed warm checkpoint lineage should not reopen another replanning loop after timeout.',
          acceptance_criteria: ['Timeout after governed redispatch becomes terminal instead of redispatchable'],
        },
        environment: {
          project_id: 'runner-lineage-terminal-redispatch',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-lineage-terminal-redispatch-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-lineage-terminal-redispatch',
            required: true,
            inline_data: '{"stage":"terminal-redispatch"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const originalSession = await ring.read('session', launched.batching.session_id);
    const originalTaskId = originalSession.data.task_ids[0];
    const originalRunId = originalSession.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', originalRunId);
    const progressPayload = {
      status: 'progress',
      actor: 'worker-agent',
      note: 'Warm semantic checkpoint lineage established before timeout.',
    };

    await ring.sessionRunner.reportWorkflowRun(
      originalRunId,
      progressPayload,
      signedHeaders(preparedRun, progressPayload, {
        workerId: 'worker-agent',
        includeKeyVersion: true,
      }),
    );

    const progressedRun = await ring.read('workflow-run', originalRunId);
    const expiredOriginal = await ring.update('workflow-run', originalRunId, {
      data: {
        callback: {
          ...progressedRun.data.callback,
          timeout_at: '2000-01-01T00:00:00Z',
        },
      },
    });
    assert.equal(expiredOriginal.ok, true, JSON.stringify(expiredOriginal.errors));

    await ring.sessionRunner.tick();

    const failedTask = await ring.read('task', originalTaskId);
    const replannedTask = await ring.taskExecution.replan(originalTaskId, {
      verdict: 'redispatch',
      replanner_agent_id: 'task-replanner',
      note: 'Explicitly reuse the existing workflow template under tighter governance.',
      task: {
        workflow_template_id: failedTask.data.workflow_template_id,
      },
    });
    const successorTaskId = replannedTask.data.replanning.successor_task_id;
    const successorTask = await ring.read('task', successorTaskId);
    const workflow = await ring.read('workflow', successorTask.data.workflow_template_id);
    const { sessionId, runId } = await createRedispatchSession(ring, successorTask, workflow);

    await ring.sessionRunner.tick();

    const governedRun = await ring.read('workflow-run', runId);
    assert.equal(governedRun.data.callback.max_retries, 0);
    const rootCheckpoint = await ring.read('checkpoint', governedRun.data.node_execution.active_checkpoint_id);
    assert.equal(rootCheckpoint.data.policy_snapshot.branch_budget, 0);

    const expiredGoverned = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...governedRun.data.callback,
          timeout_at: '2000-01-01T00:00:00Z',
        },
      },
    });
    assert.equal(expiredGoverned.ok, true, JSON.stringify(expiredGoverned.errors));

    await ring.sessionRunner.tick();

    const failedGovernedTask = await ring.read('task', successorTaskId);
    const failedGovernedRun = await ring.read('workflow-run', runId);
    const failedGovernedSession = await ring.read('session', sessionId);
    assert.equal(failedGovernedRun.status, 'failed');
    assert.equal(failedGovernedRun.data.callback.status, 'timed_out');
    assert.equal(failedGovernedRun.data.callback.retry_count, 0);
    assert.equal(failedGovernedTask.status, 'failed');
    assert.equal(failedGovernedTask.data.replanning.status, 'terminal');
    assert.equal(failedGovernedTask.data.replanning.successor_task_id, null);
    assert.match(failedGovernedTask.data.replanning.decision_note ?? '', /branch_budget=0/i);
    assert.match(failedGovernedTask.data.replanning.decision_note ?? '', /no further redispatch/i);
    assert.equal(failedGovernedSession.status, 'failed');
    assert.ok(
      failedGovernedSession.data.execution_log.some((entry) =>
        /marked terminal because checkpoint policy exhausted the branch budget/i.test(entry.detail ?? '')
      ),
    );
    const timeoutReport = failedGovernedRun.data.reports.at(-1);
    assert.equal(timeoutReport.status, 'timed_out');
    assert.equal(timeoutReport.outputs.replanning_status, 'terminal');
    assert.equal(timeoutReport.outputs.branch_budget, 0);
  });

  it('accepts A2A-style workflow-run envelopes from registered workers', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-a2a',
      payload: {
        goal: {
          title: 'Workflow Run A2A Envelope',
          description: 'A registered A2A worker should be able to finalize a task through the transport adapter.',
          acceptance_criteria: ['A2A report is normalized'],
        },
        environment: {
          project_id: 'runner-a2a-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-a2a-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-a2a',
            required: true,
            inline_data: '{"stage":"a2a"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];

    await writeFile(join(tempDir, 'README.md'), '# Session Runner A2A\n', 'utf-8');
    await run('git', ['add', 'README.md'], tempDir);
    await run('git', ['commit', '-m', 'runner a2a update'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const workflowRun = await ring.read('workflow-run', runId);
    const a2aReady = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          accepted_protocols: [
            ...new Set([...(workflowRun.data.callback.accepted_protocols ?? []), 'a2a.task-status.v1']),
          ],
          allowed_worker_ids: [
            ...new Set([...(workflowRun.data.callback.allowed_worker_ids ?? []), 'a2a-worker']),
          ],
        },
      },
    });
    assert.equal(a2aReady.ok, true, JSON.stringify(a2aReady.errors));
    const a2aWorkflowRun = await ring.read('workflow-run', runId);
    const currentStepId = a2aWorkflowRun.data.steps[a2aWorkflowRun.data.current_step_index].step_id;
    const payload = {
      protocol: 'a2a.task-status.v1',
      worker: {
        id: 'a2a-worker',
        display_name: 'A2A Bridge Worker',
      },
      task: {
        id: runId,
        kind: 'workflow-run',
        status: {
          state: 'completed',
          message: 'A2A execution finished.',
        },
        artifacts: [
          {
            kind: 'git_commit',
            uri: `git+commit://${commitSha}`,
          },
          {
            kind: 'file',
            uri: 'artifact://dist/report.txt',
          },
        ],
        metadata: {
          step_id: currentStepId,
          judge_agent_id: 'task-judge',
          outputs: {
            artifact_path: 'dist/report.txt',
          },
        },
      },
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(a2aWorkflowRun, payload, {
        workerId: 'a2a-worker',
        includeKeyVersion: true,
      }),
    );

    assert.equal(reported.workflow_run.status, 'completed');
    assert.equal(reported.task.status, 'in_progress');
    assert.equal(reported.task.data.execution.review_status, 'awaiting_judgement');

    const completedRun = await ring.read('workflow-run', runId);
    assert.equal(completedRun.data.callback.last_protocol, 'a2a.task-status.v1');
    assert.equal(completedRun.data.callback.last_worker_id, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.actor, 'A2A Bridge Worker');
    assert.equal(completedRun.data.reports.at(-1)?.worker_id, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.protocol, 'a2a.task-status.v1');

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'A2A report normalized correctly.',
    });
    assert.equal(judgedTask.status, 'completed');
  });

  it('normalizes blank A2A worker display names to the worker id', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-a2a-blank-display-name',
      payload: {
        goal: {
          title: 'Workflow Run A2A Blank Display Name',
          description: 'Blank A2A worker display names should fall back to the durable worker id in persisted reports.',
          acceptance_criteria: ['A2A blank display name falls back to worker id'],
        },
        environment: {
          project_id: 'runner-a2a-blank-display-name-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['A2A_BLANK.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-a2a-blank-display-name-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-a2a-blank-display-name',
            required: true,
            inline_data: '{"stage":"a2a-blank-display-name"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];

    await writeFile(join(tempDir, 'A2A_BLANK.md'), '# Session Runner A2A Blank Display Name\n', 'utf-8');
    await run('git', ['add', 'A2A_BLANK.md'], tempDir);
    await run('git', ['commit', '-m', 'runner a2a blank display name update'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const workflowRun = await ring.read('workflow-run', runId);
    const a2aReady = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          accepted_protocols: [
            ...new Set([...(workflowRun.data.callback.accepted_protocols ?? []), 'a2a.task-status.v1']),
          ],
          allowed_worker_ids: [
            ...new Set([...(workflowRun.data.callback.allowed_worker_ids ?? []), 'a2a-worker']),
          ],
        },
      },
    });
    assert.equal(a2aReady.ok, true, JSON.stringify(a2aReady.errors));
    const a2aWorkflowRun = await ring.read('workflow-run', runId);
    const currentStepId = a2aWorkflowRun.data.steps[a2aWorkflowRun.data.current_step_index].step_id;
    const payload = {
      protocol: 'a2a.task-status.v1',
      worker: {
        id: 'a2a-worker',
        display_name: '   ',
      },
      task: {
        id: runId,
        kind: 'workflow-run',
        status: {
          state: 'completed',
          message: 'A2A execution finished.',
        },
        artifacts: [
          {
            kind: 'git_commit',
            uri: `git+commit://${commitSha}`,
          },
        ],
        metadata: {
          step_id: currentStepId,
          judge_agent_id: 'task-judge',
          outputs: {
            artifact_path: 'A2A_BLANK.md',
          },
        },
      },
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(a2aWorkflowRun, payload, {
        workerId: 'a2a-worker',
        includeKeyVersion: true,
      }),
    );

    assert.equal(reported.workflow_run.status, 'completed');
    assert.equal(reported.task.status, 'in_progress');

    const completedRun = await ring.read('workflow-run', runId);
    assert.equal(completedRun.data.reports.at(-1)?.actor, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.worker_id, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.protocol, 'a2a.task-status.v1');

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'Blank A2A display names now fall back to worker ids.',
    });
    assert.equal(judgedTask.status, 'completed');
  });

  it('normalizes blank A2A note strings to null', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-a2a-blank-note',
      payload: {
        goal: {
          title: 'Workflow Run A2A Blank Note',
          description: 'Blank A2A note strings should normalize to null instead of persisting whitespace-only report notes.',
          acceptance_criteria: ['A2A blank note strings normalize to null'],
        },
        environment: {
          project_id: 'runner-a2a-blank-note-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['A2A_BLANK_NOTE.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-a2a-blank-note-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-a2a-blank-note',
            required: true,
            inline_data: '{"stage":"a2a-blank-note"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];

    await writeFile(join(tempDir, 'A2A_BLANK_NOTE.md'), '# Session Runner A2A Blank Note\n', 'utf-8');
    await run('git', ['add', 'A2A_BLANK_NOTE.md'], tempDir);
    await run('git', ['commit', '-m', 'runner a2a blank note update'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const workflowRun = await ring.read('workflow-run', runId);
    const a2aReady = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          accepted_protocols: [
            ...new Set([...(workflowRun.data.callback.accepted_protocols ?? []), 'a2a.task-status.v1']),
          ],
          allowed_worker_ids: [
            ...new Set([...(workflowRun.data.callback.allowed_worker_ids ?? []), 'a2a-worker']),
          ],
        },
      },
    });
    assert.equal(a2aReady.ok, true, JSON.stringify(a2aReady.errors));
    const a2aWorkflowRun = await ring.read('workflow-run', runId);
    const currentStepId = a2aWorkflowRun.data.steps[a2aWorkflowRun.data.current_step_index].step_id;
    const currentStepNote = a2aWorkflowRun.data.steps[a2aWorkflowRun.data.current_step_index].notes;
    const payload = {
      protocol: 'a2a.task-status.v1',
      worker: {
        id: 'a2a-worker',
        display_name: 'A2A Bridge Worker',
      },
      task: {
        id: runId,
        kind: 'workflow-run',
        status: {
          state: 'completed',
          message: '   ',
        },
        artifacts: [
          {
            kind: 'git_commit',
            uri: `git+commit://${commitSha}`,
          },
        ],
        metadata: {
          step_id: currentStepId,
          note: '   ',
          judge_agent_id: 'task-judge',
          outputs: {
            artifact_path: 'A2A_BLANK_NOTE.md',
          },
        },
      },
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(a2aWorkflowRun, payload, {
        workerId: 'a2a-worker',
        includeKeyVersion: true,
      }),
    );

    assert.equal(reported.workflow_run.status, 'completed');
    assert.equal(reported.task.status, 'in_progress');

    const completedRun = await ring.read('workflow-run', runId);
    assert.equal(completedRun.data.reports.at(-1)?.note, null);
    assert.equal(completedRun.data.steps.find((step) => step.step_id === currentStepId)?.notes, currentStepNote);

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'Blank A2A note strings now normalize to null.',
    });
    assert.equal(judgedTask.status, 'completed');
  });

  it('normalizes blank A2A step ids to the current workflow step', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-a2a-blank-step-id',
      payload: {
        goal: {
          title: 'Workflow Run A2A Blank Step Id',
          description: 'Blank A2A step ids should fall back to the current workflow step instead of breaking report ingestion.',
          acceptance_criteria: ['A2A blank step ids fall back to the current step'],
        },
        environment: {
          project_id: 'runner-a2a-blank-step-id-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['A2A_BLANK_STEP.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-a2a-blank-step-id-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-a2a-blank-step-id',
            required: true,
            inline_data: '{"stage":"a2a-blank-step-id"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];

    await writeFile(join(tempDir, 'A2A_BLANK_STEP.md'), '# Session Runner A2A Blank Step Id\n', 'utf-8');
    await run('git', ['add', 'A2A_BLANK_STEP.md'], tempDir);
    await run('git', ['commit', '-m', 'runner a2a blank step id update'], tempDir);
    const commitSha = (await run('git', ['rev-parse', 'HEAD'], tempDir)).stdout.trim();
    const workflowRun = await ring.read('workflow-run', runId);
    const a2aReady = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          accepted_protocols: [
            ...new Set([...(workflowRun.data.callback.accepted_protocols ?? []), 'a2a.task-status.v1']),
          ],
          allowed_worker_ids: [
            ...new Set([...(workflowRun.data.callback.allowed_worker_ids ?? []), 'a2a-worker']),
          ],
        },
      },
    });
    assert.equal(a2aReady.ok, true, JSON.stringify(a2aReady.errors));
    const a2aWorkflowRun = await ring.read('workflow-run', runId);
    const currentStepId = a2aWorkflowRun.data.steps[a2aWorkflowRun.data.current_step_index].step_id;
    const payload = {
      protocol: 'a2a.task-status.v1',
      worker: {
        id: 'a2a-worker',
        display_name: 'A2A Bridge Worker',
      },
      task: {
        id: runId,
        kind: 'workflow-run',
        status: {
          state: 'completed',
          message: 'A2A execution finished.',
        },
        artifacts: [
          {
            kind: 'git_commit',
            uri: `git+commit://${commitSha}`,
          },
        ],
        metadata: {
          step_id: '   ',
          judge_agent_id: 'task-judge',
          outputs: {
            artifact_path: 'A2A_BLANK_STEP.md',
          },
        },
      },
    };

    const reported = await ring.sessionRunner.reportWorkflowRun(
      runId,
      payload,
      signedHeaders(a2aWorkflowRun, payload, {
        workerId: 'a2a-worker',
        includeKeyVersion: true,
      }),
    );

    assert.equal(reported.workflow_run.status, 'completed');
    assert.equal(reported.task.status, 'in_progress');

    const completedRun = await ring.read('workflow-run', runId);
    assert.equal(completedRun.data.reports.at(-1)?.actor, 'A2A Bridge Worker');
    assert.equal(completedRun.data.reports.at(-1)?.worker_id, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.protocol, 'a2a.task-status.v1');
    assert.equal(completedRun.data.reports.at(-1)?.step_id, currentStepId);

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'Blank A2A step ids now fall back to the current workflow step.',
    });
    assert.equal(judgedTask.status, 'completed');
  });

  it('rejects callbacks from workers that are not registered', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-worker-registry',
      payload: {
        goal: {
          title: 'Workflow Run Worker Registry',
          description: 'Only registered workers should be allowed to report workflow status.',
          acceptance_criteria: ['Unknown worker is rejected'],
        },
        environment: {
          project_id: 'runner-worker-registry',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-worker-registry-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-worker-registry',
            required: true,
            inline_data: '{"stage":"registry"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const runId = session.data.workflow_run_ids[0];
    const workflowRun = await ring.read('workflow-run', runId);
    const payload = {
      status: 'progress',
      actor: 'ghost-worker',
      note: 'This should not be accepted.',
    };

    await assert.rejects(
      () =>
        ring.sessionRunner.reportWorkflowRun(
          runId,
          payload,
          signedHeaders(workflowRun, payload, {
            workerId: 'ghost-worker',
            includeKeyVersion: true,
          }),
        ),
      (error) => {
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  it('rejects unsigned callbacks and auto-fails timed out workflow-runs into replanning', async () => {
    await ring.orchestrator.updateConfig({
      session_runner: {
        report_timeout_ms: 10,
        max_report_retries: 1,
        retry_backoff_ms: 10,
        signature_ttl_ms: 300_000,
      },
    });

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-timeout',
      payload: {
        goal: {
          title: 'Workflow Run Timeout',
          description: 'Timed out workflow runs should be retried and then routed into replanning.',
          acceptance_criteria: ['Timeout becomes task failure'],
        },
        environment: {
          project_id: 'runner-timeout-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {
            must_build: false,
            must_cleanup: false,
            merge_policy: 'judge_then_merge',
          },
        },
        materials: [
          {
            material_id: 'runner-timeout-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/runner-timeout',
            required: true,
            inline_data: '{"stage":"timeout"}',
          },
        ],
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];
    const originalRun = await ring.read('workflow-run', runId);

    await assert.rejects(
      () =>
        ring.sessionRunner.reportWorkflowRun(runId, {
          status: 'progress',
          actor: 'unsigned-worker',
          note: 'This should be rejected.',
        }),
      (error) => {
        assert.equal(error.statusCode, 401);
        return true;
      },
    );

    let workflowRun = await ring.read('workflow-run', runId);
    const firstTimeout = {
      ...workflowRun.data.callback,
      timeout_at: new Date(Date.now() - 1_000).toISOString(),
    };
    const firstTimeoutUpdate = await ring.update('workflow-run', runId, {
      data: {
        callback: firstTimeout,
      },
    });
    assert.equal(firstTimeoutUpdate.ok, true);

    await ring.sessionRunner.tick();
    workflowRun = await ring.read('workflow-run', runId);
    assert.equal(workflowRun.status, 'running');
    assert.equal(workflowRun.data.callback.retry_count, 1);
    assert.equal(workflowRun.data.callback.status, 'retry_scheduled');
    assert.equal(workflowRun.data.callback.key_version, originalRun.data.callback.key_version + 1);
    assert.notEqual(workflowRun.data.callback.token, originalRun.data.callback.token);
    assert.notEqual(workflowRun.data.callback.signing_secret, originalRun.data.callback.signing_secret);
    assert.ok(workflowRun.data.callback.last_rotated_at);

    const rotatedPacket = JSON.parse(
      await readFile(join(tempDir, workflowRun.data.callback.packet_path), 'utf-8'),
    );
    assert.equal(
      rotatedPacket.callbacks.workflow_run_report.signing.key_version,
      workflowRun.data.callback.key_version,
    );

    const stalePayload = {
      status: 'progress',
      actor: 'worker-agent',
      note: 'Old credentials should no longer work.',
    };
    await assert.rejects(
      () =>
        ring.sessionRunner.reportWorkflowRun(
          runId,
          stalePayload,
          signedHeaders(originalRun, stalePayload, {
            workerId: 'worker-agent',
            includeKeyVersion: true,
          }),
        ),
      (error) => {
        assert.equal(error.statusCode, 401);
        return true;
      },
    );

    const exhaustedTimeoutUpdate = await ring.update('workflow-run', runId, {
      data: {
        callback: {
          ...workflowRun.data.callback,
          timeout_at: new Date(Date.now() - 1_000).toISOString(),
        },
      },
    });
    assert.equal(exhaustedTimeoutUpdate.ok, true);

    await ring.sessionRunner.tick();

    const failedRun = await ring.read('workflow-run', runId);
    const failedTask = await ring.read('task', taskId);
    const failedSession = await ring.read('session', sessionId);
    assert.equal(failedRun.status, 'failed');
    assert.equal(failedRun.data.callback.status, 'timed_out');
    assert.equal(failedTask.status, 'failed');
    assert.equal(failedTask.data.execution.review_status, 'workflow_timeout');
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');
    assert.ok(failedTask.data.execution.failure_distillation_id);
    assert.ok(failedTask.data.execution.failure_feedback_id);
    assert.equal(failedSession.status, 'failed');
  });
});
