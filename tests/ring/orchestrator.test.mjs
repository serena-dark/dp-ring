import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { createRing } from '../../ring/index.mjs';
import {
  createCheckpoint,
  forkCheckpoint,
  synthesizeCheckpoint,
} from '../../ring/lib/checkpoint-tree.mjs';
import { createEmptyCapsuleState } from '../../ring/lib/node-capsule.mjs';

const execFileAsync = promisify(execFile);

function sha256Checksum(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

async function createZipFixture(rootDir, name, files) {
  const sourceDir = await mkdtemp(join(rootDir, `${name}-src-`));
  const outputDir = await mkdtemp(join(rootDir, `${name}-zip-`));
  const zipPath = join(outputDir, `${name}.zip`);

  for (const [relativePath, contents] of Object.entries(files)) {
    await mkdir(join(sourceDir, dirname(relativePath)), { recursive: true });
    await writeFile(join(sourceDir, relativePath), contents, 'utf-8');
  }

  try {
    await execFileAsync('zip', ['-rq', zipPath, '.'], {
      cwd: sourceDir,
      encoding: 'utf-8',
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    await execFileAsync(
      'python3',
      [
        '-c',
        [
          'import os, sys, zipfile',
          'source_dir, zip_path = sys.argv[1:3]',
          'with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:',
          '    for root, _, files in os.walk(source_dir):',
          '        for name in files:',
          '            path = os.path.join(root, name)',
          '            zf.write(path, os.path.relpath(path, source_dir))',
        ].join('\n'),
        sourceDir,
        zipPath,
      ],
      {
        encoding: 'utf-8',
      },
    );
  }
  const buffer = await readFile(zipPath);
  await rm(sourceDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  return buffer;
}

function createWorkflowRunCheckpoint(overrides = {}) {
  return createCheckpoint({
    id: 'cp-workflow-root',
    created_by: 'test-agent',
    branch_id: 'main',
    node_id: 'n-workflow-checkpoint',
    scope_ref: { kind: 'workflow-run', id: 'run-workflow', path: null },
    execution_cursor: { phase: 'prepared', step_id: 'inspect', ordinal: 0 },
    evidence_refs: [],
    ...overrides,
  });
}

async function createIsolatedOrchestratorRing() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'ring-orchestrator-isolated-'));
  const ringDir = join(repoRoot, '.ring');

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

  const ring = await createRing(repoRoot);
  await ring.orchestrator.updateConfig({
    automation: {
      enabled: false,
    },
  });

  return {
    repoRoot,
    ring,
    async cleanup() {
      ring.orchestrator.stop();
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
}

describe('orchestrator', { concurrency: 1 }, async () => {
  let tempDir;
  let ring;
  let assetServer;
  let assetOrigin;
  let assetRoutes;

  function registerAsset(pathname, {
    status = 200,
    headers = {},
    body,
  }) {
    assetRoutes.set(pathname, { status, headers, body });
    return `${assetOrigin}${pathname}`;
  }

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-orchestrator-'));
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

    ring = await createRing(tempDir);
    await ring.orchestrator.updateConfig({
      automation: {
        enabled: false,
      },
    });

    assetRoutes = new Map();
    assetServer = createServer((req, res) => {
      const route = assetRoutes.get(req.url ?? '');
      if (!route) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }

      res.statusCode = route.status;
      for (const [key, value] of Object.entries(route.headers)) {
        res.setHeader(key, value);
      }
      res.end(route.body);
    });
    assetServer.listen(0, '127.0.0.1');
    await once(assetServer, 'listening');
    const address = assetServer.address();
    assetOrigin = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    ring.orchestrator.stop();
    if (assetServer) {
      await new Promise((resolveClose) => assetServer.close(resolveClose));
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates a requirement dispatch job, scaffold, and packet', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Document Dispatch',
      description: 'Turn this requirement into an auditable document.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Document exists', satisfied: false },
      ],
      created_by: 'test',
    });

    assert.equal(result.requirement.status, 'analyzing');
    assert.equal(result.job.status, 'requirement_dispatched');
    assert.equal(
      result.job.requirement_document.dispatch.packet.recipient,
      'writer-agent',
    );
    assert.equal(
      result.job.requirement_document.dispatch.packet.protocol_version,
      'ring.orchestrator.v1',
    );
    assert.equal(
      result.job.requirement_document.dispatch.packet.trace_id,
      result.job.trace.trace_id,
    );
    assert.equal(result.job.requirement_document.dispatch.packet.sender.id, 'dispatch-center');
    assert.equal(
      result.job.requirement_document.dispatch.packet.recipient_card?.id,
      'writer-agent',
    );
    assert.ok(result.job.routing.mode);
    assert.ok(result.job.trace.spans.length >= 2);

    const requirement = await ring.read('requirement', result.requirement.id);
    assert.equal(requirement.status, 'analyzing');

    const scaffold = await readFile(
      join(tempDir, result.job.requirement_document.document.path),
      'utf-8',
    );
    assert.match(scaffold, /^# Document Dispatch/m);

    const agents = await ring.orchestrator.getAgents();
    assert.ok(agents.length >= 5);
  });

  it('dispatches milestone planning after the requirement document is approved', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Agent Report Approval',
      description: 'A complete document should be approved by the Auditor.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Document has quality sections', satisfied: false },
      ],
      created_by: 'test',
    });

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Agent Report Approval

## Goal

This document is complete enough for the next implementation step. It contains
clear scope, decision context, expected outputs, and constraints so the
Auditor can confirm that the team can continue.

## Acceptance Criteria

- Clear goal statement
- Constraints and expected output are listed
- Next step can proceed with low ambiguity
`,
      'utf-8',
    );

    const reviewed = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'writer-agent',
      status: 'completed',
      note: 'Draft complete.',
    });

    assert.equal(reviewed.status, 'milestone_dispatched');
    assert.equal(reviewed.requirement_document.audit.verdict, 'approved');
    assert.equal(
      reviewed.milestone_plan.dispatch.packet.recipient,
      'milestone-planner',
    );

    const requirement = await ring.read('requirement', result.requirement.id);
    assert.equal(requirement.status, 'ready');

    const milestoneScaffold = await readFile(
      join(tempDir, reviewed.milestone_plan.document.path),
      'utf-8',
    );
    assert.match(milestoneScaffold, /^# Agent Report Approval Milestone Plan/m);
  });

  it('uses idle timeout polling to detect completion before milestone planning', async () => {
    await ring.orchestrator.updateConfig({ document_idle_threshold_ms: 1_000 });

    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Idle Timeout Approval',
      description: 'Polling should detect that the writer stopped editing.',
      priority: 'medium',
      acceptance_criteria: [
        { id: 'ac1', description: 'Polling can complete the document', satisfied: false },
      ],
      created_by: 'test',
    });

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Idle Timeout Approval

## Goal

Polling should watch the document until it stops changing and then route it to
the Auditor. This text is deliberately long enough to satisfy the configured
quality checks and contains the structure the Auditor expects.

## Acceptance Criteria

- The document changes at least once after dispatch
- The document later becomes idle
- The Auditor approves the document
`,
      'utf-8',
    );

    const firstTick = await ring.orchestrator.tick();
    const inProgress = firstTick.processed.find((job) => job.id === result.job.id);
    assert.equal(inProgress.status, 'requirement_document_in_progress');

    await ring.orchestrator.updateConfig({ document_idle_threshold_ms: 10 });
    await new Promise((resolveTick) => setTimeout(resolveTick, 25));

    const secondTick = await ring.orchestrator.tick();
    const milestoneDispatch = secondTick.processed.find(
      (job) => job.id === result.job.id,
    );
    assert.equal(milestoneDispatch.status, 'milestone_dispatched');
    assert.equal(
      milestoneDispatch.requirement_document.document.completion_reason,
      'idle_timeout',
    );
  });

  it('dispatches prerequisite analysis and task planning after milestones are materialized', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Milestone Materialization',
      description: 'Approved requirements should become milestone artifacts.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Milestones are generated', satisfied: false },
      ],
      created_by: 'test',
    });

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Milestone Materialization

## Goal

This requirement document is complete and approved. It is clear enough for the
planner to split the work into milestones with meaningful acceptance checks and
prerequisites that future sessions can use.

## Acceptance Criteria

- Requirement is stable
- Delivery can be split into milestones
- Milestones can be created from the planning document
`,
      'utf-8',
    );

    const milestonePlanning = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'writer-agent',
      status: 'completed',
      note: 'Requirement draft complete.',
    });

    assert.equal(milestonePlanning.status, 'milestone_dispatched');

    await writeFile(
      join(tempDir, milestonePlanning.milestone_plan.document.path),
      `# Milestone Materialization Milestone Plan

## Planning Context

Break the work into two clean delivery phases.

## Milestone 1: Foundation

Set up the requirement baseline, shared constraints, and approval flow.

### Acceptance Checks

- Requirement stakeholders agree on scope
- Baseline constraints are documented

### Prerequisites

- [human] Stakeholder review is scheduled

## Milestone 2: Delivery

Implement the main deliverable and prepare the handoff package.

### Acceptance Checks

