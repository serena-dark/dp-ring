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

describe('loopback runtime', async () => {
  let tempDir;
  let ring;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-loopback-'));
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
    await run('git', ['config', 'user.email', 'loopback@test.local'], tempDir);
    await run('git', ['config', 'user.name', 'Loopback Test'], tempDir);
    await writeFile(join(tempDir, 'README.md'), '# Loopback Runtime Fixture\n', 'utf-8');
    await run('git', ['add', '.'], tempDir);
    await run('git', ['commit', '-m', 'initial'], tempDir);

    ring = await createRing(tempDir);
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: true,
        max_replan_depth: 1,
      },
    });
  });

  after(async () => {
    ring.orchestrator.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('automatically closes the loop from requirement dispatch to a closed session', async () => {
    const created = await ring.orchestrator.createRequirementDispatch({
      name: 'Autonomous Closed Loop',
      description:
        'The loopback runtime should draft the documents, build milestones, route readiness, launch a session, commit scoped files, judge the task, and close the session without manual agent input.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Requirement document is written', satisfied: false },
        { id: 'ac2', description: 'Milestones are materialized', satisfied: false },
        { id: 'ac3', description: 'A session closes automatically', satisfied: false },
      ],
      created_by: 'loopback-test',
    });

    let finalSession = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await ring.orchestrator.tick();
      const sessions = await ring.list('session');
      finalSession = sessions.find((session) => session.status === 'closed') ?? sessions.at(-1) ?? null;
      if (finalSession?.status === 'closed') {
        break;
      }
    }

    assert.ok(finalSession, 'expected the loopback runtime to launch at least one session');
    assert.equal(finalSession.status, 'closed');

    const refreshedJob = await ring.orchestrator.readJob(created.job.id);
    assert.equal(refreshedJob.status, 'session_dispatched');
    assert.ok(refreshedJob.session_dispatch.session_id);

    const tasks = await ring.list('task');
    assert.ok(tasks.length >= 1);
    assert.ok(tasks.every((task) => task.status === 'completed'));
    assert.ok(tasks.every((task) => task.data.execution?.review_status === 'approved'));
    assert.ok(tasks.every((task) => task.data.execution?.completion_commit_sha));

    const workflowRuns = await ring.list('workflow-run');
    assert.ok(workflowRuns.length >= 1);
    assert.ok(workflowRuns.every((run) => run.status === 'completed'));
    assert.ok(workflowRuns.every((run) => run.data.callback?.last_worker_id === 'worker-agent'));

    const requirementDoc = await readFile(
      join(tempDir, refreshedJob.requirement_document.document.path),
      'utf-8',
    );
    const milestoneDoc = await readFile(
      join(tempDir, refreshedJob.milestone_plan.document.path),
      'utf-8',
    );
    const prerequisiteDoc = await readFile(
      join(tempDir, refreshedJob.post_milestone.prerequisite_analysis.document.path),
      'utf-8',
    );

    assert.match(requirementDoc, /^# Autonomous Closed Loop/m);
    assert.match(milestoneDoc, /^## Milestone 1:/m);
    assert.match(prerequisiteDoc, /^## Milestone /m);

    const lastCommit = (await run('git', ['log', '-1', '--pretty=%s'], tempDir)).stdout.trim();
    assert.match(lastCommit, /^ring auto:/);
  });

  it('marks warm semantic-recovery failures terminal instead of auto-redispatching them', async () => {
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: true,
        loopback_agents: true,
        loopback_worker: false,
        auto_judge: true,
        auto_replan: true,
        max_replan_depth: 1,
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
      submitted_by: 'loopback-warm-lineage-timeout',
      payload: {
        goal: {
          title: 'Loopback Warm Timeout Governance',
          description: 'Warm checkpoint lineage should suppress blind auto-redispatch after timeout recovery is already in play.',
          acceptance_criteria: ['Warm timeout becomes terminal until an explicit governance decision is made'],
        },
        environment: {
          project_id: 'loopback-warm-lineage-project',
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
            material_id: 'loopback-warm-lineage-material',
            kind: 'brief',
            format: 'json',
            mount_to: 'workspace/loopback-warm-lineage',
            required: true,
            inline_data: '{"stage":"loopback-warm-lineage"}',
          },
        ],
      },
    });

    let launched = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await ring.orchestrator.tick();
      launched = await ring.orchestrator.readDispatchBundle(bundle.id);
      if (launched.status === 'session_launched') {
        break;
      }
    }

    assert.ok(launched, 'expected dispatch bundle to be readable');
    assert.equal(launched.status, 'session_launched');

    const sessionId = launched.batching.session_id;
    const session = await ring.read('session', sessionId);
    const taskId = session.data.task_ids[0];
    const runId = session.data.workflow_run_ids[0];
    const preparedRun = await ring.read('workflow-run', runId);
    const progressPayload = {
      status: 'progress',
      actor: 'worker-agent',
      note: 'Warm lineage established before callback timeout.',
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
    assert.equal(failedRun.status, 'failed');
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');
    assert.match(failedRun.data.callback.last_error, /skipping blind callback retry/);

    await ring.loopbackRuntime.tick();

    const reviewedTask = await ring.read('task', taskId);
    const successorTasks = (await ring.list('task')).filter(
      (task) => task.data.replanning?.parent_task_id === taskId,
    );

    assert.equal(reviewedTask.data.replanning.status, 'terminal');
    assert.equal(reviewedTask.data.replanning.successor_task_id, null);
    assert.match(reviewedTask.data.replanning.decision_note, /semantic checkpoint lineage/i);
    assert.equal(successorTasks.length, 0);
  });
});
