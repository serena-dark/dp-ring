import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

describe('task execution', async () => {
  let tempDir;
  let ring;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-task-execution-'));
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
    await run('git', ['config', 'user.email', 'task@test.local'], tempDir);
    await run('git', ['config', 'user.name', 'Task Test'], tempDir);
    await writeFile(join(tempDir, 'README.md'), '# Temp repo\n', 'utf-8');
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

  async function createExecutionFixture(name, taskPatch = {}) {
    const requirementResult = await ring.create('requirement', {
      id: await ring.newId('requirement', { name }),
      status: 'ready',
      created_by: 'test',
      data: {
        name,
        description: `${name} requirement`,
        acceptance_criteria: [{ id: 'ac1', description: 'Works', satisfied: false }],
        milestone_ids: [],
        priority: 'high',
      },
    });
    assert.equal(requirementResult.ok, true);

    const milestoneId = await ring.newId('milestone', {
      name: `${name} milestone`,
      parentId: requirementResult.artifact.id,
    });
    const milestoneResult = await ring.create('milestone', {
      id: milestoneId,
      status: 'active',
      created_by: 'test',
      data: {
        name: `${name} milestone`,
        requirement_id: requirementResult.artifact.id,
        description: `${name} milestone`,
        prerequisites: [],
      },
    });
    assert.equal(milestoneResult.ok, true);

    const workflowResult = await ring.create('workflow', {
      id: `wf-${name.toLowerCase().replace(/\s+/g, '-')}`,
      status: 'active',
      created_by: 'test',
      data: {
        name: `${name} workflow`,
        description: `${name} workflow`,
        applicable_to: ['feature-implementation'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect scope.' },
          { id: 's2', name: 'execute', description: 'Execute task.' },
        ],
      },
    });
    assert.equal(workflowResult.ok, true);

    const sessionId = await ring.newId('session', { name: `${name} session` });
    const sessionResult = await ring.create('session', {
      id: sessionId,
      status: 'executing',
      created_by: 'test',
      session_id: sessionId,
      data: {
        requirement_id: requirementResult.artifact.id,
        milestone_id: milestoneId,
        task_ids: [],
        workflow_run_ids: [],
        evaluation_id: null,
        distillation_id: null,
        execution_log: [],
      },
    });
    assert.equal(sessionResult.ok, true);

    const taskId = await ring.newId('task', { name });
    const taskResult = await ring.create('task', {
      id: taskId,
      status: 'in_progress',
      created_by: 'test',
      session_id: sessionId,
      data: {
        name,
        description: `${name} task`,
        task_type: 'feature-implementation',
        requirement_id: requirementResult.artifact.id,
        milestone_id: milestoneId,
        workflow_template_id: workflowResult.artifact.id,
        workflow_run_id: null,
        execution_mode: 'serial',
        scope: {
          target_type: 'file',
          target_path: 'src/feature.txt',
          repo_root: '.',
          file_paths: ['src/feature.txt'],
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
    assert.equal(taskResult.ok, true);

    return {
      requirement: requirementResult.artifact,
      milestone: milestoneResult.artifact,
      workflow: workflowResult.artifact,
      session: sessionResult.artifact,
      task: taskResult.artifact,
    };
  }

  it('fails a task when the git commit changes files outside the declared scope', async () => {
    const fixture = await createExecutionFixture('Scope mismatch');

    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'unexpected.txt'), 'oops\n', 'utf-8');
    await run('git', ['add', 'src/unexpected.txt'], tempDir);
    await run('git', ['commit', '-m', 'unexpected change'], tempDir);
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], tempDir);

    const failedTask = await ring.taskExecution.finalize(fixture.task.id, {
      commit_sha: stdout.trim(),
      note: 'Check changed files exactly.',
    });

    assert.equal(failedTask.status, 'failed');
    assert.equal(failedTask.data.execution.review_status, 'scope_failed');
    assert.equal(failedTask.data.execution.scope_match, false);
    assert.ok(failedTask.data.execution.failure_feedback_id);
    assert.ok(failedTask.data.execution.failure_distillation_id);
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');
    assert.equal(failedTask.data.replanning.source_failure, 'scope_mismatch');
    assert.equal(failedTask.data.replanning.replanner_agent_id, 'task-replanner');
    assert.ok(failedTask.data.replanning.packet);

    const feedback = await ring.read('feedback', failedTask.data.execution.failure_feedback_id);
    assert.match(feedback.data.description, /changed files outside/i);
  });

  it('redispatches a failed task into a successor task when the replanner approves retry', async () => {
    const fixture = await createExecutionFixture('Redispatch after failure');

    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'unexpected.txt'), 'retry me\n', 'utf-8');
    await run('git', ['add', 'src/unexpected.txt'], tempDir);
    await run('git', ['commit', '-m', 'redispatch source'], tempDir);
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], tempDir);

    const failedTask = await ring.taskExecution.finalize(fixture.task.id, {
      commit_sha: stdout.trim(),
      note: 'Initial scope was wrong.',
    });
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');

    const replannedTask = await ring.taskExecution.replan(fixture.task.id, {
      verdict: 'redispatch',
      replanner_agent_id: 'task-replanner',
      note: 'Narrow the retry to the actual changed file.',
      task: {
        name: 'Redispatch after failure retry',
        target_type: 'file',
        target_path: 'src/unexpected.txt',
        repo_root: '.',
        file_paths: ['src/unexpected.txt'],
        workflow_template_id: fixture.workflow.id,
        execution_mode: 'serial',
        acceptance_criteria: [{ description: 'Only update the redispatched file.' }],
      },
    });

    assert.equal(replannedTask.status, 'failed');
    assert.equal(replannedTask.data.replanning.status, 'redispatched');
    assert.ok(replannedTask.data.replanning.successor_task_id);

    const successorTask = await ring.read('task', replannedTask.data.replanning.successor_task_id);
    assert.equal(successorTask.status, 'ready');
    assert.equal(successorTask.data.replanning.parent_task_id, fixture.task.id);
    assert.deepEqual(successorTask.data.scope.file_paths, ['src/unexpected.txt']);
    assert.equal(successorTask.data.execution.review_status, 'pending');

    const successorDoc = join(tempDir, 'docs', 'tasks', successorTask.id, `${successorTask.id}.md`);
    await access(successorDoc);
  });

  it('verifies a scoped commit, writes a summary, and lets the judge approve completion', async () => {
    const fixture = await createExecutionFixture('Successful completion', {
      scope: {
        target_type: 'file',
        target_path: 'src/feature.txt',
        repo_root: '.',
        file_paths: ['src/feature.txt'],
      },
      execution: {
        judge_agent_id: null,
        review_status: 'pending',
        completion_commit_sha: null,
        changed_files: [],
        scope_match: null,
        build_required: true,
        build_command: 'test -f src/feature.txt',
        build_status: 'pending',
        cleanup_paths: ['tmp/task-success'],
        cleanup_status: 'pending',
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
    });

    await mkdir(join(tempDir, 'src'), { recursive: true });
    await mkdir(join(tempDir, 'tmp', 'task-success'), { recursive: true });
    await writeFile(join(tempDir, 'tmp', 'task-success', 'scratch.txt'), 'temp\n', 'utf-8');
    await writeFile(join(tempDir, 'src', 'feature.txt'), 'done\n', 'utf-8');
    await run('git', ['add', 'src/feature.txt'], tempDir);
    await run('git', ['commit', '-m', 'scoped change'], tempDir);
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], tempDir);

    const awaitingJudgement = await ring.taskExecution.finalize(fixture.task.id, {
      commit_sha: stdout.trim(),
      judge_agent_id: 'quality-judge',
      note: 'Scope/build/cleanup all passed.',
    });

    assert.equal(awaitingJudgement.status, 'in_progress');
    assert.equal(awaitingJudgement.data.execution.review_status, 'awaiting_judgement');
    assert.equal(awaitingJudgement.data.execution.scope_match, true);
    assert.equal(awaitingJudgement.data.execution.build_status, 'passed');
    assert.equal(awaitingJudgement.data.execution.cleanup_status, 'completed');
    assert.equal(awaitingJudgement.data.execution.review_packet.agent_id, 'quality-judge');
    assert.ok(awaitingJudgement.data.execution.summary_path);

    const approvedTask = await ring.taskExecution.judge(fixture.task.id, {
      verdict: 'approved',
      judge_agent_id: 'quality-judge',
      note: 'Ready to merge.',
    });

    assert.equal(approvedTask.status, 'completed');
    assert.equal(approvedTask.data.execution.review_status, 'approved');
    assert.equal(approvedTask.data.execution.merge_status, 'ready');
    assert.ok(approvedTask.data.execution.completion_distillation_id);
    assert.ok(approvedTask.data.acceptance_criteria.every((item) => item.satisfied));
  });

  it('marks a failed task as terminal when the replanner refuses redispatch', async () => {
    const fixture = await createExecutionFixture('Terminal after build fail', {
      execution: {
        judge_agent_id: null,
        review_status: 'pending',
        completion_commit_sha: null,
        changed_files: [],
        scope_match: null,
        build_required: true,
        build_command: 'exit 1',
        build_status: 'pending',
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
    });

    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'feature.txt'), 'still fails build\n', 'utf-8');
    await run('git', ['add', 'src/feature.txt'], tempDir);
    await run('git', ['commit', '-m', 'build fail source'], tempDir);
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], tempDir);

    const failedTask = await ring.taskExecution.finalize(fixture.task.id, {
      commit_sha: stdout.trim(),
      note: 'Scope matches but build should fail.',
    });
    assert.equal(failedTask.data.replanning.status, 'awaiting_replan');

    const terminalTask = await ring.taskExecution.replan(fixture.task.id, {
      verdict: 'terminal',
      replanner_agent_id: 'task-replanner',
      note: 'Needs a broader milestone-level redesign.',
    });

    assert.equal(terminalTask.status, 'failed');
    assert.equal(terminalTask.data.replanning.status, 'terminal');
    assert.equal(terminalTask.data.replanning.successor_task_id, null);
    assert.equal(terminalTask.data.replanning.decision_note, 'Needs a broader milestone-level redesign.');
  });
});