- The deliverable is ready for execution
- Handoff notes are documented
`,
      'utf-8',
    );

    const finalized = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'milestone-planner',
      status: 'completed',
      note: 'Milestone plan complete.',
    });

    assert.equal(finalized.status, 'post_milestone_dispatched');
    assert.equal(finalized.milestone_plan.generated_milestone_ids.length, 2);
    assert.equal(
      finalized.post_milestone.prerequisite_analysis.dispatch.packet.recipient,
      'prerequisite-preparer',
    );
    assert.equal(finalized.post_milestone.task_dispatch.dispatch.packet, null);

    const requirement = await ring.read('requirement', result.requirement.id);
    assert.deepEqual(
      requirement.data.milestone_ids,
      finalized.milestone_plan.generated_milestone_ids,
    );

    const milestones = await ring.list('milestone');
    const linked = milestones.filter(
      (item) => item.data.requirement_id === result.requirement.id,
    );
    assert.equal(linked.length, 2);
    assert.deepEqual(
      linked.map((item) => item.status),
      ['draft', 'draft'],
    );

    const prerequisiteScaffold = await readFile(
      join(tempDir, finalized.post_milestone.prerequisite_analysis.document.path),
      'utf-8',
    );
    assert.match(prerequisiteScaffold, /^# Milestone Materialization Prerequisite Analysis/m);

    await assert.rejects(
      () => readFile(join(tempDir, finalized.post_milestone.task_dispatch.document.path), 'utf-8'),
    );
  });

  it('uses serial readiness gating for deep requirements before task dispatch starts', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Deep Routing Requirement',
      description: `Build a multi-agent orchestration platform that coordinates milestone planning, session dispatch, workflow assignment, audit loops, and git-scoped execution across multiple modules. The system needs explicit controls for intervention handling, workflow reuse, and staged prerequisite validation before downstream task planning starts.`,
      priority: 'critical',
      acceptance_criteria: [
        { id: 'ac1', description: 'Requirement document is auditable', satisfied: false },
        { id: 'ac2', description: 'Milestones can be materialized', satisfied: false },
        { id: 'ac3', description: 'Prerequisite gating controls task release', satisfied: false },
      ],
      created_by: 'test',
    });

    assert.equal(result.job.routing.mode, 'deep');
    assert.equal(result.job.routing.post_milestone_strategy, 'serial');

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Deep Routing Requirement

## Goal

This requirement is detailed enough for auditing and includes the system
constraints, control points, and deliverables needed to continue into milestone
planning without ambiguity.

## Acceptance Criteria

- Requirement is durable
- Orchestration stages are explicit
- Follow-up planning can proceed safely
`,
      'utf-8',
    );

    const milestonePlanning = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'writer-agent',
      status: 'completed',
      note: 'Requirement document is complete.',
    });

    await writeFile(
      join(tempDir, milestonePlanning.milestone_plan.document.path),
      `# Deep Routing Requirement Milestone Plan

## Planning Context

Break the platform into prerequisite validation and downstream execution.

## Milestone 1: Control Plane

Define orchestration controls, protocols, and observability hooks.

### Acceptance Checks

- Control plane structure is defined

### Prerequisites

- [human] Architecture review is scheduled

## Milestone 2: Execution Plane

Prepare task dispatch and workflow execution.

### Acceptance Checks

- Execution work can be decomposed

### Prerequisites

- [reference] Protocol contract is published
`,
      'utf-8',
    );

    const postMilestone = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'milestone-planner',
      status: 'completed',
      note: 'Milestone plan complete.',
    });

    assert.equal(postMilestone.status, 'post_milestone_dispatched');
    assert.equal(postMilestone.post_milestone.prerequisite_analysis.status, 'preparing');
    assert.equal(postMilestone.post_milestone.task_dispatch.status, 'pending');
    assert.equal(postMilestone.post_milestone.task_dispatch.dispatch.packet, null);

    await writeFile(
      join(tempDir, postMilestone.post_milestone.prerequisite_analysis.document.path),
      `# Deep Routing Requirement Prerequisite Analysis

## Goal

Serial routing should complete this branch before task dispatch starts.

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[0]}: Control Plane

### Ready Now

- [human] Architecture review is scheduled

### Blocked / Missing

- [reference] Protocol contract is published | reason: downstream protocol package is not final

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[1]}: Execution Plane

### Ready Now

- [human] Sandbox policy is understood

### Blocked / Missing

- [human] Deployment checklist is approved | reason: release review is still pending
`,
      'utf-8',
    );

    const afterPrereqs = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'prerequisite-preparer',
      status: 'completed',
      note: 'Prerequisite gating complete.',
    });

    assert.equal(afterPrereqs.status, 'waiting_for_session_dispatch');
    assert.equal(afterPrereqs.post_milestone.prerequisite_analysis.status, 'completed');
    assert.equal(afterPrereqs.post_milestone.task_dispatch.status, 'completed');
    assert.ok(afterPrereqs.adaptive_dispatch.bundle_id);
    assert.equal(afterPrereqs.workflow_preparation.status, 'completed');
    assert.ok(afterPrereqs.session_dispatch.waiting_task_ids.length >= 1);
  });

  it('distills interventions into a follow-up requirement and redispatches a new job', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Intervention Follow-up',
      description: 'A source requirement that will produce a follow-up loop.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Intervention is captured', satisfied: false },
      ],
      created_by: 'test',
    });

    const withIntervention = await ring.orchestrator.updateIntervention(result.job.id, {
      action: 'create',
      stage: 'workflow_preparation',
      severity: 'warning',
      reason: 'Workflow reuse policy was too strict for the available template set.',
      recommendation: 'Create a narrower follow-up requirement for workflow reuse.',
      note: 'Manual escalation from operator.',
      actor: 'operator',
    });

    assert.equal(withIntervention.interventions.length, 1);
    assert.equal(withIntervention.interventions[0].status, 'open');

    const drafted = await ring.orchestrator.dispatchFollowup(result.job.id, {
      note: 'Create a follow-up brief for the intervention.',
    });

    assert.equal(drafted.followup.status, 'drafting');
    assert.equal(drafted.followup.dispatch.packet.recipient, 'distiller');
    assert.equal(drafted.followup.source_intervention_ids.length, 1);

    await writeFile(
      join(tempDir, drafted.followup.document.path),
      `# Follow-up Requirement: Intervention Follow-up Recovery

Priority: high
Created By: distiller
Source Job: ${drafted.id}

## Context

The original job needs a smaller follow-up requirement focused on workflow reuse and safer dispatch.

## Requirement Description

Create a corrected follow-up requirement that narrows the workflow planning scope, keeps the reusable template path explicit, and re-enters the orchestrator as a clean new loop.

## Acceptance Criteria

- Follow-up requirement is specific about workflow reuse
- Routing and intervention history are preserved
`,
      'utf-8',
    );

    const created = await ring.orchestrator.createFollowupRequirement(result.job.id, {
      created_by: 'distiller',
    });

    assert.equal(created.source_job.followup.status, 'completed');
    assert.ok(created.source_job.followup.generated_requirement_id);
    assert.ok(created.source_job.followup.generated_job_id);
    assert.equal(created.followup_requirement.data.name, 'Intervention Follow-up Recovery');
    assert.equal(created.followup_requirement.status, 'analyzing');
    assert.equal(created.followup_job.status, 'requirement_dispatched');
    assert.equal(
      created.source_job.interventions.filter((item) => item.status === 'resolved').length,
      1,
    );
  });

  it('turns blocked prerequisites into feedback, submits an internal adaptive bundle, and launches a batch session', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Readiness Routing',
      description: 'Blocked prerequisites should become feedback while ready work becomes tasks.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Feedback and tasks are emitted', satisfied: false },
      ],
      created_by: 'test',
    });

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Readiness Routing

## Goal

This requirement document is complete and ready for milestone planning. It is
explicit enough that prerequisites and early tasks can be split once the
milestones are generated.

## Acceptance Criteria

- Requirement is stable
- Early tasks can be isolated
- Blockers can be surfaced as feedback
`,
      'utf-8',
    );

    const milestonePlanning = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'writer-agent',
      status: 'completed',
      note: 'Requirement doc complete.',
    });

    await writeFile(
      join(tempDir, milestonePlanning.milestone_plan.document.path),
      `# Readiness Routing Milestone Plan

## Planning Context

Split the work into a foundation phase and an execution phase.

## Milestone 1: Foundation

Set up the project baseline and approvals.

### Acceptance Checks

- Baseline is documented

### Prerequisites

- [human] Stakeholder approval is confirmed
- [reference] API contract is published

## Milestone 2: Execution

Implement the dispatchable work once dependencies are ready.

### Acceptance Checks

- Dispatchable work is identified

### Prerequisites

- [automated] Integration test harness is green
`,
      'utf-8',
    );

    const postMilestone = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'milestone-planner',
      status: 'completed',
      note: 'Milestones complete.',
    });

    await writeFile(
      join(tempDir, postMilestone.post_milestone.prerequisite_analysis.document.path),
      `# Readiness Routing Prerequisite Analysis

## Goal

Split milestone prerequisites into ready and blocked sets.

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[0]}: Foundation

### Ready Now

- [human] Stakeholder approval is confirmed

### Blocked / Missing

- [reference] API contract is published | reason: API review has not finished

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[1]}: Execution

### Ready Now

- [automated] Integration test harness is green

### Blocked / Missing

- [human] Ops rollout window is scheduled | reason: rollout calendar is still pending
`,
      'utf-8',
    );

    const reusableWorkflow = await ring.create('workflow', {
      id: 'wf-ready-docs-template',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Ready Docs Template',
        description: 'Reusable workflow for documentation tasks.',
        applicable_to: ['documentation'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the task document.' },
          { id: 's2', name: 'draft', description: 'Produce the documentation output.' },
          { id: 's3', name: 'verify', description: 'Check acceptance criteria.' },
        ],
      },
    });
    assert.equal(reusableWorkflow.ok, true);
    await ring.registry.recordScore('documentation', 'wf-ready-docs-template', 0.92);

    const prerequisiteCompleted = await ring.orchestrator.reportAgent(
      result.job.id,
      {
        agent_id: 'prerequisite-preparer',
        status: 'completed',
        note: 'Prerequisite split complete.',
      },
    );

    assert.equal(prerequisiteCompleted.post_milestone.prerequisite_analysis.status, 'completed');
    assert.equal(
      prerequisiteCompleted.post_milestone.prerequisite_analysis.distillation.feedback_ids.length,
      2,
    );

    const feedbackItems = await ring.list('feedback');
    const relatedFeedback = feedbackItems.filter((item) =>
      item.data.description.includes(`[requirement:${result.requirement.id}]`),
    );
    assert.equal(relatedFeedback.length, 2);

    const distillations = await ring.list('distillation');
    const relatedDistillations = distillations.filter(
      (item) => item.data.source_session_id === result.job.id,
    );
    assert.equal(relatedDistillations.length, 1);

    const tasks = await ring.list('task');
    const relatedTasks = tasks.filter(
      (item) => item.data.requirement_id === result.requirement.id,
    );
    assert.equal(relatedTasks.length, 2);
    assert.deepEqual(
      relatedTasks.map((item) => item.status),
      ['ready', 'ready'],
    );
    assert.equal(prerequisiteCompleted.status, 'waiting_for_session_dispatch');
    assert.equal(prerequisiteCompleted.workflow_preparation.waiting_tasks.length, 2);
    assert.equal(prerequisiteCompleted.workflow_preparation.reused_workflow_ids.length, 1);
    assert.equal(prerequisiteCompleted.workflow_preparation.generated_workflow_ids.length, 1);
    assert.equal(prerequisiteCompleted.session_dispatch.waiting_task_ids.length, 2);

    const readyTasks = await ring.list('task');
    const sessionReadyTasks = readyTasks.filter(
      (item) => item.data.requirement_id === result.requirement.id,
    );
    assert.deepEqual(
      sessionReadyTasks.map((item) => item.status),
      ['ready', 'ready'],
    );

    const tickResult = await ring.orchestrator.tick();
    const dispatched = tickResult.processed.find((job) => job.id === result.job.id);
    assert.ok(dispatched ?? tickResult.processed_bundles.length > 0);
    const launchedJob =
      dispatched?.status === 'session_dispatched'
        ? dispatched
        : await ring.orchestrator.readJob(result.job.id);
    assert.equal(launchedJob.status, 'session_dispatched');
    assert.ok(launchedJob.session_dispatch.session_id);
    assert.equal(launchedJob.session_dispatch.workflow_run_ids.length, 2);

    const launchedSession = await ring.read(
      'session',
      launchedJob.session_dispatch.session_id,
    );
    assert.equal(launchedSession.status, 'executing');
    assert.deepEqual(
      launchedSession.data.task_ids.sort(),
      prerequisiteCompleted.post_milestone.task_dispatch.generated_task_ids.slice().sort(),
    );

    const workflowRuns = await ring.list('workflow-run');
    assert.equal(
      workflowRuns.filter((item) => item.session_id === launchedSession.id).length,
      2,
    );

    const launchedTasks = await ring.list('task');
    const inSessionTasks = launchedTasks.filter(
      (item) => item.session_id === launchedSession.id,
    );
    assert.equal(inSessionTasks.length, 2);
    assert.deepEqual(
      inSessionTasks.map((item) => item.status),
      ['in_progress', 'in_progress'],
    );
  });

  it('surfaces warm-lineage governance reasons when workflow preparation is retried', async () => {
    const result = await ring.orchestrator.createRequirementDispatch({
      name: 'Workflow Guidance Warm Lineage',
      description:
        'Workflow preparation guidance should explain why a reusable template is governance-blocked.',
      priority: 'high',
      acceptance_criteria: [
        { id: 'ac1', description: 'Guidance exposes governance reasons', satisfied: false },
      ],
      created_by: 'test',
    });

    await writeFile(
      join(tempDir, result.job.requirement_document.document.path),
      `# Workflow Guidance Warm Lineage

## Goal

This requirement document is complete and ready for milestone planning. It is
explicit enough that prerequisites and early tasks can be split once the
milestones are generated.

## Acceptance Criteria

- Guidance explains governance-blocked workflow reuse
- Ready tasks can still reuse healthy templates
`,
      'utf-8',
    );

    const milestonePlanning = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'writer-agent',
      status: 'completed',
      note: 'Requirement doc complete.',
    });

    await writeFile(
      join(tempDir, milestonePlanning.milestone_plan.document.path),
      `# Workflow Guidance Warm Lineage Milestone Plan

## Planning Context

Split the work into a foundation phase and an execution phase.

## Milestone 1: Foundation

Set up the project baseline and approvals.

### Acceptance Checks

- Baseline is documented

### Prerequisites

- [human] Stakeholder approval is confirmed
- [reference] API contract is published

## Milestone 2: Execution

Implement the dispatchable work once dependencies are ready.

### Acceptance Checks

- Dispatchable work is identified

### Prerequisites

- [automated] Integration test harness is green
`,
      'utf-8',
    );

    const postMilestone = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'milestone-planner',
      status: 'completed',
      note: 'Milestones complete.',
    });

    await writeFile(
      join(tempDir, postMilestone.post_milestone.prerequisite_analysis.document.path),
      `# Workflow Guidance Warm Lineage Prerequisite Analysis

## Goal

Split milestone prerequisites into ready and blocked sets.

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[0]}: Foundation

### Ready Now

- [human] Stakeholder approval is confirmed

### Blocked / Missing

- [reference] API contract is published | reason: API review has not finished

## Milestone ${postMilestone.milestone_plan.generated_milestone_ids[1]}: Execution

