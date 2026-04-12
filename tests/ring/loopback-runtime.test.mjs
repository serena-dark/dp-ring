import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
});
