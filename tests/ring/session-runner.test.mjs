import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createRing } from '../../ring/index.mjs';

const execFileAsync = promisify(execFile);

async function run(command, args, cwd) {
  return execFileAsync(command, args, {
    cwd,
    encoding: 'utf-8',
  });
}

function signedHeaders(
  workflowRun,
  payload,
  {
    timestamp = new Date().toISOString(),
    workerId = null,
    includeKeyVersion = false,
  } = {},
) {
  const signature = createHmac('sha256', workflowRun.data.callback.signing_secret)
    .update(`${timestamp}.${JSON.stringify(payload)}`)
    .digest('hex');
  return {
    headers: {
      authorization: `Bearer ${workflowRun.data.callback.token}`,
      'x-ring-timestamp': timestamp,
      'x-ring-signature': `sha256=${signature}`,
      ...(workerId ? { 'x-ring-worker-id': workerId } : {}),
      ...(includeKeyVersion
        ? { 'x-ring-key-version': String(workflowRun.data.callback.key_version) }
        : {}),
    },
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
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-test',
      payload: {
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

    const branchEvent = await ring.read('branch-event', workflowRun.data.node_execution.branch_event_ids[0]);
    assert.equal(branchEvent.data.event_type, 'checkpoint_created');

    const packetPath = join(tempDir, workflowRun.data.steps[0].outputs.execution_packet_path);
    const packet = JSON.parse(await readFile(packetPath, 'utf-8'));
    assert.equal(packet.session_id, session.id);
    assert.equal(packet.workflow_run_id, workflowRun.id);
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

  it('accepts workflow-run completion reports, finalizes tasks, and closes the session after judgement', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-report',
      payload: {
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

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'session-runner-lineage-timeout',
      payload: {
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
      },
    });

    await ring.orchestrator.tick();
    const launched = await ring.orchestrator.readDispatchBundle(bundle.id);
    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', runId);
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
    assert.ok(progressedRun.data.node_execution.checkpoint_ids.length >= 2);
    assert.equal(progressedRun.data.callback.retry_count, 0);

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
    const currentStepId = workflowRun.data.steps[workflowRun.data.current_step_index].step_id;
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
      signedHeaders(workflowRun, payload, {
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
    assert.equal(completedRun.data.reports.at(-1)?.worker_id, 'a2a-worker');
    assert.equal(completedRun.data.reports.at(-1)?.protocol, 'a2a.task-status.v1');

    const judgedTask = await ring.taskExecution.judge(taskId, {
      verdict: 'approved',
      judge_agent_id: 'task-judge',
      note: 'A2A report normalized correctly.',
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
