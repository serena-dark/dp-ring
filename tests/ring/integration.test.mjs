import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRing } from '../../ring/index.mjs';

describe('Ring integration', async () => {
  let tempDir;
  let ring;

  before(async () => {
    // Set up an isolated .ring/ for testing
    tempDir = await mkdtemp(join(tmpdir(), 'ring-integration-'));
    const ringDir = join(tempDir, '.ring');

    // Copy schemas and config
    await cp(resolve(import.meta.dirname, '../../.ring/schemas'), join(ringDir, 'schemas'), { recursive: true });
    await cp(resolve(import.meta.dirname, '../../.ring/config.json'), join(ringDir, 'config.json'));

    // Create directories and initial leaderboard
    const dirs = ['sessions', 'requirements', 'milestones', 'tasks', 'workflows',
      'workflow-runs', 'evaluations', 'feedback', 'distillations', 'registry'];
    for (const d of dirs) await mkdir(join(ringDir, d), { recursive: true });
    await writeFile(join(ringDir, 'registry', 'leaderboard.json'),
      JSON.stringify({ updated_at: '2026-04-08T00:00:00Z', rankings: {} }));

    ring = await createRing(tempDir);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('full lifecycle: create requirement → milestone → task → workflow → session → evaluate → distill → registry', async () => {
    // 1. Create requirement
    const req = await ring.create('requirement', {
      id: 'r1-integration-test',
      status: 'draft',
      created_by: 'test',
      data: {
        name: 'Integration Test',
        description: 'End-to-end lifecycle test.',
        acceptance_criteria: [
          { id: 'ac1', description: 'All steps complete', satisfied: false },
        ],
        priority: 'high',
      },
    });
    assert.equal(req.ok, true);

    // 2. Create milestone
    const ms = await ring.create('milestone', {
      id: 'r1m1-integration-ms',
      status: 'draft',
      created_by: 'test',
      data: {
        name: 'Integration Milestone',
        requirement_id: 'r1-integration-test',
        description: 'First milestone.',
        prerequisites: [
          {
            id: 'pre-1', description: 'Human sign-off',
            check_type: 'human',
            check: { requires: 'human_approval', approver_role: 'lead' },
            status: 'satisfied',
            last_checked: '2026-04-08T00:00:00Z',
          },
        ],
      },
    });
    assert.equal(ms.ok, true);

    // 3. Activate milestone
    const msUpdate = await ring.update('milestone', 'r1m1-integration-ms', { status: 'active' });
    assert.equal(msUpdate.ok, true);

    // 4. Create workflow template
    const wf = await ring.create('workflow', {
      id: 'wf-integration-test',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Integration Test Workflow',
        description: 'For testing.',
        applicable_to: ['testing'],
        steps: [
          { id: 's1', name: 'setup', description: 'Set up test environment.' },
          { id: 's2', name: 'execute', description: 'Run the tests.' },
          { id: 's3', name: 'verify', description: 'Check results.' },
        ],
      },
    });
    assert.equal(wf.ok, true);

    // 5. Create task
    const task = await ring.create('task', {
      id: 't1-integration-task',
      status: 'pending',
      created_by: 'test',
      data: {
        name: 'Integration Task',
        description: 'Test the full lifecycle.',
        task_type: 'testing',
        requirement_id: 'r1-integration-test',
        milestone_id: 'r1m1-integration-ms',
        workflow_template_id: 'wf-integration-test',
        acceptance_criteria: [
          { id: 'ac1', description: 'Lifecycle completes', satisfied: false },
        ],
      },
    });
    assert.equal(task.ok, true);

    // 6. Create session
    const session = await ring.create('session', {
      id: 's1-integration-session',
      status: 'gate_pending',
      created_by: 'test',
      session_id: 's1-integration-session',
      data: {
        requirement_id: 'r1-integration-test',
        milestone_id: 'r1m1-integration-ms',
        task_ids: ['t1-integration-task'],
        workflow_run_ids: [],
        evaluation_id: null,
        distillation_id: null,
        execution_log: [],
      },
    });
    assert.equal(session.ok, true);

    // 7. Progress session through lifecycle
    let update;
    update = await ring.update('session', 's1-integration-session', { status: 'preparing' });
    assert.equal(update.ok, true);
    update = await ring.update('session', 's1-integration-session', { status: 'executing' });
    assert.equal(update.ok, true);
    update = await ring.update('session', 's1-integration-session', { status: 'reviewing' });
    assert.equal(update.ok, true);
    update = await ring.update('session', 's1-integration-session', { status: 'closing' });
    assert.equal(update.ok, true);
    update = await ring.update('session', 's1-integration-session', { status: 'closed' });
    assert.equal(update.ok, true);

    // 8. Create evaluation
    const evaluation = ring.evaluate.buildEvaluation({
      id: 'eval-integration',
      sessionId: 's1-integration-session',
      outcome: 'success',
      scores: { correctness: 0.95, completeness: 0.90, efficiency: 0.70, adherence: 1.0, reusability: 0.60 },
      scoreWeights: ring.config.score_weights,
      evidence: { tests_passed: 5, tests_failed: 0, build_status: 'success' },
      evaluator: 'automated',
      createdBy: 'test',
    });
    const evalResult = await ring.store.write('evaluation', evaluation);
    assert.equal(evalResult.ok, true);
    assert.ok(evaluation.data.composite_score > 0);

    // 9. Record score in registry
    await ring.registry.recordScore('testing', 'wf-integration-test', evaluation.data.composite_score);
    const ranked = await ring.registry.rank('testing');
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].workflow_id, 'wf-integration-test');

    // 10. Create distillation
    const dist = await ring.create('distillation', {
      id: 'dist-integration',
      status: 'draft',
      created_by: 'test',
      session_id: 's1-integration-session',
      data: {
        source_session_id: 's1-integration-session',
        artifacts: [
          {
            kind: 'lesson',
            summary: 'Integration lifecycle works end-to-end.',
            context: 'testing',
            applicable_when: 'Always verify full lifecycle in integration tests.',
            confidence: 0.9,
            source_sessions: ['s1-integration-session'],
          },
        ],
      },
    });
    assert.equal(dist.ok, true);

    // Publish distillation
    const distPub = await ring.update('distillation', 'dist-integration', { status: 'published' });
    assert.equal(distPub.ok, true);

    // 11. Query knowledge for future sessions
    const knowledge = await ring.knowledge('testing');
    assert.ok(knowledge.length >= 1);
    assert.equal(knowledge[0].summary, 'Integration lifecycle works end-to-end.');

    // 12. Mark task and requirement as completed
    const taskReady = await ring.update('task', 't1-integration-task', { status: 'ready' });
    assert.equal(taskReady.ok, true);
    const taskInProgress = await ring.update('task', 't1-integration-task', { status: 'in_progress' });
    assert.equal(taskInProgress.ok, true);
    const taskDone = await ring.update('task', 't1-integration-task', { status: 'completed' });
    assert.equal(taskDone.ok, true);
  });

  it('rejects an invalid session state transition', async () => {
    await ring.create('session', {
      id: 's2-bad-transition',
      status: 'gate_pending',
      created_by: 'test',
      session_id: 's2-bad-transition',
      data: {
        requirement_id: 'r1', milestone_id: 'm1',
        task_ids: [], workflow_run_ids: [],
        execution_log: [],
      },
    });

    // Try to jump from gate_pending to closed
    const result = await ring.update('session', 's2-bad-transition', { status: 'closed' });
    assert.equal(result.ok, false);
  });
});