### Ready Now

- [automated] Integration test harness is green

### Blocked / Missing

- [human] Ops rollout window is scheduled | reason: rollout calendar is still pending
`,
      'utf-8',
    );

    const reusableWorkflow = await ring.create('workflow', {
      id: 'wf-guidance-docs-template',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Guidance Docs Template',
        description: 'Reusable workflow for documentation tasks with a healthy latest run.',
        applicable_to: ['documentation'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the task document.' },
          { id: 's2', name: 'draft', description: 'Produce the documentation output.' },
          { id: 's3', name: 'verify', description: 'Check acceptance criteria.' },
        ],
      },
    });
    assert.equal(reusableWorkflow.ok, true, JSON.stringify(reusableWorkflow.errors));
    await ring.registry.recordScore('documentation', 'wf-guidance-docs-template', 0.92);

    const blockedWorkflow = await ring.create('workflow', {
      id: 'wf-guidance-docs-lineage-hold',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Guidance Docs Warm Lineage Template',
        description:
          'Reusable workflow for documentation tasks that should be withheld once warm timeout lineage exists.',
        applicable_to: ['documentation'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the task document.' },
          { id: 's2', name: 'draft', description: 'Produce the documentation output.' },
          { id: 's3', name: 'verify', description: 'Check acceptance criteria.' },
        ],
      },
    });
    assert.equal(blockedWorkflow.ok, true, JSON.stringify(blockedWorkflow.errors));
    await ring.registry.recordScore('documentation', 'wf-guidance-docs-lineage-hold', 0.99);

    const warmLineageRun = await ring.create('workflow-run', {
      id: 'run-guidance-docs-lineage-hold',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-17T00:00:00Z',
      updated_at: '2026-04-17T00:01:00Z',
      created_by: 'session-runner',
      session_id: 'session-guidance-docs-lineage-hold',
      status: 'failed',
      data: {
        workflow_template_id: 'wf-guidance-docs-lineage-hold',
        workflow_template_version: 1,
        task_id: 'task-guidance-docs-lineage-hold',
        current_step_index: 1,
        callback: {
          auth_scheme: 'bearer',
          report_url:
            'http://127.0.0.1:3100/api/workflow-run/run-guidance-docs-lineage-hold/report',
          token: 'token-guidance-docs-lineage-hold',
          signing_secret: 'signing-secret-guidance-docs-lineage-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'timed_out',
          issued_at: '2026-04-17T00:00:00Z',
          prepared_at: '2026-04-17T00:00:05Z',
          last_report_at: '2026-04-17T00:00:40Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 3,
          retry_count: 1,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-17T00:05:00Z',
          packet_path:
            '.ring/orchestrator/runner/sessions/session-guidance-docs-lineage-hold/run-guidance-docs-lineage-hold.json',
          allowed_worker_ids: ['worker-guidance'],
          accepted_protocols: ['ring.workflow-run-report.v1', 'a2a.task-status.v1'],
          last_worker_id: 'worker-guidance',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: 'Timed out after progress was already reported.',
        },
        reports: [
          {
            at: '2026-04-17T00:00:40Z',
            status: 'progress',
            actor: 'worker-guidance',
            step_id: 'draft',
            note: 'Semantic progress advanced the checkpoint lineage before timeout.',
            commit_sha: null,
            worker_id: 'worker-guidance',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Execution made semantic progress.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-guidance-docs-lineage-hold',
          branch_id: 'main',
          active_checkpoint_id: 'cp-guidance-docs-lineage-2',
          checkpoint_ids: [
            'cp-guidance-docs-root',
            'cp-guidance-docs-lineage-1',
            'cp-guidance-docs-lineage-2',
          ],
          branch_event_ids: ['be-guidance-docs-lineage-1', 'be-guidance-docs-lineage-2'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-guidance-docs-lineage-hold',
            runtime_status: 'recovering',
            current_checkpoint_id: 'cp-guidance-docs-lineage-2',
            replay: {
              status: 'requested',
              requested_at: '2026-04-17T00:00:45Z',
              completed_at: null,
              requested_by: 'session-runner',
              reason: 'workflow_timeout',
              source_checkpoint_id: 'cp-guidance-docs-lineage-2',
              target_checkpoint_id: 'cp-guidance-docs-lineage-2',
              cursor: { phase: 'execute', step_id: 'draft' },
              journal_state: {
                mode: 'semantic',
                last_applied_entry_id: 'journal-guidance-1',
                pending_entry_ids: ['journal-guidance-2'],
              },
            },
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-17T00:00:10Z',
            ended_at: '2026-04-17T00:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'draft',
            status: 'failed',
            started_at: '2026-04-17T00:00:21Z',
            ended_at: '2026-04-17T00:01:00Z',
            outputs: {},
            notes: 'Timed out after semantic progress.',
          },
        ],
      },
    });
    assert.equal(warmLineageRun.ok, true, JSON.stringify(warmLineageRun.errors));

    const prerequisiteCompleted = await ring.orchestrator.reportAgent(result.job.id, {
      agent_id: 'prerequisite-preparer',
      status: 'completed',
      note: 'Prerequisite split complete.',
    });

    assert.equal(prerequisiteCompleted.status, 'waiting_for_session_dispatch');
    assert.equal(
      prerequisiteCompleted.workflow_preparation.reused_workflow_ids.includes(
        'wf-guidance-docs-template',
      ),
      true,
    );
    assert.equal(
      prerequisiteCompleted.workflow_preparation.reused_workflow_ids.includes(
        'wf-guidance-docs-lineage-hold',
      ),
      false,
    );

    const jobPath = join(
      tempDir,
      '.ring',
      'orchestrator',
      'jobs',
      `${result.job.id}.json`,
    );
    const jobRecord = JSON.parse(await readFile(jobPath, 'utf-8'));
    jobRecord.status = 'workflow_rework_required';
    jobRecord.current_stage = 'workflow_preparation';
    jobRecord.workflow_preparation.status = 'rework_required';
    jobRecord.workflow_preparation.parse_error =
      'Retry requested so the workflow planner can review governance guidance.';
    jobRecord.workflow_preparation.completed_at = null;
    await writeFile(jobPath, `${JSON.stringify(jobRecord, null, 2)}\n`, 'utf-8');

    const retried = await ring.orchestrator.retryJob(result.job.id);
    assert.equal(retried.status, 'workflow_dispatched');
    assert.equal(retried.current_stage, 'workflow_preparation');
    assert.equal(retried.workflow_preparation.status, 'planning');
    assert.ok(retried.workflow_preparation.dispatch.packet);

    const scaffold = await readFile(
      join(tempDir, retried.workflow_preparation.document.path),
      'utf-8',
    );
    assert.match(
      scaffold,
      /Governance-blocked reuse: wf-guidance-docs-lineage-hold \(Guidance Docs Warm Lineage Template\) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse/,
    );
    assert.match(
      retried.workflow_preparation.dispatch.packet.body,
      /governance_blocked_reuse: wf-guidance-docs-lineage-hold \(Guidance Docs Warm Lineage Template\) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse/,
    );
  });

  it('ingests a ring.goal bundle and launches it through the adaptive dispatcher', async () => {
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-test',
      payload: {
        goal: {
          title: 'Adaptive Bundle Delivery',
          description:
            'Create the smallest dispatchable task set from a ready goal bundle.',
          acceptance_criteria: [
            'A task is created',
            'A workflow is resolved',
            'A session is launched',
          ],
        },
        environment: {
          project_id: 'bundle-project',
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
            material_id: 'mat-1',
            kind: 'preparation_package',
            uri: null,
            format: 'json',
            mount_to: 'workspace/prep',
            required: true,
            inline_data: '{"ready":true}',
          },
        ],
        context: {
          artifact_refs: ['artifact://design-spec'],
          brief_ref: 'artifact://brief',
        },
      },
    });

    assert.equal(bundle.status, 'ready_queued');
    assert.equal(bundle.canonical.goal.title, 'Adaptive Bundle Delivery');
    assert.equal(bundle.planning.planned_task_ids.length, 1);
    assert.equal(bundle.workflows.waiting_tasks.length, 1);

    const queuedTask = await ring.read('task', bundle.planning.planned_task_ids[0]);
    assert.equal(queuedTask.status, 'ready');
    assert.equal(queuedTask.data.scope.target_type, 'file');

    const tickResult = await ring.orchestrator.tick();
    const launchedBundle = tickResult.processed_bundles.find(
      (item) => item.id === bundle.id,
    );
    assert.ok(launchedBundle);
    assert.equal(launchedBundle.status, 'session_launched');
    assert.ok(launchedBundle.batching.session_id);

    const launchedSession = await ring.read(
      'session',
      launchedBundle.batching.session_id,
    );
    assert.equal(launchedSession.status, 'executing');
    assert.deepEqual(
      launchedSession.data.task_ids,
      bundle.planning.planned_task_ids,
    );
  });

  it('avoids automatic workflow reuse when the latest template run already has warm semantic lineage', async () => {
    const reusableWorkflow = await ring.create('workflow', {
      id: 'wf-bugfix-lineage-hold',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Bugfix Warm Lineage Template',
        description: 'Reusable workflow for bug-fix tasks that should require explicit reuse once warm timeout lineage exists.',
        applicable_to: ['bug-fix'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the failing path.' },
          { id: 's2', name: 'patch', description: 'Patch the regression.' },
          { id: 's3', name: 'verify', description: 'Verify the regression fix.' },
        ],
      },
    });
    assert.equal(reusableWorkflow.ok, true, JSON.stringify(reusableWorkflow.errors));
    await ring.registry.recordScore('bug-fix', 'wf-bugfix-lineage-hold', 0.99);

    const warmLineageRun = await ring.create('workflow-run', {
      id: 'run-bugfix-lineage-hold',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-17T00:00:00Z',
      updated_at: '2026-04-17T00:01:00Z',
      created_by: 'session-runner',
      session_id: 'session-bugfix-lineage-hold',
      status: 'failed',
      data: {
        workflow_template_id: 'wf-bugfix-lineage-hold',
        workflow_template_version: 1,
        task_id: 'task-bugfix-lineage-hold',
        current_step_index: 1,
        callback: {
          auth_scheme: 'bearer',
          report_url: 'http://127.0.0.1:3100/api/workflow-run/run-bugfix-lineage-hold/report',
          token: 'token-bugfix-lineage-hold',
          signing_secret: 'signing-secret-bugfix-lineage-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'timed_out',
          issued_at: '2026-04-17T00:00:00Z',
          prepared_at: '2026-04-17T00:00:05Z',
          last_report_at: '2026-04-17T00:00:40Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 3,
          retry_count: 1,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-17T00:05:00Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-bugfix-lineage-hold/run-bugfix-lineage-hold.json',
          allowed_worker_ids: ['worker-1'],
          accepted_protocols: ['ring.workflow-run-report.v1', 'a2a.task-status.v1'],
          last_worker_id: 'worker-1',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: 'Timed out after progress was already reported.',
        },
        reports: [
          {
            at: '2026-04-17T00:00:40Z',
            status: 'progress',
            actor: 'worker-1',
            step_id: 'patch',
            note: 'Semantic progress advanced the checkpoint lineage before timeout.',
            commit_sha: null,
            worker_id: 'worker-1',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Execution made semantic progress.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-bugfix-lineage-hold',
          branch_id: 'main',
          active_checkpoint_id: 'cp-lineage-2',
          checkpoint_ids: ['cp-root', 'cp-lineage-1', 'cp-lineage-2'],
          branch_event_ids: ['be-lineage-1', 'be-lineage-2'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-bugfix-lineage-hold',
            runtime_status: 'recovering',
            current_checkpoint_id: 'cp-lineage-2',
            replay: {
              status: 'requested',
              requested_at: '2026-04-17T00:00:45Z',
              completed_at: null,
              requested_by: 'session-runner',
              reason: 'workflow_timeout',
              source_checkpoint_id: 'cp-lineage-2',
              target_checkpoint_id: 'cp-lineage-2',
              cursor: { phase: 'execute', step_id: 'patch' },
              journal_state: {
                mode: 'semantic',
                last_applied_entry_id: 'journal-1',
                pending_entry_ids: ['journal-2'],
              },
            },
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-17T00:00:10Z',
            ended_at: '2026-04-17T00:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'patch',
            status: 'failed',
            started_at: '2026-04-17T00:00:21Z',
            ended_at: '2026-04-17T00:01:00Z',
            outputs: {},
            notes: 'Timed out after semantic progress.',
          },
        ],
      },
    });
    assert.equal(warmLineageRun.ok, true, JSON.stringify(warmLineageRun.errors));

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-test',
      payload: {
        goal: {
          title: 'Regression fix after warm lineage timeout',
          description:
            'Fix the failing regression and avoid blindly reusing a workflow template that already timed out after semantic progress.',
          acceptance_criteria: [
            'A task is created',
            'Warm-lineage workflow reuse is not automatic',
          ],
        },
        environment: {
          project_id: 'bundle-project-warm-lineage',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['src/regression.js'],
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
            material_id: 'mat-warm-lineage',
            kind: 'preparation_package',
            uri: null,
            format: 'json',
            mount_to: 'workspace/lineage',
            required: true,
            inline_data: '{"lineageAware":true}',
          },
        ],
        context: {
          artifact_refs: [],
          brief_ref: null,
        },
      },
    });

    assert.equal(bundle.status, 'ready_queued');
    assert.equal(bundle.planning.planned_task_ids.length, 1);
    assert.equal(bundle.workflows.reused_workflow_ids.length, 0);
    assert.equal(bundle.workflows.generated_workflow_ids.length, 1);
    assert.equal(bundle.workflows.waiting_tasks.length, 1);
    assert.equal(bundle.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.notEqual(bundle.workflows.waiting_tasks[0].workflow_template_id, 'wf-bugfix-lineage-hold');

    const queuedTask = await ring.read('task', bundle.planning.planned_task_ids[0]);
    assert.equal(queuedTask.data.task_type, 'bug-fix');
    assert.equal(queuedTask.data.workflow_template_id, bundle.workflows.generated_workflow_ids[0]);
    assert.notEqual(queuedTask.data.workflow_template_id, 'wf-bugfix-lineage-hold');

    const generatedWorkflow = await ring.read('workflow', bundle.workflows.generated_workflow_ids[0]);
    assert.equal(generatedWorkflow.status, 'active');
    assert.match(generatedWorkflow.data.description, /Generated workflow for task/);

    const archivedReusable = await ring.update('workflow', 'wf-bugfix-lineage-hold', {
      status: 'archived',
    });
    assert.equal(archivedReusable.ok, true, JSON.stringify(archivedReusable.errors));

    const archivedGenerated = await ring.update('workflow', bundle.workflows.generated_workflow_ids[0], {
      status: 'archived',
    });
    assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
  });

  it('only auto-reuses a synthesized template again after mainline adoption clears any inherited branch-budget hold', async () => {
    const reusableWorkflow = await ring.create('workflow', {
      id: 'wf-docs-synth-hold',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Lineage Synthesis Governance Template',
        description: 'Reusable workflow for governance tasks that should stay blocked until synthesized lineage is adopted and its inherited policy hold is cleared.',
        applicable_to: ['feature-implementation'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the regression context.' },
          { id: 's2', name: 'qa', description: 'Run the focused verification path.' },
          { id: 's3', name: 'verify', description: 'Verify the regression result.' },
        ],
      },
    });
    assert.equal(reusableWorkflow.ok, true, JSON.stringify(reusableWorkflow.errors));
    await ring.registry.recordScore('feature-implementation', 'wf-docs-synth-hold', 99.97);

    const rootCheckpoint = createWorkflowRunCheckpoint({
      id: 'cp-docs-synth-root',
      created_by: 'session-runner',
      node_id: 'n-docs-synth-hold',
      scope_ref: { kind: 'workflow-run', id: 'run-docs-synth-hold', path: null },
      execution_cursor: { phase: 'completed', step_id: 'verify', ordinal: 2 },
    });
    const leftCheckpoint = forkCheckpoint(rootCheckpoint, {
      id: 'cp-docs-synth-left',
      created_by: 'review-left',
      branch_id: 'docs.left',
      execution_cursor: { phase: 'review', step_id: 'verify', ordinal: 2 },
      evidence_refs: [{ kind: 'doc', ref: 'docs:left', digest: 'left1' }],
      policy_snapshot: {
        workflow_tightness: 'tight',
        oversight_strength: 'normal',
        branch_budget: 0,
        notes: 'The left review branch already exhausted its governed branch budget.',
      },
    });
    const rightCheckpoint = forkCheckpoint(rootCheckpoint, {
      id: 'cp-docs-synth-right',
      created_by: 'review-right',
      branch_id: 'docs.right',
      execution_cursor: { phase: 'review', step_id: 'verify', ordinal: 2 },
      evidence_refs: [{ kind: 'doc', ref: 'docs:right', digest: 'right2' }],
      policy_snapshot: {
        workflow_tightness: 'balanced',
        oversight_strength: 'strong',
        branch_budget: 2,
        notes: 'The right review branch required stronger oversight for synthesis review.',
      },
    });
    const synthesizedCheckpoint = synthesizeCheckpoint([leftCheckpoint, rightCheckpoint], {
      id: 'cp-docs-synth-active',
      created_by: 'judge-agent',
      branch_id: 'docs.synth',
      node_id: 'n-docs-synth-hold',
      scope_ref: { kind: 'workflow-run', id: 'run-docs-synth-hold', path: null },
      execution_cursor: { phase: 'synthesize', step_id: 'merge', ordinal: 3 },
    });

    assert.equal(synthesizedCheckpoint.data.policy_snapshot.workflow_tightness, 'tight');
    assert.equal(synthesizedCheckpoint.data.policy_snapshot.oversight_strength, 'strong');
    assert.equal(synthesizedCheckpoint.data.policy_snapshot.branch_budget, 0);
    assert.match(
      synthesizedCheckpoint.data.policy_snapshot.notes ?? '',
      /left review branch already exhausted its governed branch budget/i,
    );
    assert.match(
      synthesizedCheckpoint.data.policy_snapshot.notes ?? '',
      /right review branch required stronger oversight for synthesis review/i,
    );

    for (const checkpoint of [
      rootCheckpoint,
      leftCheckpoint,
      rightCheckpoint,
      synthesizedCheckpoint,
    ]) {
      const checkpointResult = await ring.create('checkpoint', {
        id: checkpoint.id,
        status: checkpoint.status,
        created_by: checkpoint.created_by,
        session_id: checkpoint.session_id,
        data: checkpoint.data,
      });
      assert.equal(checkpointResult.ok, true, JSON.stringify(checkpointResult.errors));
    }

    const synthesizedRun = await ring.create('workflow-run', {
      id: 'run-docs-synth-hold',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-18T00:00:00Z',
      updated_at: '2026-04-18T00:01:00Z',
      created_by: 'session-runner',
      session_id: 'session-docs-synth-hold',
      status: 'completed',
      data: {
        workflow_template_id: 'wf-docs-synth-hold',
        workflow_template_version: 1,
        task_id: 'task-docs-synth-hold',
        current_step_index: 2,
        callback: {
          auth_scheme: 'bearer',
          report_url: 'http://127.0.0.1:3100/api/workflow-run/run-docs-synth-hold/report',
          token: 'token-docs-synth-hold',
          signing_secret: 'signing-secret-docs-synth-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'completed',
          issued_at: '2026-04-18T00:00:00Z',
          prepared_at: '2026-04-18T00:00:05Z',
          last_report_at: '2026-04-18T00:00:50Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 2,
          retry_count: 0,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-18T00:05:00Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-docs-synth-hold/run-docs-synth-hold.json',
          allowed_worker_ids: ['worker-docs'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-docs',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: null,
        },
        reports: [
          {
            at: '2026-04-18T00:00:50Z',
            status: 'completed',
            actor: 'worker-docs',
            step_id: 'verify',
            note: 'The regression branch was synthesized for review but has not been adopted into mainline yet.',
            commit_sha: null,
            worker_id: 'worker-docs',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Regression fix completed and synthesized.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-docs-synth-hold',
          branch_id: 'docs.synth',
          active_checkpoint_id: 'cp-docs-synth-active',
          checkpoint_ids: [
            'cp-docs-synth-root',
            'cp-docs-synth-left',
            'cp-docs-synth-right',
            'cp-docs-synth-active',
          ],
          branch_event_ids: ['be-docs-synth-1'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-docs-synth-hold',
            runtime_status: 'completed',
            current_checkpoint_id: 'cp-docs-synth-active',
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T00:00:10Z',
            ended_at: '2026-04-18T00:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'qa',
            status: 'completed',
            started_at: '2026-04-18T00:00:21Z',
            ended_at: '2026-04-18T00:00:35Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'verify',
            status: 'completed',
            started_at: '2026-04-18T00:00:36Z',
            ended_at: '2026-04-18T00:00:50Z',
            outputs: {},
            notes: 'Completed on synthesized lineage pending adoption.',
          },
        ],
      },
    });
    assert.equal(synthesizedRun.ok, true, JSON.stringify(synthesizedRun.errors));

    const submitDocsBundle = (projectId, title) => ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-test',
      payload: {
        goal: {
          title,
          description:
            'Advance the synthesized lineage governance rollout without automatically reusing a template whose inherited checkpoint policy is still active.',
          acceptance_criteria: [
            'A governance task is created',
            'Synthesized checkpoint policy influences workflow reuse',
          ],
        },
        environment: {
          project_id: projectId,
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['src/lineage-governance.js'],
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
            material_id: `${projectId}-policy`,
            kind: 'preparation_package',
            uri: null,
            format: 'json',
            mount_to: 'workspace/policy',
            required: true,
            inline_data: '{"governance":true}',
          },
        ],
        context: {
          artifact_refs: [],
          brief_ref: null,
        },
      },
    });

    const blockedBundle = await submitDocsBundle(
      'bundle-project-synth-lineage-blocked',
      'Checkpoint governance rollout while synthesized lineage is not yet mainline',
    );

    assert.equal(blockedBundle.status, 'ready_queued');
    assert.equal(
      blockedBundle.workflows.reused_workflow_ids.includes('wf-docs-synth-hold'),
      false,
    );
    assert.equal(
      blockedBundle.workflows.generated_workflow_ids.includes('wf-docs-synth-hold'),
      false,
    );
    assert.notEqual(blockedBundle.workflows.waiting_tasks[0].workflow_template_id, 'wf-docs-synth-hold');

    const blockedGeneratedWorkflowId = blockedBundle.workflows.generated_workflow_ids[0] ?? null;
    if (blockedGeneratedWorkflowId) {
      const archivedGenerated = await ring.update('workflow', blockedGeneratedWorkflowId, {
        status: 'archived',
      });
      assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
    }

    const adoptedCheckpoint = await ring.update('checkpoint', 'cp-docs-synth-active', {
      status: 'mainline',
      data: {
        adoption_status: 'mainline',
        policy_snapshot: synthesizedCheckpoint.data.policy_snapshot,
      },
    });
    assert.equal(adoptedCheckpoint.ok, true, JSON.stringify(adoptedCheckpoint.errors));

    const governedAfterAdoptionBundle = await submitDocsBundle(
      'bundle-project-synth-lineage-adopted-governed',
      'Checkpoint governance rollout after mainline adoption while inherited branch budget stays active',
    );

    assert.equal(governedAfterAdoptionBundle.status, 'ready_queued');
    assert.equal(
      governedAfterAdoptionBundle.workflows.reused_workflow_ids.includes('wf-docs-synth-hold'),
      false,
    );
    assert.notEqual(
      governedAfterAdoptionBundle.workflows.waiting_tasks[0].workflow_template_id,
      'wf-docs-synth-hold',
    );

    const adoptedGovernedWorkflowId = governedAfterAdoptionBundle.workflows.generated_workflow_ids[0] ?? null;
    if (adoptedGovernedWorkflowId) {
      const archivedGenerated = await ring.update('workflow', adoptedGovernedWorkflowId, {
        status: 'archived',
      });
      assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
    }

    const clearedCheckpoint = await ring.update('checkpoint', 'cp-docs-synth-active', {
      data: {
        adoption_status: 'mainline',
        policy_snapshot: {
          workflow_tightness: 'balanced',
          oversight_strength: 'normal',
          branch_budget: null,
          notes: 'A later healthy mainline pass cleared the inherited synthesized governance hold.',
        },
      },
    });
    assert.equal(clearedCheckpoint.ok, true, JSON.stringify(clearedCheckpoint.errors));

    const adoptedBundle = await submitDocsBundle(
      'bundle-project-synth-lineage-cleared',
      'Checkpoint governance rollout after mainline adoption and policy clear',
    );

    assert.equal(adoptedBundle.status, 'ready_queued');
    assert.deepEqual(adoptedBundle.workflows.reused_workflow_ids, ['wf-docs-synth-hold']);
    assert.equal(adoptedBundle.workflows.generated_workflow_ids.length, 0);
    assert.equal(adoptedBundle.workflows.waiting_tasks[0].workflow_source, 'registry_reuse');
    assert.equal(adoptedBundle.workflows.waiting_tasks[0].workflow_template_id, 'wf-docs-synth-hold');

    const archivedReusable = await ring.update('workflow', 'wf-docs-synth-hold', {
      status: 'archived',
    });
    assert.equal(archivedReusable.ok, true, JSON.stringify(archivedReusable.errors));
  });

  it('keeps automatic reuse blocked while the latest mainline checkpoint still exhausts branch budget', async () => {
    const reusableWorkflow = await ring.create('workflow', {
      id: 'wf-docs-tight-policy-hold',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Docs Tight Policy Template',
        description: 'Reusable workflow for testing tasks that should stay blocked while the latest mainline checkpoint still carries exhausted branch budget.',
        applicable_to: ['testing'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the governance context.' },
          { id: 's2', name: 'verify', description: 'Run the governed verification path.' },
          { id: 's3', name: 'report', description: 'Summarize the result.' },
        ],
      },
    });
    assert.equal(reusableWorkflow.ok, true, JSON.stringify(reusableWorkflow.errors));
    await ring.registry.recordScore('testing', 'wf-docs-tight-policy-hold', 9.98);

    const governedCheckpoint = createWorkflowRunCheckpoint({
      id: 'cp-docs-tight-policy-active',
      status: 'mainline',
      created_by: 'session-runner',
      node_id: 'n-docs-tight-policy',
      scope_ref: { kind: 'workflow-run', id: 'run-docs-tight-policy', path: null },
      execution_cursor: { phase: 'completed', step_id: 'report', ordinal: 2 },
      adoption_status: 'mainline',
      policy_snapshot: {
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
        branch_budget: 0,
        notes: 'Warm-lineage recovery already consumed the branch budget for this template.',
      },
    });

    const checkpointResult = await ring.create('checkpoint', {
      id: governedCheckpoint.id,
      status: governedCheckpoint.status,
      created_by: governedCheckpoint.created_by,
      session_id: governedCheckpoint.session_id,
      data: governedCheckpoint.data,
    });
    assert.equal(checkpointResult.ok, true, JSON.stringify(checkpointResult.errors));

    const governedRun = await ring.create('workflow-run', {
      id: 'run-docs-tight-policy',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-18T01:00:00Z',
      updated_at: '2026-04-18T01:01:00Z',
      created_by: 'session-runner',
      session_id: 'session-docs-tight-policy',
      status: 'completed',
      data: {
        workflow_template_id: 'wf-docs-tight-policy-hold',
        workflow_template_version: 1,
        task_id: 'task-docs-tight-policy',
        current_step_index: 2,
        callback: {
          auth_scheme: 'bearer',
          report_url: 'http://127.0.0.1:3100/api/workflow-run/run-docs-tight-policy/report',
          token: 'token-docs-tight-policy',
          signing_secret: 'signing-secret-docs-tight-policy',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'completed',
          issued_at: '2026-04-18T01:00:00Z',
          prepared_at: '2026-04-18T01:00:05Z',
          last_report_at: '2026-04-18T01:00:50Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 0,
          retry_count: 0,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-18T01:05:00Z',
          packet_path: '.ring/orchestrator/runner/sessions/session-docs-tight-policy/run-docs-tight-policy.json',
          allowed_worker_ids: ['worker-docs-tight'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-docs-tight',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: null,
        },
        reports: [
          {
            at: '2026-04-18T01:00:50Z',
            status: 'completed',
            actor: 'worker-docs-tight',
            step_id: 'report',
            note: 'The governed redispatch completed under a root checkpoint that already exhausted branch budget.',
            commit_sha: null,
            worker_id: 'worker-docs-tight',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Governed verification completed.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-docs-tight-policy',
          branch_id: 'main',
          active_checkpoint_id: 'cp-docs-tight-policy-active',
          checkpoint_ids: ['cp-docs-tight-policy-active'],
          branch_event_ids: ['be-docs-tight-policy-1'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-docs-tight-policy',
            runtime_status: 'completed',
            current_checkpoint_id: 'cp-docs-tight-policy-active',
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T01:00:10Z',
            ended_at: '2026-04-18T01:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'verify',
            status: 'completed',
            started_at: '2026-04-18T01:00:21Z',
            ended_at: '2026-04-18T01:00:35Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'report',
            status: 'completed',
            started_at: '2026-04-18T01:00:36Z',
            ended_at: '2026-04-18T01:00:50Z',
            outputs: {},
            notes: 'Completed under a branch_budget=0 checkpoint policy.',
          },
        ],
      },
    });
    assert.equal(governedRun.ok, true, JSON.stringify(governedRun.errors));

    const submitDocsBundle = (projectId, title) => ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-test',
      payload: {
        goal: {
          title,
          description:
            'Verify the regression without automatically reusing a template whose latest mainline checkpoint already exhausted branch budget.',
          acceptance_criteria: [
            'A testing task is created',
            'Checkpoint policy affects workflow reuse',
          ],
        },
        environment: {
          project_id: projectId,
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['src/regression.js'],
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
            material_id: `${projectId}-docs`,
            kind: 'preparation_package',
            uri: null,
            format: 'json',
            mount_to: 'workspace/bugfix',
            required: true,
            inline_data: '{"bugfix":true}',
          },
        ],
        context: {
          artifact_refs: [],
          brief_ref: null,
        },
      },
    });

    const blockedBundle = await submitDocsBundle(
      'bundle-project-tight-policy-blocked',
      'Regression verification while branch budget is exhausted',
    );

    assert.equal(blockedBundle.status, 'ready_queued');
    assert.equal(
      blockedBundle.workflows.reused_workflow_ids.includes('wf-docs-tight-policy-hold'),
      false,
    );
    assert.notEqual(
      blockedBundle.workflows.waiting_tasks[0].workflow_template_id,
      'wf-docs-tight-policy-hold',
    );

    const clearedCheckpoint = await ring.update('checkpoint', 'cp-docs-tight-policy-active', {
      data: {
        adoption_status: 'mainline',
        policy_snapshot: {
          workflow_tightness: 'balanced',
          oversight_strength: 'normal',
          branch_budget: null,
          notes: 'A later healthy pass cleared the tight governance hold.',
        },
      },
    });
    assert.equal(clearedCheckpoint.ok, true, JSON.stringify(clearedCheckpoint.errors));

    const clearedBundle = await submitDocsBundle(
      'bundle-project-tight-policy-cleared',
      'Regression verification after branch budget clears',
    );

    assert.equal(clearedBundle.status, 'ready_queued');
    assert.deepEqual(clearedBundle.workflows.reused_workflow_ids, ['wf-docs-tight-policy-hold']);
    assert.equal(clearedBundle.workflows.generated_workflow_ids.length, 0);
    assert.equal(clearedBundle.workflows.waiting_tasks[0].workflow_source, 'registry_reuse');
    assert.equal(clearedBundle.workflows.waiting_tasks[0].workflow_template_id, 'wf-docs-tight-policy-hold');

    const archivedReusable = await ring.update('workflow', 'wf-docs-tight-policy-hold', {
      status: 'archived',
    });
    assert.equal(archivedReusable.ok, true, JSON.stringify(archivedReusable.errors));

    if (blockedBundle.workflows.generated_workflow_ids[0]) {
      const archivedGenerated = await ring.update('workflow', blockedBundle.workflows.generated_workflow_ids[0], {
        status: 'archived',
      });
      assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
    }
  });

  it('prefers an unconstrained reusable workflow before consuming inherited mainline checkpoint policy', async () => {
    const isolated = await createIsolatedOrchestratorRing();

    try {
      const { ring: isolatedRing, repoRoot } = isolated;
      const constrainedWorkflow = await isolatedRing.create('workflow', {
        id: 'wf-testing-constrained-policy-carryover',
        status: 'active',
        created_by: 'test',
        data: {
          name: 'Testing Constrained Policy Carryover',
          description: 'Reusable testing workflow whose latest mainline checkpoint still carries a governed branch budget.',
          applicable_to: ['testing'],
          steps: [
            { id: 'inspect', name: 'Inspect', description: 'Inspect the regression target.' },
            { id: 'verify', name: 'Verify', description: 'Run the governed verification path.' },
            { id: 'report', name: 'Report', description: 'Summarize the result.' },
          ],
        },
      });
      assert.equal(constrainedWorkflow.ok, true, JSON.stringify(constrainedWorkflow.errors));
      await isolatedRing.registry.recordScore('testing', 'wf-testing-constrained-policy-carryover', 9.99);

      const healthyWorkflow = await isolatedRing.create('workflow', {
        id: 'wf-testing-healthy-default',
        status: 'active',
        created_by: 'test',
        data: {
          name: 'Testing Healthy Default',
          description: 'Reusable testing workflow with no inherited checkpoint constraints.',
          applicable_to: ['testing'],
          steps: [
            { id: 'inspect', name: 'Inspect', description: 'Inspect the regression target.' },
            { id: 'verify', name: 'Verify', description: 'Run the healthy verification path.' },
            { id: 'report', name: 'Report', description: 'Summarize the result.' },
          ],
        },
      });
      assert.equal(healthyWorkflow.ok, true, JSON.stringify(healthyWorkflow.errors));

      const constrainedCheckpoint = createWorkflowRunCheckpoint({
        id: 'cp-testing-policy-carryover',
        status: 'mainline',
        created_by: 'session-runner',
        node_id: 'n-testing-policy-carryover',
        scope_ref: { kind: 'workflow-run', id: 'run-testing-policy-carryover', path: null },
        execution_cursor: { phase: 'completed', step_id: 'report', ordinal: 2 },
        adoption_status: 'mainline',
        policy_snapshot: {
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
          branch_budget: 1,
          notes: 'The last mainline pass should remain reusable, but only after unconstrained templates are considered first.',
        },
      });
      const checkpointResult = await isolatedRing.create('checkpoint', {
        id: constrainedCheckpoint.id,
        status: constrainedCheckpoint.status,
        created_by: constrainedCheckpoint.created_by,
        session_id: constrainedCheckpoint.session_id,
        data: constrainedCheckpoint.data,
      });
      assert.equal(checkpointResult.ok, true, JSON.stringify(checkpointResult.errors));

      const constrainedRun = await isolatedRing.create('workflow-run', {
        id: 'run-testing-policy-carryover',
        status: 'completed',
        created_by: 'session-runner',
        session_id: 'session-testing-policy-carryover',
        data: {
          workflow_template_id: 'wf-testing-constrained-policy-carryover',
          workflow_template_version: 1,
          task_id: 'task-testing-policy-carryover',
          current_step_index: 2,
          callback: {
            auth_scheme: 'bearer',
            report_url: 'http://127.0.0.1:3100/api/workflow-run/run-testing-policy-carryover/report',
            token: 'token-testing-policy-carryover',
            signing_secret: 'signing-secret-testing-policy-carryover',
            signature_algorithm: 'hmac-sha256',
            key_version: 1,
            status: 'completed',
            issued_at: '2026-04-18T06:10:00Z',
            prepared_at: '2026-04-18T06:10:05Z',
            last_report_at: '2026-04-18T06:10:40Z',
            last_retry_at: null,
            last_rotated_at: null,
            next_retry_at: null,
            report_timeout_ms: 300000,
            max_retries: 0,
            retry_count: 0,
            retry_backoff_ms: 1000,
            signature_ttl_ms: 60000,
            timeout_at: '2026-04-18T06:15:00Z',
            packet_path: '.ring/orchestrator/runner/sessions/session-testing-policy-carryover/run-testing-policy-carryover.json',
            allowed_worker_ids: ['worker-testing-policy'],
            accepted_protocols: ['ring.workflow-run-report.v1'],
            last_worker_id: 'worker-testing-policy',
            last_protocol: 'ring.workflow-run-report.v1',
            last_error: null,
          },
          reports: [
            {
              at: '2026-04-18T06:10:40Z',
              status: 'completed',
              actor: 'worker-testing-policy',
              step_id: 'report',
              note: 'Completed under inherited mainline checkpoint policy so the next automatic reuse should preserve branch budget when a healthy template exists.',
              commit_sha: null,
              worker_id: 'worker-testing-policy',
              protocol: 'ring.workflow-run-report.v1',
              authenticated: true,
              outputs: {
                summary: 'Constrained testing workflow completed successfully.',
              },
            },
          ],
          node_execution: {
            node_id: 'n-testing-policy-carryover',
            branch_id: 'main',
            active_checkpoint_id: 'cp-testing-policy-carryover',
            checkpoint_ids: ['cp-testing-policy-carryover'],
            branch_event_ids: ['be-testing-policy-carryover-1'],
            capsule_state: createEmptyCapsuleState({
              node_id: 'n-testing-policy-carryover',
              runtime_status: 'completed',
              current_checkpoint_id: 'cp-testing-policy-carryover',
            }),
          },
          steps: [
            {
              step_id: 'inspect',
              status: 'completed',
              started_at: '2026-04-18T06:10:10Z',
              ended_at: '2026-04-18T06:10:20Z',
              outputs: {},
              notes: null,
            },
            {
              step_id: 'verify',
              status: 'completed',
              started_at: '2026-04-18T06:10:21Z',
              ended_at: '2026-04-18T06:10:30Z',
              outputs: {},
              notes: null,
            },
            {
              step_id: 'report',
              status: 'completed',
              started_at: '2026-04-18T06:10:31Z',
              ended_at: '2026-04-18T06:10:40Z',
              outputs: {},
              notes: 'Completed under branch_budget=1 inherited policy.',
            },
          ],
        },
      });
      assert.equal(constrainedRun.ok, true, JSON.stringify(constrainedRun.errors));

      const bundle = await isolatedRing.orchestrator.submitDispatchBundle({
        bundle_protocol: 'ring.goal.v1',
        bundle_version: '1',
        artifact_transport: 'inline',
        submitted_by: 'bundle-test',
        payload: {
          goal: {
            title: 'Verify governance-aware reuse selection',
            description:
              'Verify that automatic reuse prefers a healthy reusable workflow before consuming carried mainline checkpoint policy from another testing template.',
            acceptance_criteria: [
              'A testing task is created',
              'Automatic selection prefers the healthy reusable workflow first',
            ],
          },
          environment: {
            project_id: 'bundle-project-governance-preference',
            repo_root: repoRoot,
            target_scope: {
              level: 'file',
              include_paths: ['tests/governance-selection.test.mjs'],
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
              material_id: 'mat-governance-preference',
              kind: 'preparation_package',
              uri: null,
              format: 'json',
              mount_to: 'workspace/selection',
              required: true,
              inline_data: '{"selection":true}',
            },
          ],
          context: {
            artifact_refs: [],
            brief_ref: null,
          },
        },
      });

      assert.equal(bundle.status, 'ready_queued');
      assert.deepEqual(bundle.workflows.reused_workflow_ids, ['wf-testing-healthy-default']);
      assert.equal(bundle.workflows.generated_workflow_ids.length, 0);
      assert.equal(bundle.workflows.waiting_tasks[0].workflow_template_id, 'wf-testing-healthy-default');
      assert.equal(bundle.workflows.waiting_tasks[0].workflow_source, 'registry_reuse');
      assert.equal(bundle.workflows.waiting_tasks[0].registry_rank, null);
      assert.equal(
        bundle.workflows.waiting_tasks[0].registry_mode,
        'governance_prefer_unconstrained',
      );
      assert.deepEqual(bundle.workflows.waiting_tasks[0].governance_blocked_reuse, []);
    } finally {
      await isolated.cleanup();
    }
  });

  it('isolates governance-forced fallback bundles into their own batch session groups', async () => {
    const requirementId = await ring.newId('requirement', {
      name: 'Shared Governance Batch Requirement',
    });
    const milestoneId = await ring.newId('milestone', {
      name: 'Shared Governance Batch Execution',
      parentId: requirementId,
    });

    const requirementResult = await ring.create('requirement', {
      id: requirementId,
      status: 'ready',
      created_by: 'test',
      data: {
        name: 'Shared Governance Batch Requirement',
        description: 'Two adaptive bundles share a batch key so governance-sensitive fallback routing must isolate their launches.',
        acceptance_criteria: [],
        milestone_ids: [milestoneId],
        priority: 'high',
      },
    });
    assert.equal(requirementResult.ok, true, JSON.stringify(requirementResult.errors));

    const milestoneResult = await ring.create('milestone', {
      id: milestoneId,
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Shared Governance Batch Execution',
        requirement_id: requirementId,
        description: 'Launch adaptive bundles with a shared session group key.',
        acceptance_checks: [],
        prerequisites: [],
      },
    });
    assert.equal(milestoneResult.ok, true, JSON.stringify(milestoneResult.errors));

    const healthyWorkflow = await ring.create('workflow', {
      id: 'wf-shared-docs-healthy',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Shared Docs Healthy Template',
        description: 'Reusable refactoring workflow with no governance hold on its latest run.',
        applicable_to: ['refactoring'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the doc target.' },
          { id: 's2', name: 'draft', description: 'Draft the update.' },
          { id: 's3', name: 'verify', description: 'Verify the result.' },
        ],
      },
    });
    assert.equal(healthyWorkflow.ok, true, JSON.stringify(healthyWorkflow.errors));
    await ring.registry.recordScore('refactoring', 'wf-shared-docs-healthy', 9.93);

    const governedWorkflow = await ring.create('workflow', {
      id: 'wf-shared-testing-lineage-hold',
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Shared Testing Warm Lineage Hold',
        description: 'Reusable bug-fix workflow that should trigger governance-sensitive fallback routing after warm timeout lineage.',
        applicable_to: ['bug-fix'],
        steps: [
          { id: 's1', name: 'inspect', description: 'Inspect the regression context.' },
          { id: 's2', name: 'verify', description: 'Verify the governed path.' },
          { id: 's3', name: 'report', description: 'Report the result.' },
        ],
      },
    });
    assert.equal(governedWorkflow.ok, true, JSON.stringify(governedWorkflow.errors));
    await ring.registry.recordScore('bug-fix', 'wf-shared-testing-lineage-hold', 9.99);

    const warmLineageRun = await ring.create('workflow-run', {
      id: 'run-shared-testing-lineage-hold',
      type: 'workflow-run',
      version: 1,
      created_at: '2026-04-18T02:00:00Z',
      updated_at: '2026-04-18T02:01:00Z',
      created_by: 'session-runner',
      session_id: 'session-shared-testing-lineage-hold',
      status: 'failed',
      data: {
        workflow_template_id: 'wf-shared-testing-lineage-hold',
        workflow_template_version: 1,
        task_id: 'task-shared-testing-lineage-hold',
        current_step_index: 1,
        callback: {
          auth_scheme: 'bearer',
          report_url:
            'http://127.0.0.1:3100/api/workflow-run/run-shared-testing-lineage-hold/report',
          token: 'token-shared-testing-lineage-hold',
          signing_secret: 'signing-secret-shared-testing-lineage-hold',
          signature_algorithm: 'hmac-sha256',
          key_version: 1,
          status: 'timed_out',
          issued_at: '2026-04-18T02:00:00Z',
          prepared_at: '2026-04-18T02:00:05Z',
          last_report_at: '2026-04-18T02:00:40Z',
          last_retry_at: null,
          last_rotated_at: null,
          next_retry_at: null,
          report_timeout_ms: 300000,
          max_retries: 2,
          retry_count: 1,
          retry_backoff_ms: 1000,
          signature_ttl_ms: 60000,
          timeout_at: '2026-04-18T02:05:00Z',
          packet_path:
            '.ring/orchestrator/runner/sessions/session-shared-testing-lineage-hold/run-shared-testing-lineage-hold.json',
          allowed_worker_ids: ['worker-testing'],
          accepted_protocols: ['ring.workflow-run-report.v1'],
          last_worker_id: 'worker-testing',
          last_protocol: 'ring.workflow-run-report.v1',
          last_error: 'Timed out after semantic progress was already reported.',
        },
        reports: [
          {
            at: '2026-04-18T02:00:40Z',
            status: 'progress',
            actor: 'worker-testing',
            step_id: 'verify',
            note: 'The checkpoint lineage advanced before timeout.',
            commit_sha: null,
            worker_id: 'worker-testing',
            protocol: 'ring.workflow-run-report.v1',
            authenticated: true,
            outputs: {
              summary: 'Semantic progress exists.',
            },
          },
        ],
        node_execution: {
          node_id: 'n-shared-testing-lineage-hold',
          branch_id: 'main',
          active_checkpoint_id: 'cp-shared-testing-lineage-2',
          checkpoint_ids: ['cp-shared-testing-root', 'cp-shared-testing-lineage-1', 'cp-shared-testing-lineage-2'],
          branch_event_ids: ['be-shared-testing-lineage-1'],
          capsule_state: createEmptyCapsuleState({
            node_id: 'n-shared-testing-lineage-hold',
            runtime_status: 'recovering',
            current_checkpoint_id: 'cp-shared-testing-lineage-2',
            replay: {
              status: 'requested',
              requested_at: '2026-04-18T02:00:45Z',
              completed_at: null,
              requested_by: 'session-runner',
              reason: 'workflow_timeout',
              source_checkpoint_id: 'cp-shared-testing-lineage-2',
              target_checkpoint_id: 'cp-shared-testing-lineage-2',
              cursor: { phase: 'execute', step_id: 'verify' },
              journal_state: {
                mode: 'semantic',
                last_applied_entry_id: 'journal-shared-testing-1',
                pending_entry_ids: ['journal-shared-testing-2'],
              },
            },
          }),
        },
        steps: [
          {
            step_id: 'inspect',
            status: 'completed',
            started_at: '2026-04-18T02:00:10Z',
            ended_at: '2026-04-18T02:00:20Z',
            outputs: {},
            notes: null,
          },
          {
            step_id: 'verify',
            status: 'failed',
            started_at: '2026-04-18T02:00:21Z',
            ended_at: '2026-04-18T02:01:00Z',
            outputs: {},
            notes: 'Timed out after semantic progress.',
          },
        ],
      },
    });
    assert.equal(warmLineageRun.ok, true, JSON.stringify(warmLineageRun.errors));

    const submitSharedBundle = ({ title, description, includePath, materialId, inlineData }) =>
      ring.orchestrator.submitDispatchBundle({
        bundle_protocol: 'ring.goal.v1',
        bundle_version: '1',
        artifact_transport: 'inline',
        submitted_by: 'bundle-test',
        payload: {
          goal: {
            title,
            description,
            acceptance_criteria: ['One task is created and routed into a batch session.'],
          },
          environment: {
            project_id: 'shared-governance-project',
            repo_root: tempDir,
            target_scope: {
              level: 'file',
              include_paths: [includePath],
              exclude_paths: [],
            },
            constraints: {
              must_build: false,
              must_cleanup: false,
              merge_policy: 'judge_then_merge',
              session_group_key: 'shared-batch',
            },
          },
          materials: [
            {
              material_id: materialId,
              kind: 'preparation_package',
              uri: null,
              format: 'json',
              mount_to: 'workspace/shared',
              required: true,
              inline_data: inlineData,
            },
          ],
          context: {
            artifact_refs: [],
            brief_ref: null,
            requirement_id: requirementId,
            milestone_id: milestoneId,
          },
        },
      });

    const cleanBundle = await submitSharedBundle({
      title: 'Refactor shared batch routing',
      description: 'Refactor the shared batch launch behavior around the healthy reusable workflow.',
      includePath: 'docs/shared-governance.md',
      materialId: 'mat-shared-docs',
      inlineData: '{"docs":true}',
    });
    const governedBundle = await submitSharedBundle({
      title: 'Regression bug fix after warm lineage timeout',
      description: 'Fix the governed failure with a fallback workflow after semantic timeout lineage.',
      includePath: 'tests/shared-governance.test.mjs',
      materialId: 'mat-shared-testing',
      inlineData: '{"testing":true}',
    });

    assert.equal(cleanBundle.status, 'ready_queued');
    assert.equal(cleanBundle.workflows.waiting_tasks[0].workflow_source, 'registry_reuse');
    assert.deepEqual(cleanBundle.workflows.waiting_tasks[0].governance_blocked_reuse, []);
    assert.equal(cleanBundle.batching.session_group_key.includes(':governance:'), false);

    assert.equal(governedBundle.status, 'ready_queued');
    assert.equal(governedBundle.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.equal(governedBundle.workflows.waiting_tasks[0].governance_blocked_reuse.length, 1);
    assert.equal(
      governedBundle.workflows.waiting_tasks[0].governance_blocked_reuse[0].reason,
      'warm_semantic_lineage',
    );
    assert.match(
      governedBundle.batching.session_group_key,
      /:governance:warm_semantic_lineage:[a-f0-9]{12}$/,
    );
    assert.notEqual(
      cleanBundle.batching.session_group_key,
      governedBundle.batching.session_group_key,
    );

    await ring.orchestrator.tick();

    const launchedClean = await ring.orchestrator.readDispatchBundle(cleanBundle.id);
    const launchedGoverned = await ring.orchestrator.readDispatchBundle(governedBundle.id);
    assert.equal(launchedClean.status, 'session_launched');
    assert.equal(launchedGoverned.status, 'session_launched');
    assert.ok(launchedClean.batching.session_id);
    assert.ok(launchedGoverned.batching.session_id);
    assert.notEqual(launchedClean.batching.session_id, launchedGoverned.batching.session_id);

    const sharedSessions = (await ring.list('session')).filter(
      (item) => item.data.requirement_id === requirementId,
    );
    assert.equal(sharedSessions.length, 2);
    assert.deepEqual(
      sharedSessions.map((item) => item.data.task_ids.length).sort((a, b) => a - b),
      [1, 1],
    );

    const cleanSession = sharedSessions.find(
      (item) => item.id === launchedClean.batching.session_id,
    );
    const governedSession = sharedSessions.find(
      (item) => item.id === launchedGoverned.batching.session_id,
    );
    assert.ok(cleanSession);
    assert.ok(governedSession);
    assert.equal(cleanSession.data.governance_context ?? null, null);
    assert.equal(governedSession.data.governance_context?.isolated_batch, true);
    assert.equal(
      governedSession.data.governance_context?.batch_signature,
      governedBundle.batching.session_group_key.split(':governance:').at(-1),
    );
    assert.deepEqual(governedSession.data.governance_context?.reasons, [
      'warm_semantic_lineage',
    ]);
    assert.equal(
      governedSession.data.governance_context?.blocked_reuse[0]?.task_id,
      governedSession.data.task_ids[0],
    );
    assert.equal(
      governedSession.data.governance_context?.blocked_reuse[0]?.workflow_template_id,
      'wf-shared-testing-lineage-hold',
    );
    assert.ok(
      governedSession.data.execution_log.some(
        (entry) => entry.event === 'governance_context_injected',
      ),
    );

    const archivedHealthy = await ring.update('workflow', 'wf-shared-docs-healthy', {
      status: 'archived',
    });
    assert.equal(archivedHealthy.ok, true, JSON.stringify(archivedHealthy.errors));

    const archivedGoverned = await ring.update('workflow', 'wf-shared-testing-lineage-hold', {
      status: 'archived',
    });
    assert.equal(archivedGoverned.ok, true, JSON.stringify(archivedGoverned.errors));

    if (governedBundle.workflows.generated_workflow_ids[0]) {
      const archivedGenerated = await ring.update(
        'workflow',
        governedBundle.workflows.generated_workflow_ids[0],
        {
          status: 'archived',
        },
      );
      assert.equal(archivedGenerated.ok, true, JSON.stringify(archivedGenerated.errors));
    }
  });

  it('keeps governed fallback bundles with different lineage fingerprints out of the same shared batch', async () => {
    const requirementId = await ring.newId('requirement', {
      name: 'Governed Lineage Fingerprint Requirement',
    });
    const milestoneId = await ring.newId('milestone', {
      name: 'Governed Lineage Fingerprint Execution',
      parentId: requirementId,
    });

    const requirementResult = await ring.create('requirement', {
      id: requirementId,
      status: 'ready',
      created_by: 'test',
      data: {
        name: 'Governed Lineage Fingerprint Requirement',
        description:
          'Governance-blocked adaptive bundles should only share a batch when their blocked lineage fingerprint matches.',
        acceptance_criteria: [],
        milestone_ids: [milestoneId],
        priority: 'high',
      },
    });
    assert.equal(requirementResult.ok, true, JSON.stringify(requirementResult.errors));

    const milestoneResult = await ring.create('milestone', {
      id: milestoneId,
      status: 'active',
      created_by: 'test',
      data: {
        name: 'Governed Lineage Fingerprint Execution',
        requirement_id: requirementId,
        description: 'Launch governance-blocked adaptive bundles with a shared session group key.',
        acceptance_checks: [],
        prerequisites: [],
      },
    });
    assert.equal(milestoneResult.ok, true, JSON.stringify(milestoneResult.errors));

    const seedWarmLineageWorkflow = async ({
      workflowId,
      workflowName,
      taskType,
      runId,
      taskId,
      sessionId,
      nodeId,
      checkpointId,
      registryScore,
    }) => {
      const workflow = await ring.create('workflow', {
        id: workflowId,
        status: 'active',
        created_by: 'test',
        data: {
          name: workflowName,
          description:
            'Reusable workflow that should force a governed fallback because its latest run timed out after semantic progress.',
          applicable_to: [taskType],
          steps: [
            { id: 's1', name: 'inspect', description: 'Inspect the governance context.' },
            { id: 's2', name: 'verify', description: 'Verify the governed path.' },
            { id: 's3', name: 'report', description: 'Report the result.' },
          ],
        },
      });
      assert.equal(workflow.ok, true, JSON.stringify(workflow.errors));
      await ring.registry.recordScore(taskType, workflowId, registryScore);

      const warmRun = await ring.create('workflow-run', {
        id: runId,
        type: 'workflow-run',
        version: 1,
        created_at: '2026-04-18T03:00:00Z',
        updated_at: '2026-04-18T03:01:00Z',
        created_by: 'session-runner',
        session_id: sessionId,
        status: 'failed',
        data: {
          workflow_template_id: workflowId,
          workflow_template_version: 1,
          task_id: taskId,
          current_step_index: 1,
          callback: {
            auth_scheme: 'bearer',
            report_url: `http://127.0.0.1:3100/api/workflow-run/${runId}/report`,
            token: `token-${runId}`,
            signing_secret: `signing-secret-${runId}`,
            signature_algorithm: 'hmac-sha256',
            key_version: 1,
            status: 'timed_out',
            issued_at: '2026-04-18T03:00:00Z',
            prepared_at: '2026-04-18T03:00:05Z',
            last_report_at: '2026-04-18T03:00:40Z',
            last_retry_at: null,
            last_rotated_at: null,
            next_retry_at: null,
            report_timeout_ms: 300000,
            max_retries: 2,
            retry_count: 1,
            retry_backoff_ms: 1000,
            signature_ttl_ms: 60000,
            timeout_at: '2026-04-18T03:05:00Z',
            packet_path: `.ring/orchestrator/runner/sessions/${sessionId}/${runId}.json`,
            allowed_worker_ids: ['worker-agent'],
            accepted_protocols: ['ring.workflow-run-report.v1'],
            last_worker_id: 'worker-agent',
            last_protocol: 'ring.workflow-run-report.v1',
            last_error: 'Timed out after semantic progress was already reported.',
          },
          reports: [
            {
              at: '2026-04-18T03:00:40Z',
              status: 'progress',
              actor: 'worker-agent',
              step_id: 'verify',
              note: 'The checkpoint lineage advanced before timeout.',
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
            node_id: nodeId,
            branch_id: 'main',
            active_checkpoint_id: checkpointId,
            checkpoint_ids: [`${checkpointId}-root`, `${checkpointId}-lineage-1`, checkpointId],
            branch_event_ids: [`be-${runId}`],
            capsule_state: createEmptyCapsuleState({
              node_id: nodeId,
              runtime_status: 'recovering',
              current_checkpoint_id: checkpointId,
              replay: {
                status: 'requested',
                requested_at: '2026-04-18T03:00:45Z',
                completed_at: null,
                requested_by: 'session-runner',
                reason: 'workflow_timeout',
                source_checkpoint_id: checkpointId,
                target_checkpoint_id: checkpointId,
                cursor: { phase: 'execute', step_id: 'verify' },
                journal_state: {
                  mode: 'semantic',
                  last_applied_entry_id: `journal-${runId}-1`,
                  pending_entry_ids: [`journal-${runId}-2`],
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
              step_id: 'verify',
              status: 'failed',
              started_at: '2026-04-18T03:00:21Z',
              ended_at: '2026-04-18T03:01:00Z',
              outputs: {},
              notes: 'Timed out after semantic progress.',
            },
          ],
        },
      });
      assert.equal(warmRun.ok, true, JSON.stringify(warmRun.errors));
    };

    await seedWarmLineageWorkflow({
      workflowId: 'wf-shared-refactor-lineage-hold-a',
      workflowName: 'Shared Refactor Warm Lineage Hold A',
      taskType: 'refactoring',
      runId: 'run-shared-refactor-lineage-hold-a',
      taskId: 'task-shared-refactor-lineage-hold-a',
      sessionId: 'session-shared-refactor-lineage-hold-a',
      nodeId: 'n-shared-refactor-lineage-hold-a',
      checkpointId: 'cp-shared-refactor-lineage-hold-a',
      registryScore: 9.97,
    });
    await seedWarmLineageWorkflow({
      workflowId: 'wf-shared-bugfix-lineage-hold-b',
      workflowName: 'Shared Bugfix Warm Lineage Hold B',
      taskType: 'bug-fix',
      runId: 'run-shared-bugfix-lineage-hold-b',
      taskId: 'task-shared-bugfix-lineage-hold-b',
      sessionId: 'session-shared-bugfix-lineage-hold-b',
      nodeId: 'n-shared-bugfix-lineage-hold-b',
      checkpointId: 'cp-shared-bugfix-lineage-hold-b',
      registryScore: 9.98,
    });

    const submitGovernedBundle = ({ title, description, includePath, materialId, inlineData }) =>
      ring.orchestrator.submitDispatchBundle({
        bundle_protocol: 'ring.goal.v1',
        bundle_version: '1',
        artifact_transport: 'inline',
        submitted_by: 'bundle-test',
        payload: {
          goal: {
            title,
            description,
            acceptance_criteria: ['One task is created and routed into a governance-sensitive batch session.'],
          },
          environment: {
            project_id: 'shared-governed-lineage-project',
            repo_root: tempDir,
            target_scope: {
              level: 'file',
              include_paths: [includePath],
              exclude_paths: [],
            },
            constraints: {
              must_build: false,
              must_cleanup: false,
              merge_policy: 'judge_then_merge',
              session_group_key: 'shared-governed-batch',
            },
          },
          materials: [
            {
              material_id: materialId,
              kind: 'preparation_package',
              uri: null,
              format: 'json',
              mount_to: 'workspace/shared',
              required: true,
              inline_data: inlineData,
            },
          ],
          context: {
            artifact_refs: [],
            brief_ref: null,
            requirement_id: requirementId,
            milestone_id: milestoneId,
          },
        },
      });

    const refactorBundle = await submitGovernedBundle({
      title: 'Refactor cleanup after lineage review',
      description: 'Refactor the shared orchestration path after governance review without mixing governed lineages.',
      includePath: 'docs/governed-refactor.md',
      materialId: 'mat-governed-refactor',
      inlineData: '{"refactor":true}',
    });
    const bugfixBundle = await submitGovernedBundle({
      title: 'Regression bug fix after warm lineage timeout',
      description: 'Fix the governed regression without automatically reusing the blocked template.',
      includePath: 'tests/governed-bugfix.test.mjs',
      materialId: 'mat-governed-bugfix',
      inlineData: '{"bugfix":true}',
    });

    assert.equal(refactorBundle.status, 'ready_queued');
    assert.equal(refactorBundle.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.equal(refactorBundle.workflows.waiting_tasks[0].governance_blocked_reuse.length, 1);
    assert.equal(
      refactorBundle.workflows.waiting_tasks[0].governance_blocked_reuse[0].id,
      'wf-shared-refactor-lineage-hold-a',
    );
    assert.match(
      refactorBundle.batching.session_group_key,
      /:governance:warm_semantic_lineage:[a-f0-9]{12}$/,
    );

    assert.equal(bugfixBundle.status, 'ready_queued');
    assert.equal(bugfixBundle.workflows.waiting_tasks[0].workflow_source, 'custom_generated');
    assert.equal(bugfixBundle.workflows.waiting_tasks[0].governance_blocked_reuse.length, 1);
    assert.equal(
      bugfixBundle.workflows.waiting_tasks[0].governance_blocked_reuse[0].id,
      'wf-shared-bugfix-lineage-hold-b',
    );
    assert.match(
      bugfixBundle.batching.session_group_key,
      /:governance:warm_semantic_lineage:[a-f0-9]{12}$/,
    );
    assert.notEqual(
      refactorBundle.batching.session_group_key,
      bugfixBundle.batching.session_group_key,
    );

    await ring.orchestrator.tick();

    const launchedRefactor = await ring.orchestrator.readDispatchBundle(refactorBundle.id);
    const launchedBugfix = await ring.orchestrator.readDispatchBundle(bugfixBundle.id);
    assert.equal(launchedRefactor.status, 'session_launched');
    assert.equal(launchedBugfix.status, 'session_launched');
    assert.ok(launchedRefactor.batching.session_id);
    assert.ok(launchedBugfix.batching.session_id);
    assert.notEqual(launchedRefactor.batching.session_id, launchedBugfix.batching.session_id);

    const launchedSessions = await Promise.all([
      ring.read('session', launchedRefactor.batching.session_id),
      ring.read('session', launchedBugfix.batching.session_id),
    ]);
    assert.match(
      launchedSessions[0].data.governance_context?.batch_signature ?? '',
      /^warm_semantic_lineage:[a-f0-9]{12}$/,
    );
    assert.match(
      launchedSessions[1].data.governance_context?.batch_signature ?? '',
      /^warm_semantic_lineage:[a-f0-9]{12}$/,
    );
    assert.notEqual(
      launchedSessions[0].data.governance_context?.batch_signature,
      launchedSessions[1].data.governance_context?.batch_signature,
    );

    for (const workflowId of new Set([
      'wf-shared-refactor-lineage-hold-a',
      'wf-shared-bugfix-lineage-hold-b',
      ...refactorBundle.workflows.generated_workflow_ids,
      ...bugfixBundle.workflows.generated_workflow_ids,
    ])) {
      const archivedWorkflow = await ring.update('workflow', workflowId, {
        status: 'archived',
      });
      assert.equal(archivedWorkflow.ok, true, JSON.stringify(archivedWorkflow.errors));
    }
  });

  it('normalizes an A2A bundle into the same canonical goal shape as ring.goal', async () => {
    const ringGoalBundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-compare',
      payload: {
        goal: {
          title: 'Canonical Mapping',
          description: 'The canonical bundle should be stable across adapters.',
          acceptance_criteria: ['Mapping is equivalent'],
        },
        environment: {
          project_id: 'bundle-project',
          repo_root: tempDir,
          target_scope: {
            level: 'module',
            include_paths: ['ring/lib'],
            exclude_paths: [],
          },
          constraints: {},
        },
        materials: [
          {
            material_id: 'mat-1',
            kind: 'preparation_package',
            uri: null,
            format: 'json',
            mount_to: 'workspace/canonical',
            required: true,
            inline_data: '{"canonical":true}',
          },
        ],
      },
    });

    const a2aBundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'a2a.task+artifacts',
      bundle_version: '2025.1',
      artifact_transport: 'inline',
      submitted_by: 'bundle-compare',
      payload: {
        task: {
          id: 'goal-canonical',
          title: 'Canonical Mapping',
          description: 'The canonical bundle should be stable across adapters.',
          acceptance_criteria: ['Mapping is equivalent'],
          project_id: 'bundle-project',
          repo_root: tempDir,
          target_scope: {
            level: 'module',
            include_paths: ['ring/lib'],
          },
        },
        artifacts: [
          {
            id: 'artifact-1',
            role: 'material',
            kind: 'brief_blob',
            uri: null,
            format: 'json',
            mount_to: 'workspace/canonical',
            inline_data: '{"canonical":true}',
          },
        ],
        agent_card: {
          id: 'external-planner',
          role: 'planner',
        },
      },
    });

    assert.deepEqual(
      {
        title: a2aBundle.canonical.goal.title,
        description: a2aBundle.canonical.goal.description,
        criteria: a2aBundle.canonical.goal.acceptance_criteria,
        project: a2aBundle.canonical.environment.project_id,
        repo_root: a2aBundle.canonical.environment.repo_root,
        include_paths: a2aBundle.canonical.environment.target_scope.include_paths,
        material_formats: a2aBundle.canonical.materials.map((item) => item.format),
      },
      {
        title: ringGoalBundle.canonical.goal.title,
        description: ringGoalBundle.canonical.goal.description,
        criteria: ringGoalBundle.canonical.goal.acceptance_criteria,
        project: ringGoalBundle.canonical.environment.project_id,
        repo_root: ringGoalBundle.canonical.environment.repo_root,
        include_paths: ringGoalBundle.canonical.environment.target_scope.include_paths,
        material_formats: ringGoalBundle.canonical.materials.map((item) => item.format),
      },
    );
  });

  it('maps MCP resources and prompts into materials and context', async () => {
    const inlineBrief = 'short-inline-brief';
    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'mcp.resource-set',
      bundle_version: '2025-06-18',
      artifact_transport: 'inline',
      submitted_by: 'mcp-test',
      payload: {
        goal: {
          title: 'MCP Mapping',
          description: 'Map resources into materials and prompts into bundle context.',
          acceptance_criteria: ['Resources become materials'],
        },
        environment: {
          project_id: 'mcp-project',
          repo_root: tempDir,
          target_scope: {
            level: 'project',
            include_paths: ['ring'],
            exclude_paths: [],
          },
          constraints: {},
        },
        resources: [
          {
            id: 'res-zip',
            uri: 'resource://prep.zip',
            mimeType: 'application/zip',
            format: 'zip',
            checksum: sha256Checksum(inlineBrief),
            size_bytes: Buffer.byteLength(inlineBrief, 'utf-8'),
            mount_to: 'workspace/mcp',
            inline_data: inlineBrief,
          },
          {
            id: 'res-doc',
            uri: 'resource://design-notes',
            mimeType: 'text/markdown',
            name: 'design-notes',
          },
        ],
        prompts: [
          {
            name: 'bundle-brief',
            content: 'Use the MCP prompt as the planning brief.',
          },
        ],
      },
    });

    assert.equal(bundle.status, 'ready_queued');
    assert.equal(bundle.canonical.materials.length, 1);
    assert.equal(bundle.canonical.context.brief_ref, 'bundle-brief');
    assert.deepEqual(bundle.canonical.context.artifact_refs, ['resource://design-notes']);
    assert.equal(bundle.staging.materials.length, 1);
  });

  it('downloads, verifies, and extracts https materials into the staging mount', async () => {
    const zipBuffer = await createZipFixture(tempDir, 'https-material', {
      'brief.md': '# Remote Material\n\nThis bundle came from HTTPS.\n',
    });
    const materialUrl = registerAsset('/assets/https-material.zip', {
      headers: {
        'content-type': 'application/zip',
      },
      body: zipBuffer,
    });

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'https',
      submitted_by: 'https-staging-test',
      payload: {
        goal: {
          title: 'HTTPS Material Staging',
          description: 'Remote zip materials should be downloaded and extracted.',
          acceptance_criteria: ['Remote materials are mounted'],
        },
        environment: {
          project_id: 'https-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {},
        },
        materials: [
          {
            material_id: 'remote-https',
            kind: 'preparation_package',
            uri: materialUrl,
            format: 'zip',
            checksum: sha256Checksum(zipBuffer),
            size_bytes: zipBuffer.byteLength,
            mount_to: 'workspace/https-prep',
            required: true,
          },
        ],
      },
    });

    const staged = bundle.staging.materials[0];
    assert.equal(staged.status, 'staged');
    assert.equal(staged.transport, 'https');
    assert.equal(staged.checksum_verified, true);
    assert.ok(staged.download_path);
    assert.ok(staged.extracted_path);

    const extracted = await readFile(join(tempDir, staged.extracted_path, 'brief.md'), 'utf-8');
    assert.match(extracted, /HTTPS/);
  });

  it('downloads, verifies, and extracts OCI materials through the distribution api', async () => {
    const zipBuffer = await createZipFixture(tempDir, 'oci-material', {
      'bundle/notes.md': '# OCI Material\n\nPulled from an OCI blob.\n',
    });
    const blobDigest = createHash('sha256').update(zipBuffer).digest('hex');
    const manifest = JSON.stringify({
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.unknown.config.v1+json',
        digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        size: 2,
      },
      layers: [
        {
          mediaType: 'application/zip',
          digest: `sha256:${blobDigest}`,
          size: zipBuffer.byteLength,
        },
      ],
    });

    registerAsset('/v2/example/prep/manifests/latest', {
      headers: {
        'content-type': 'application/vnd.oci.image.manifest.v1+json',
      },
      body: manifest,
    });
    registerAsset(`/v2/example/prep/blobs/${encodeURIComponent(`sha256:${blobDigest}`)}`, {
      headers: {
        'content-type': 'application/zip',
      },
      body: zipBuffer,
    });

    const bundle = await ring.orchestrator.submitDispatchBundle({
      bundle_protocol: 'ring.goal.v1',
      bundle_version: '1',
      artifact_transport: 'oci-distribution@1.1',
      submitted_by: 'oci-staging-test',
      payload: {
        goal: {
          title: 'OCI Material Staging',
          description: 'OCI blobs should be downloaded and extracted.',
          acceptance_criteria: ['OCI materials are mounted'],
        },
        environment: {
          project_id: 'oci-project',
          repo_root: tempDir,
          target_scope: {
            level: 'file',
            include_paths: ['README.md'],
            exclude_paths: [],
          },
          constraints: {},
        },
        materials: [
          {
            material_id: 'remote-oci',
            kind: 'preparation_package',
            uri: `oci+http://127.0.0.1:${new URL(assetOrigin).port}/example/prep:latest`,
            format: 'zip',
            checksum: `sha256:${blobDigest}`,
            size_bytes: zipBuffer.byteLength,
            mount_to: 'workspace/oci-prep',
            required: true,
          },
        ],
      },
    });

    const staged = bundle.staging.materials[0];
    assert.equal(staged.status, 'staged');
    assert.equal(staged.transport, 'oci-distribution@1.1');
    assert.equal(staged.checksum_verified, true);
    assert.ok(staged.manifest_uri);

    const extracted = await readFile(
      join(tempDir, staged.extracted_path, 'bundle', 'notes.md'),
      'utf-8',
    );
    assert.match(extracted, /OCI Material/);
  });

  it('rejects unsupported bundle protocols and missing remote checksums', async () => {
    await assert.rejects(
      () =>
        ring.orchestrator.submitDispatchBundle({
          bundle_protocol: 'cnab-core',
          bundle_version: '1.0',
          artifact_transport: 'https',
          submitted_by: 'bad-protocol',
          payload: {},
        }),
      (error) => {
        assert.equal(error.code, 'unsupported_bundle_protocol');
        assert.equal(error.statusCode, 422);
        return true;
      },
    );

    await assert.rejects(
      () =>
        ring.orchestrator.submitDispatchBundle({
          bundle_protocol: 'ring.goal.v1',
          bundle_version: '1',
          artifact_transport: 'oci-distribution@1.1',
          submitted_by: 'missing-checksum',
          payload: {
            goal: {
              title: 'Checksum Required',
              description: 'Remote transports must include checksums.',
              acceptance_criteria: ['Checksum is enforced'],
            },
            environment: {
              project_id: 'checksum-project',
              repo_root: tempDir,
              target_scope: {
                level: 'file',
                include_paths: ['package.json'],
              },
              constraints: {},
            },
            materials: [
              {
                material_id: 'remote-1',
                kind: 'preparation_package',
                uri: 'oci://registry.example.com/dp-ring/prep:latest',
                format: 'zip',
                size_bytes: 100,
                mount_to: 'workspace/oci',
                required: true,
              },
            ],
          },
        }),
      (error) => {
        assert.equal(error.code, 'missing_material_checksum');
        assert.equal(error.statusCode, 422);
        return true;
      },
    );
  });
});
