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

  await execFileAsync('zip', ['-rq', zipPath, '.'], {
    cwd: sourceDir,
    encoding: 'utf-8',
  });
  const buffer = await readFile(zipPath);
  await rm(sourceDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
  return buffer;
}

describe('orchestrator', async () => {
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
