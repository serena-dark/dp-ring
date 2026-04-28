import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticReusePolicyGovernancePressureScore,
  buildGovernanceSelectionContext,
  buildSessionContextInjected,
  buildSessionDispatchPacketWaitingArea,
  buildSessionDispatchPacketWaitingTaskViews,
  buildSessionDispatchPayloadWaitingTask,
  buildSessionGovernanceContext,
  buildWaitingTaskRecord,
  buildWorkflowPreparationPayloadWaitingTask,
  checkpointAutomaticReuseSelectionPolicy,
  checkpointAutomaticReusePolicyState,
  checkpointBranchMetricsState,
  checkpointEffectiveForceState,
  canonicalizeWaitingTaskGovernanceBlockedReuse,
  canonicalizeWaitingTaskGovernanceLabels,
  checkpointGovernancePressureState,
  compareAutomaticReusePolicies,
  describeAutomaticReusePolicy,
  describeGovernanceSelectionContext,
  describeSessionDispatchPayloadWaitingTask,
  describeWaitingTaskGovernance,
  describeWaitingTaskReplanningHandoff,
  describeWorkflowPreparationPayloadWaitingTask,
  describeWorkflowPreparationScaffoldTask,
  describeWorkflowReuseGovernanceBlock,
  describeWorkflowReuseGovernanceBlockList,
  describeWorkflowReuseGovernanceReenableGuidance,
  describeWorkflowReuseGovernanceReenableGuidanceList,
  hydrateWaitingTaskGovernanceLabels,
  mergeSessionDispatchPayloadWaitingTask,
  normalizeWorkflowReuseGovernanceBlock,
  refreshSessionDispatchWaitingTasks,
  sessionGovernanceSelectionContexts,
  waitingTaskGovernanceBlockedReuse,
  warmSemanticLineageState,
  workflowReuseGovernanceBlock,
  workflowRunRequiresExplicitWorkflowReuse,
} from '../../ring/lib/governance-policy.mjs';
import {
  continueFromCheckpoint,
  createCheckpoint,
  forkCheckpoint,
  synthesizeCheckpoint,
} from '../../ring/lib/checkpoint-tree.mjs';

function buildWorkflowRun() {
  return {
    status: 'failed',
    data: {
      reports: [
        { status: 'progress' },
      ],
      node_execution: {
        checkpoint_ids: ['cp-root', 'cp-progress', 'cp-timeout'],
        capsule_state: {
          replay: {
            status: 'requested',
          },
        },
      },
    },
  };
}

function buildCheckpoint() {
  return {
    id: 'cp-mainline-policy',
    data: {
      adoption_status: 'mainline',
      policy_snapshot: {
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
        branch_budget: 1,
        notes: 'Tight oversight for the next reuse.',
      },
    },
  };
}

function buildCheckpointGraph() {
  const root = createCheckpoint({
    id: 'cp-root',
    created_by: 'test-agent',
    branch_id: 'main',
    node_id: 'node-governance',
    scope_ref: { kind: 'task', id: 'task-governance', path: 'tasks/task-governance.md' },
  });
  const left = forkCheckpoint(root, {
    id: 'cp-left',
    created_by: 'agent-left',
    branch_id: ' left ',
  });
  const leftContinued = continueFromCheckpoint(left, {
    id: 'cp-left-continued',
    created_by: 'agent-left',
  });
  const right = forkCheckpoint(root, {
    id: 'cp-right',
    created_by: 'agent-right',
    branch_id: 'right',
  });
  const synthesized = synthesizeCheckpoint([leftContinued, right], {
    id: ' cp-synth ',
    created_by: 'judge-agent',
    branch_id: ' main.synth ',
    synthesis_inputs: [' cp-left-continued ', 'cp-right', 'cp-right'],
  });

  return {
    root,
    left,
    leftContinued,
    right,
    synthesized,
    checkpoints: [root, left, leftContinued, right, synthesized],
  };
}

describe('governance policy', () => {
  it('recognizes warm semantic lineage from canonical workflow-run state', () => {
    const workflowRun = buildWorkflowRun();

    assert.deepEqual(warmSemanticLineageState(workflowRun), {
      checkpointCount: 3,
      replayStatus: 'requested',
      sawProgressReport: true,
      hasWarmSemanticLineage: true,
    });
  });

  it('normalizes replay and progress status strings before evaluating lineage', () => {
    const workflowRun = buildWorkflowRun();
    workflowRun.data.reports[0].status = ' progress ';
    workflowRun.data.node_execution.capsule_state.replay.status = ' requested ';

    assert.equal(warmSemanticLineageState(workflowRun).hasWarmSemanticLineage, true);
  });

  it('does not mark cold or incomplete lineage as warm semantic lineage', () => {
    const workflowRun = buildWorkflowRun();
    workflowRun.data.node_execution.checkpoint_ids = ['cp-root', 'cp-progress'];

    assert.deepEqual(warmSemanticLineageState(workflowRun), {
      checkpointCount: 2,
      replayStatus: 'requested',
      sawProgressReport: true,
      hasWarmSemanticLineage: false,
    });

    workflowRun.data.node_execution.checkpoint_ids = ['cp-root', 'cp-progress', 'cp-timeout'];
    workflowRun.data.node_execution.capsule_state.replay.status = 'idle';
    assert.equal(warmSemanticLineageState(workflowRun).hasWarmSemanticLineage, false);
  });

  it('derives divergence from normalized branch ancestry before any synthesis occurs', () => {
    const { leftContinued, checkpoints } = buildCheckpointGraph();

    assert.deepEqual(checkpointBranchMetricsState(leftContinued, checkpoints), {
      checkpointId: 'cp-left-continued',
      branchId: 'left',
      parentCheckpointId: 'cp-left',
      lineageDepth: 3,
      lineageCheckpointIds: ['cp-root', 'cp-left', 'cp-left-continued'],
      distinctLineageBranchIds: ['main', 'left'],
      synthesisInputCount: 0,
      synthesisInputIds: [],
      synthesisInputBranchIds: [],
      sharedSynthesisLineageDepth: 0,
      divergenceScore: 1,
      composabilityScore: 0,
    });
  });

  it('derives divergence and composability from synthesized checkpoint lineage fan-in', () => {
    const { synthesized, checkpoints } = buildCheckpointGraph();

    assert.deepEqual(checkpointBranchMetricsState(synthesized, checkpoints), {
      checkpointId: 'cp-synth',
      branchId: 'main.synth',
      parentCheckpointId: 'cp-left-continued',
      lineageDepth: 4,
      lineageCheckpointIds: ['cp-root', 'cp-left', 'cp-left-continued', 'cp-synth'],
      distinctLineageBranchIds: ['main', 'left', 'main.synth'],
      synthesisInputCount: 2,
      synthesisInputIds: ['cp-left-continued', 'cp-right'],
      synthesisInputBranchIds: ['left', 'right'],
      sharedSynthesisLineageDepth: 1,
      divergenceScore: 3,
      composabilityScore: 2,
    });
  });

  it('normalizes checkpoint ids when branch metrics receive a map keyed by padded ids', () => {
    const { root, left, leftContinued, right, synthesized } = buildCheckpointGraph();
    const byId = new Map([
      [' cp-root ', root],
      [' cp-left ', left],
      [' cp-left-continued ', leftContinued],
      [' cp-right ', right],
      [' cp-synth ', synthesized],
    ]);

    assert.deepEqual(checkpointBranchMetricsState(synthesized, byId), {
      checkpointId: 'cp-synth',
      branchId: 'main.synth',
      parentCheckpointId: 'cp-left-continued',
      lineageDepth: 4,
      lineageCheckpointIds: ['cp-root', 'cp-left', 'cp-left-continued', 'cp-synth'],
      distinctLineageBranchIds: ['main', 'left', 'main.synth'],
      synthesisInputCount: 2,
      synthesisInputIds: ['cp-left-continued', 'cp-right'],
      synthesisInputBranchIds: ['left', 'right'],
      sharedSynthesisLineageDepth: 1,
      divergenceScore: 3,
      composabilityScore: 2,
    });
  });

  it('normalizes adopted mainline checkpoint policy for automatic reuse decisions', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.id = ' cp-mainline-policy ';
    checkpoint.data.adoption_status = ' mainline ';
    checkpoint.data.policy_snapshot.workflow_tightness = ' tight ';
    checkpoint.data.policy_snapshot.oversight_strength = ' strong ';
    checkpoint.data.policy_snapshot.notes = ' Tight oversight for the next reuse. ';

    assert.deepEqual(checkpointAutomaticReusePolicyState(checkpoint), {
      checkpointId: 'cp-mainline-policy',
      adoptionStatus: 'mainline',
      workflowTightness: 'tight',
      oversightStrength: 'strong',
      branchBudget: 1,
      notes: 'Tight oversight for the next reuse.',
      constrained: true,
    });
  });

  it('keeps non-mainline checkpoint lineage unconstrained while preserving normalized governance fields', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.id = ' cp-synth-policy ';
    checkpoint.data.adoption_status = ' synthesized ';
    checkpoint.data.policy_snapshot.workflow_tightness = ' balanced ';
    checkpoint.data.policy_snapshot.oversight_strength = ' normal ';
    checkpoint.data.policy_snapshot.branch_budget = 0;
    checkpoint.data.policy_snapshot.notes = ' waiting for adoption ';

    assert.deepEqual(checkpointAutomaticReusePolicyState(checkpoint), {
      checkpointId: 'cp-synth-policy',
      adoptionStatus: 'synthesized',
      workflowTightness: 'balanced',
      oversightStrength: 'normal',
      branchBudget: 0,
      notes: 'waiting for adoption',
      constrained: false,
    });
  });

  it('drops invalid branch budgets while preserving default automatic reuse policy levels', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.data.policy_snapshot.branch_budget = 1.5;
    checkpoint.data.policy_snapshot.workflow_tightness = ' ';
    checkpoint.data.policy_snapshot.oversight_strength = null;
    checkpoint.data.policy_snapshot.notes = '   ';

    assert.deepEqual(checkpointAutomaticReusePolicyState(checkpoint), {
      checkpointId: 'cp-mainline-policy',
      adoptionStatus: 'mainline',
      workflowTightness: 'balanced',
      oversightStrength: 'normal',
      branchBudget: null,
      notes: null,
      constrained: false,
    });
  });

  it('normalizes workflow reuse governance blocks from recommendation candidates', () => {
    assert.deepEqual(normalizeWorkflowReuseGovernanceBlock({
      id: ' wf-governed-template ',
      name: ' Governed Template ',
      reason: ' checkpoint_branch_budget_exhausted ',
      checkpoint_id: ' cp-governed ',
      adoption_status: ' mainline ',
      branch_budget: 0,
      workflow_tightness: ' tight ',
      oversight_strength: ' strong ',
    }), {
      id: 'wf-governed-template',
      name: 'Governed Template',
      reason: 'checkpoint_branch_budget_exhausted',
      checkpoint_id: 'cp-governed',
      adoption_status: 'mainline',
      branch_budget: 0,
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
    });
  });

  it('normalizes workflow reuse governance blocks from persisted waiting-task/session shapes', () => {
    assert.deepEqual(normalizeWorkflowReuseGovernanceBlock({
      workflow_template_id: ' wf-synth-template ',
      workflow_name: ' Synth Template ',
      reason: ' checkpoint_synthesized ',
      checkpoint_id: ' cp-synth ',
      adoption_status: ' synthesized ',
      branch_budget: 1.5,
      workflow_tightness: ' balanced ',
      oversight_strength: ' normal ',
    }), {
      id: 'wf-synth-template',
      name: 'Synth Template',
      reason: 'checkpoint_synthesized',
      checkpoint_id: 'cp-synth',
      adoption_status: 'synthesized',
      branch_budget: null,
      workflow_tightness: 'balanced',
      oversight_strength: 'normal',
    });
  });

  it('describes workflow reuse governance blocks and re-enable guidance with stable text', () => {
    const warmBlocked = normalizeWorkflowReuseGovernanceBlock({
      id: ' wf-warm-template ',
      name: ' Warm Template ',
      reason: ' warm_semantic_lineage ',
      checkpoint_id: ' cp-warm ',
      adoption_status: ' mainline ',
    });
    const budgetBlocked = normalizeWorkflowReuseGovernanceBlock({
      id: ' wf-governed-template ',
      name: ' Governed Template ',
      reason: ' checkpoint_branch_budget_exhausted ',
      checkpoint_id: ' cp-governed ',
      adoption_status: ' mainline ',
      branch_budget: 0,
      workflow_tightness: ' tight ',
      oversight_strength: ' strong ',
    });
    const synthesizedBlocked = normalizeWorkflowReuseGovernanceBlock({
      workflow_template_id: ' wf-synth-template ',
      workflow_name: ' Synth Template ',
      reason: ' checkpoint_synthesized ',
      checkpoint_id: ' cp-synth ',
      adoption_status: ' synthesized ',
    });

    assert.equal(
      describeWorkflowReuseGovernanceBlock(warmBlocked),
      'wf-warm-template (Warm Template) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse',
    );
    assert.equal(
      describeWorkflowReuseGovernanceBlock(budgetBlocked),
      'wf-governed-template (Governed Template) last exhausted branch_budget=0 at active checkpoint cp-governed under tight workflow_tightness / strong oversight, so automatic reuse stays blocked until a later run clears that constraint',
    );
    assert.equal(
      describeWorkflowReuseGovernanceBlockList([warmBlocked, budgetBlocked]),
      'wf-warm-template (Warm Template) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse; wf-governed-template (Governed Template) last exhausted branch_budget=0 at active checkpoint cp-governed under tight workflow_tightness / strong oversight, so automatic reuse stays blocked until a later run clears that constraint',
    );
    assert.equal(
      describeWorkflowReuseGovernanceReenableGuidance(synthesizedBlocked),
      'wf-synth-template (Synth Template) should stay off automatic reuse until active checkpoint cp-synth is explicitly adopted into mainline.',
    );
    assert.equal(
      describeWorkflowReuseGovernanceReenableGuidanceList([warmBlocked, budgetBlocked]),
      'wf-warm-template (Warm Template) should stay off automatic reuse until governance records an explicit reuse decision for its warm semantic lineage.; wf-governed-template (Governed Template) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-governed.',
    );
    assert.equal(describeWorkflowReuseGovernanceBlock(null), 'automatic reuse is governance-blocked');
    assert.equal(describeWorkflowReuseGovernanceReenableGuidanceList([]), 'none');
  });

  it('derives workflow reuse governance blocks from warm lineage, exhausted branch budget, and non-mainline checkpoints', () => {
    const warmRun = buildWorkflowRun();
    warmRun.data.node_execution.active_checkpoint_id = ' cp-timeout ';
    const warmCheckpoint = buildCheckpoint();
    warmCheckpoint.id = ' cp-timeout ';
    warmCheckpoint.data.adoption_status = ' mainline ';
    warmCheckpoint.data.policy_snapshot.branch_budget = 0;

    assert.deepEqual(workflowReuseGovernanceBlock(warmRun, warmCheckpoint), {
      reason: 'warm_semantic_lineage',
      checkpoint_id: 'cp-timeout',
      adoption_status: 'mainline',
    });

    const budgetRun = {
      status: 'completed',
      data: {
        node_execution: {
          active_checkpoint_id: ' cp-budget ',
        },
      },
    };
    const budgetCheckpoint = buildCheckpoint();
    budgetCheckpoint.id = ' cp-budget ';
    budgetCheckpoint.data.adoption_status = ' mainline ';
    budgetCheckpoint.data.policy_snapshot.branch_budget = 0;
    budgetCheckpoint.data.policy_snapshot.workflow_tightness = ' tight ';
    budgetCheckpoint.data.policy_snapshot.oversight_strength = ' strong ';

    assert.deepEqual(workflowReuseGovernanceBlock(budgetRun, budgetCheckpoint), {
      reason: 'checkpoint_branch_budget_exhausted',
      checkpoint_id: 'cp-budget',
      adoption_status: 'mainline',
      branch_budget: 0,
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
    });

    const synthesizedRun = {
      status: 'completed',
      data: {
        node_execution: {
          active_checkpoint_id: ' cp-synth ',
        },
      },
    };
    const synthesizedCheckpoint = buildCheckpoint();
    synthesizedCheckpoint.id = ' cp-synth ';
    synthesizedCheckpoint.data.adoption_status = ' synthesized ';
    synthesizedCheckpoint.data.policy_snapshot.branch_budget = null;
    synthesizedCheckpoint.data.policy_snapshot.workflow_tightness = ' balanced ';
    synthesizedCheckpoint.data.policy_snapshot.oversight_strength = ' normal ';

    assert.deepEqual(workflowReuseGovernanceBlock(synthesizedRun, synthesizedCheckpoint), {
      reason: 'checkpoint_synthesized',
      checkpoint_id: 'cp-synth',
      adoption_status: 'synthesized',
    });
  });

  it('computes governance pressure from normalized checkpoint policy carryover', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.id = ' cp-governance-pressure ';
    checkpoint.data.adoption_status = ' mainline ';
    checkpoint.data.policy_snapshot.workflow_tightness = ' tight ';
    checkpoint.data.policy_snapshot.oversight_strength = ' strong ';
    checkpoint.data.policy_snapshot.branch_budget = 1;
    checkpoint.data.policy_snapshot.notes = ' Tight governance carryover. ';

    assert.deepEqual(checkpointGovernancePressureState(checkpoint), {
      checkpointId: 'cp-governance-pressure',
      adoptionStatus: 'mainline',
      workflowTightness: 'tight',
      oversightStrength: 'strong',
      branchBudget: 1,
      notes: 'Tight governance carryover.',
      constrained: true,
      workflowTightnessLevel: 2,
      oversightStrengthLevel: 2,
      branchBudgetPressure: 8,
      governancePressureScore: 1228,
    });
  });

  it('keeps unconstrained mainline checkpoints at zero governance pressure', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.data.policy_snapshot.workflow_tightness = 'balanced';
    checkpoint.data.policy_snapshot.oversight_strength = 'normal';
    checkpoint.data.policy_snapshot.branch_budget = null;
    checkpoint.data.policy_snapshot.notes = null;

    assert.deepEqual(checkpointGovernancePressureState(checkpoint), {
      checkpointId: 'cp-mainline-policy',
      adoptionStatus: 'mainline',
      workflowTightness: 'balanced',
      oversightStrength: 'normal',
      branchBudget: null,
      notes: null,
      constrained: false,
      workflowTightnessLevel: 1,
      oversightStrengthLevel: 1,
      branchBudgetPressure: 0,
      governancePressureScore: 0,
    });
  });

  it('derives automatic reuse selection policy metadata from checkpoint governance pressure state', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.id = ' cp-selection-policy ';
    checkpoint.data.adoption_status = ' mainline ';
    checkpoint.data.policy_snapshot.workflow_tightness = ' tight ';
    checkpoint.data.policy_snapshot.oversight_strength = ' strong ';
    checkpoint.data.policy_snapshot.branch_budget = 1;

    assert.deepEqual(checkpointAutomaticReuseSelectionPolicy(checkpoint), {
      constrained: true,
      adoption_status: 'mainline',
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 1,
      governance_pressure_score: 1228,
    });
  });

  it('compares automatic reuse policies by unconstrained status, governance pressure, and remaining branch budget', () => {
    const unconstrained = {
      constrained: false,
      adoption_status: 'mainline',
      workflow_tightness: null,
      oversight_strength: null,
      branch_budget: null,
      governance_pressure_score: 0,
    };
    const constrained = {
      constrained: true,
      adoption_status: 'mainline',
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 1,
      governance_pressure_score: 1228,
    };
    const roomierConstraint = {
      constrained: true,
      adoption_status: 'mainline',
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 3,
      governance_pressure_score: 1200,
    };
    const tighterConstraint = {
      constrained: true,
      adoption_status: 'mainline',
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 0,
      governance_pressure_score: 1200,
    };

    assert.equal(compareAutomaticReusePolicies(unconstrained, constrained) < 0, true);
    assert.equal(compareAutomaticReusePolicies(constrained, unconstrained) > 0, true);
    assert.equal(compareAutomaticReusePolicies(roomierConstraint, tighterConstraint) < 0, true);
    assert.equal(compareAutomaticReusePolicies(tighterConstraint, roomierConstraint) > 0, true);
  });

  it('describes automatic reuse policies with stable governed carryover labels', () => {
    assert.equal(describeAutomaticReusePolicy({ constrained: false }), 'no active inherited checkpoint policy');
    assert.equal(describeAutomaticReusePolicy({
      constrained: true,
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 0,
    }), 'tight workflow_tightness, strong oversight, branch_budget=0');
    assert.equal(
      automaticReusePolicyGovernancePressureScore({ constrained: true, governance_pressure_score: 1228 }),
      1228,
    );
  });

  it('builds governance selection context from workflow/policy comparison state', () => {
    assert.deepEqual(
      buildGovernanceSelectionContext(
        ' governance_minimize_policy_carryover ',
        { id: ' wf-roomier-template ', data: { name: ' Roomier Template ' } },
        {
          constrained: true,
          workflow_tightness: 'balanced',
          oversight_strength: 'normal',
          branch_budget: 3,
          governance_pressure_score: 1206,
        },
        14,
        { id: 'wf-tight-template', data: { name: 'Tight Template' } },
        {
          constrained: true,
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
          branch_budget: 1,
          governance_pressure_score: 1228,
        },
        Number.NaN,
      ),
      {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    );
  });

  it('builds normalized waiting-task records with shared governance metadata', () => {
    assert.deepEqual(buildWaitingTaskRecord({
      task_id: ' task-docs ',
      task_name: ' Documentation ',
      task_type: ' documentation ',
      milestone_id: ' ms-alpha ',
      task_document_path: ' docs/tasks/task-docs/task-docs.md ',
      task_document_ready: true,
      prerequisites_ready: true,
      workflow_ready: true,
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template ',
      workflow_source: ' custom_generated ',
      registry_rank: 7,
      registry_mode: ' governance_prefer_effective_force ',
      selection_note: ' prefer the stronger checkpoint lineage ',
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: Number.NaN,
        },
      },
      governance_blocked_reuse: [
        {
          id: ' wf-blocked-template ',
          name: ' Blocked Template ',
          reason: ' warm_semantic_lineage ',
          checkpoint_id: ' cp-blocked ',
          adoption_status: ' synthesized ',
          branch_budget: 0,
          workflow_tightness: ' tight ',
          oversight_strength: ' strong ',
        },
      ],
      canonical_workflow_name_overrides: {
        ' wf-blocked-template ': ' Blocked Template Canonical ',
      },
      canonical_selection_context_workflow_names: {
        ' wf-tight-template ': ' Tight Template Canonical ',
      },
      ready_at: ' 2026-04-27T13:03:25Z ',
      dispatched_at: ' ',
    }), {
      task_id: 'task-docs',
      task_name: 'Documentation',
      task_type: 'documentation',
      milestone_id: 'ms-alpha',
      task_document_path: 'docs/tasks/task-docs/task-docs.md',
      task_document_ready: true,
      prerequisites_ready: true,
      workflow_ready: true,
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template',
      workflow_source: 'custom_generated',
      registry_rank: 7,
      registry_mode: 'governance_prefer_effective_force',
      selection_note: 'prefer the stronger checkpoint lineage',
      governance_selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template Canonical',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
      governance_blocked_reuse: [{
        id: 'wf-blocked-template',
        name: 'Blocked Template Canonical',
        reason: 'warm_semantic_lineage',
        checkpoint_id: 'cp-blocked',
        adoption_status: 'synthesized',
        branch_budget: 0,
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
      }],
      governance_reenable_guidance: 'wf-blocked-template (Blocked Template Canonical) should stay off automatic reuse until governance records an explicit reuse decision for its warm semantic lineage.',
      canonical_workflow_name_overrides: {
        'wf-blocked-template': 'Blocked Template Canonical',
      },
      canonical_selection_context_workflow_names: {
        'wf-tight-template': 'Tight Template Canonical',
      },
      ready_at: '2026-04-27T13:03:25Z',
      dispatched_at: null,
    });
  });

  it('builds normalized session governance selection context injection from waiting-task state', () => {
    const readyTasks = [
      {
        task_id: ' task-docs ',
        task_name: ' Documentation ',
        parent_task_id: ' t-parent-docs ',
        parent_decision_note: ' Narrow the retry to the publication-only files. ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template ',
        governance_selection_context: {
          basis: ' governance_minimize_policy_carryover ',
          preferred: {
            workflow_id: ' wf-roomier-template ',
            workflow_name: ' Roomier Template ',
            policy: ' branch_budget=3 ',
            governance_pressure_score: 1206,
            effective_force_score: 14,
          },
          compared: {
            workflow_id: ' wf-tight-template ',
            workflow_name: ' Tight Template ',
            policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
            governance_pressure_score: 1228,
            effective_force_score: Number.NaN,
          },
        },
      },
      {
        task_id: 'task-review',
        task_name: 'Review docs',
        workflow_template_id: 'wf-another-template',
        workflow_name: 'Another Template',
        governance_selection_context: null,
      },
      {
        task_id: ' ',
        workflow_template_id: 'wf-missing-task',
        governance_selection_context: {
          basis: 'governance_prefer_effective_force',
          preferred: {
            workflow_id: 'wf-missing-task',
            workflow_name: 'Missing Task Template',
            policy: 'branch_budget=0',
            governance_pressure_score: 1300,
            effective_force_score: 8,
          },
          compared: {
            workflow_id: 'wf-other',
            workflow_name: 'Other Template',
            policy: 'branch_budget=1',
            governance_pressure_score: 1200,
            effective_force_score: 6,
          },
        },
      },
    ];

    const expectedSelectionContexts = [{
      task_id: 'task-docs',
      task_name: 'Documentation',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template',
      selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    }];

    assert.deepEqual(sessionGovernanceSelectionContexts(readyTasks), expectedSelectionContexts);
    assert.deepEqual(buildSessionContextInjected(readyTasks), {
      workflow_template: null,
      distillations_applied: [],
      registry_rank_at_selection: null,
      governance_selection_contexts: expectedSelectionContexts,
      replanning_handoffs: [{
        task_id: 'task-docs',
        task_name: 'Documentation',
        parent_task_id: 't-parent-docs',
        parent_decision_note: 'Narrow the retry to the publication-only files.',
      }],
    });
  });

  it('builds session-dispatch payload waiting-task records from shared governance state and fallback replanning handoffs', () => {
    assert.deepEqual(
      buildSessionDispatchPayloadWaitingTask(
        {
          task_id: ' task-docs ',
          task_name: ' Governed docs delivery ',
          task_type: ' documentation ',
          milestone_id: ' ms-governance ',
          task_document_path: ' docs/tasks/task-docs/task-docs.md ',
          workflow_template_id: ' wf-selected ',
          workflow_name: ' Selected Workflow ',
          governance_selection_context: {
            basis: ' governance_prefer_effective_force ',
            preferred: {
              workflow_id: ' wf-selected ',
              workflow_name: ' Selected Workflow ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 19,
            },
            compared: {
              workflow_id: ' wf-compared ',
              workflow_name: ' Compared Workflow ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 13,
            },
          },
          governance_blocked_reuse: [],
          canonical_workflow_name_overrides: {
            ' wf-selected ': ' Selected Workflow Canonical ',
            ' wf-compared ': ' Compared Workflow Canonical ',
            ' wf-budget-hold ': ' Branch Budget Template Canonical ',
          },
        },
        {
          replanning_handoff: {
            parent_task_id: ' t-parent-governed-docs ',
            parent_decision_note: ' Retry only the governed documentation path before another launch. ',
          },
          governance_blocked_reuse: [
            {
              id: ' wf-budget-hold ',
              name: ' Branch Budget Template ',
              reason: ' checkpoint_branch_budget_exhausted ',
              checkpoint_id: ' cp-budget-hold ',
              adoption_status: ' mainline ',
              branch_budget: 0,
              workflow_tightness: ' tight ',
              oversight_strength: ' strong ',
            },
          ],
          canonical_governance_blocked_reuse_workflow_names: {
            ' wf-budget-hold ': ' Branch Budget Template Canonical ',
          },
        },
      ),
      {
        task_id: 'task-docs',
        task_name: 'Governed docs delivery',
        task_type: 'documentation',
        milestone_id: 'ms-governance',
        task_document_path: 'docs/tasks/task-docs/task-docs.md',
        workflow_template_id: 'wf-selected',
        workflow_name: 'Selected Workflow Canonical',
        replanning_handoff: {
          parent_task_id: 't-parent-governed-docs',
          parent_decision_note: 'Retry only the governed documentation path before another launch.',
        },
        governance_selection_context: {
          basis: 'governance_prefer_effective_force',
          preferred: {
            workflow_id: 'wf-selected',
            workflow_name: 'Selected Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: 'wf-compared',
            workflow_name: 'Compared Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [{
          id: 'wf-budget-hold',
          name: 'Branch Budget Template Canonical',
          reason: 'checkpoint_branch_budget_exhausted',
          checkpoint_id: 'cp-budget-hold',
          adoption_status: 'mainline',
          branch_budget: 0,
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
        }],
        governance_reenable_guidance:
          'wf-budget-hold (Branch Budget Template Canonical) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
      },
    );
  });

  it('merges session-dispatch payload waiting-task state back into stored waiting-task records', () => {
    const payloadTask = buildSessionDispatchPayloadWaitingTask(
      {
        task_id: ' task-docs ',
        task_name: ' Governed docs delivery ',
        task_type: ' documentation ',
        milestone_id: ' ms-governance ',
        task_document_path: ' docs/tasks/task-docs/task-docs.md ',
        workflow_template_id: ' wf-selected ',
        workflow_name: ' Selected Workflow ',
        governance_selection_context: {
          basis: ' governance_prefer_effective_force ',
          preferred: {
            workflow_id: ' wf-selected ',
            workflow_name: ' Selected Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: ' wf-compared ',
            workflow_name: ' Compared Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [],
        canonical_workflow_name_overrides: {
          ' wf-selected ': ' Selected Workflow Canonical ',
          ' wf-compared ': ' Compared Workflow Canonical ',
          ' wf-budget-hold ': ' Branch Budget Template Canonical ',
        },
      },
      {
        replanning_handoff: {
          parent_task_id: ' t-parent-governed-docs ',
          parent_decision_note: ' Retry only the governed documentation path before another launch. ',
        },
        governance_blocked_reuse: [
          {
            id: ' wf-budget-hold ',
            name: ' Branch Budget Template ',
            reason: ' checkpoint_branch_budget_exhausted ',
            checkpoint_id: ' cp-budget-hold ',
            adoption_status: ' mainline ',
            branch_budget: 0,
            workflow_tightness: ' tight ',
            oversight_strength: ' strong ',
          },
        ],
        canonical_governance_blocked_reuse_workflow_names: {
          ' wf-budget-hold ': ' Branch Budget Template Canonical ',
        },
      },
    );

    assert.deepEqual(
      mergeSessionDispatchPayloadWaitingTask(
        {
          task_id: ' task-docs ',
          task_name: ' Governed docs delivery (stale) ',
          task_type: ' documentation ',
          milestone_id: ' ms-governance ',
          task_document_path: ' docs/tasks/task-docs/task-docs.md ',
          workflow_template_id: ' wf-selected ',
          workflow_name: ' Selected Workflow Legacy ',
          governance_selection_context: null,
          governance_blocked_reuse: [],
          governance_reenable_guidance: 'none',
          task_document_ready: true,
          prerequisites_ready: true,
          workflow_ready: true,
          ready_at: '2026-04-28T01:17:31Z',
          dispatched_at: null,
        },
        payloadTask,
      ),
      {
        task_id: ' task-docs ',
        task_name: 'Governed docs delivery',
        task_type: 'documentation',
        milestone_id: 'ms-governance',
        task_document_path: 'docs/tasks/task-docs/task-docs.md',
        workflow_template_id: 'wf-selected',
        workflow_name: 'Selected Workflow Canonical',
        governance_selection_context: {
          basis: 'governance_prefer_effective_force',
          preferred: {
            workflow_id: 'wf-selected',
            workflow_name: 'Selected Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: 'wf-compared',
            workflow_name: 'Compared Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [{
          id: 'wf-budget-hold',
          name: 'Branch Budget Template Canonical',
          reason: 'checkpoint_branch_budget_exhausted',
          checkpoint_id: 'cp-budget-hold',
          adoption_status: 'mainline',
          branch_budget: 0,
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
        }],
        governance_reenable_guidance:
          'wf-budget-hold (Branch Budget Template Canonical) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
        replanning_handoff: {
          parent_task_id: 't-parent-governed-docs',
          parent_decision_note: 'Retry only the governed documentation path before another launch.',
        },
        task_document_ready: true,
        prerequisites_ready: true,
        workflow_ready: true,
        ready_at: '2026-04-28T01:17:31Z',
        dispatched_at: null,
      },
    );
  });

  it('refreshes stored waiting-task records from session-dispatch packet payloads and ready-task updates', () => {
    const payloadTask = buildSessionDispatchPayloadWaitingTask(
      {
        task_id: ' task-docs ',
        task_name: ' Governed docs delivery ',
        task_type: ' documentation ',
        milestone_id: ' ms-governance ',
        task_document_path: ' docs/tasks/task-docs/task-docs.md ',
        workflow_template_id: ' wf-selected ',
        workflow_name: ' Selected Workflow ',
        governance_selection_context: {
          basis: ' governance_prefer_effective_force ',
          preferred: {
            workflow_id: ' wf-selected ',
            workflow_name: ' Selected Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: ' wf-compared ',
            workflow_name: ' Compared Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [],
        canonical_workflow_name_overrides: {
          ' wf-selected ': ' Selected Workflow Canonical ',
          ' wf-compared ': ' Compared Workflow Canonical ',
          ' wf-budget-hold ': ' Branch Budget Template Canonical ',
        },
      },
      {
        replanning_handoff: {
          parent_task_id: ' t-parent-governed-docs ',
          parent_decision_note: ' Retry only the governed documentation path before another launch. ',
        },
        governance_blocked_reuse: [
          {
            id: ' wf-budget-hold ',
            name: ' Branch Budget Template ',
            reason: ' checkpoint_branch_budget_exhausted ',
            checkpoint_id: ' cp-budget-hold ',
            adoption_status: ' mainline ',
            branch_budget: 0,
            workflow_tightness: ' tight ',
            oversight_strength: ' strong ',
          },
        ],
        canonical_governance_blocked_reuse_workflow_names: {
          ' wf-budget-hold ': ' Branch Budget Template Canonical ',
        },
      },
    );

    assert.deepEqual(
      refreshSessionDispatchWaitingTasks(
        [
          {
            task_id: ' task-docs ',
            task_name: ' Governed docs delivery (stale) ',
            task_type: ' documentation ',
            milestone_id: ' ms-governance ',
            task_document_path: ' docs/tasks/task-docs/task-docs.md ',
            workflow_template_id: ' wf-selected ',
            workflow_name: ' Selected Workflow Legacy ',
            governance_selection_context: null,
            governance_blocked_reuse: [],
            governance_reenable_guidance: 'none',
            task_document_ready: false,
            prerequisites_ready: false,
            workflow_ready: false,
            ready_at: '2026-04-28T01:17:31Z',
            dispatched_at: null,
          },
          {
            task_id: 'task-untouched',
            task_name: 'Untouched task',
            workflow_template_id: 'wf-untouched',
            workflow_name: 'Untouched Workflow',
            task_document_ready: true,
            prerequisites_ready: true,
            workflow_ready: true,
            ready_at: '2026-04-28T01:18:00Z',
            dispatched_at: null,
          },
        ],
        {
          payload: {
            waiting_tasks: [payloadTask],
          },
        },
        {
          refreshedWaitingTasks: [
            {
              task_id: 'task-docs',
              task_name: 'Governed docs delivery',
              task_type: 'documentation',
              milestone_id: 'ms-governance',
              task_document_path: 'docs/tasks/task-docs/task-docs.md',
              workflow_template_id: 'wf-selected',
              workflow_name: 'Selected Workflow Canonical',
              task_document_ready: true,
              prerequisites_ready: true,
              workflow_ready: true,
              ready_at: '2026-04-28T01:20:00Z',
            },
          ],
          dispatchedAt: '2026-04-28T01:21:00Z',
        },
      ),
      [
        {
          task_id: 'task-docs',
          task_name: 'Governed docs delivery',
          task_type: 'documentation',
          milestone_id: 'ms-governance',
          task_document_path: 'docs/tasks/task-docs/task-docs.md',
          workflow_template_id: 'wf-selected',
          workflow_name: 'Selected Workflow Canonical',
          governance_selection_context: {
            basis: 'governance_prefer_effective_force',
            preferred: {
              workflow_id: 'wf-selected',
              workflow_name: 'Selected Workflow Canonical',
              policy: 'branch_budget=1',
              governance_pressure_score: 1220,
              effective_force_score: 19,
            },
            compared: {
              workflow_id: 'wf-compared',
              workflow_name: 'Compared Workflow Canonical',
              policy: 'branch_budget=1',
              governance_pressure_score: 1220,
              effective_force_score: 13,
            },
          },
          governance_blocked_reuse: [{
            id: 'wf-budget-hold',
            name: 'Branch Budget Template Canonical',
            reason: 'checkpoint_branch_budget_exhausted',
            checkpoint_id: 'cp-budget-hold',
            adoption_status: 'mainline',
            branch_budget: 0,
            workflow_tightness: 'tight',
            oversight_strength: 'strong',
          }],
          governance_reenable_guidance:
            'wf-budget-hold (Branch Budget Template Canonical) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
          replanning_handoff: {
            parent_task_id: 't-parent-governed-docs',
            parent_decision_note: 'Retry only the governed documentation path before another launch.',
          },
          task_document_ready: true,
          prerequisites_ready: true,
          workflow_ready: true,
          ready_at: '2026-04-28T01:20:00Z',
          dispatched_at: '2026-04-28T01:21:00Z',
        },
        {
          task_id: 'task-untouched',
          task_name: 'Untouched task',
          workflow_template_id: 'wf-untouched',
          workflow_name: 'Untouched Workflow',
          task_document_ready: true,
          prerequisites_ready: true,
          workflow_ready: true,
          ready_at: '2026-04-28T01:18:00Z',
          dispatched_at: null,
        },
      ],
    );
  });

  it('describes session-dispatch packet waiting-area lines from shared payload waiting-task state', () => {
    const payloadTask = buildSessionDispatchPayloadWaitingTask(
      {
        task_id: ' task-docs ',
        task_name: ' Governed docs delivery ',
        task_type: ' documentation ',
        milestone_id: ' ms-governance ',
        task_document_path: ' docs/tasks/task-docs/task-docs.md ',
        workflow_template_id: ' wf-selected ',
        workflow_name: ' Selected Workflow ',
        governance_selection_context: {
          basis: ' governance_prefer_effective_force ',
          preferred: {
            workflow_id: ' wf-selected ',
            workflow_name: ' Selected Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: ' wf-compared ',
            workflow_name: ' Compared Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [
          {
            id: ' wf-budget-hold ',
            name: ' Branch Budget Template ',
            reason: ' checkpoint_branch_budget_exhausted ',
            checkpoint_id: ' cp-budget-hold ',
            adoption_status: ' mainline ',
            branch_budget: 0,
            workflow_tightness: ' tight ',
            oversight_strength: ' strong ',
          },
        ],
        canonical_workflow_name_overrides: {
          ' wf-selected ': ' Selected Workflow Canonical ',
          ' wf-compared ': ' Compared Workflow Canonical ',
          ' wf-budget-hold ': ' Branch Budget Template Canonical ',
        },
      },
      {
        replanning_handoff: {
          parent_task_id: ' t-parent-governed-docs ',
          parent_decision_note: ' Retry only the governed documentation path before another launch. ',
        },
      },
    );

    assert.equal(
      describeSessionDispatchPayloadWaitingTask(payloadTask),
      '- task-docs: Governed docs delivery -> wf-selected'
        + ' | governance: wf-budget-hold (Branch Budget Template Canonical) last exhausted branch_budget=0 at active checkpoint cp-budget-hold under tight workflow_tightness / strong oversight, so automatic reuse stays blocked until a later run clears that constraint'
        + ' | governance_selection_context: basis: governance_prefer_effective_force (preferred the stronger checkpoint effective force after governance cost tied) | preferred: wf-selected (Selected Workflow Canonical) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 19 | compared: wf-compared (Compared Workflow Canonical) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 13'
        + ' | replanning_handoff: parent_task_id: t-parent-governed-docs | parent_decision_note: Retry only the governed documentation path before another launch.',
    );
  });

  it('builds session-dispatch packet waiting-area payload/body state from shared waiting-task helpers', () => {
    const readyWaitingTask = {
      task_id: ' task-docs ',
      task_name: ' Governed docs delivery ',
      task_type: ' documentation ',
      milestone_id: ' ms-governance ',
      task_document_path: ' docs/tasks/task-docs/task-docs.md ',
      workflow_template_id: ' wf-selected ',
      workflow_name: ' Selected Workflow ',
      governance_selection_context: {
        basis: ' governance_prefer_effective_force ',
        preferred: {
          workflow_id: ' wf-selected ',
          workflow_name: ' Selected Workflow ',
          policy: ' branch_budget=1 ',
          governance_pressure_score: 1220,
          effective_force_score: 19,
        },
        compared: {
          workflow_id: ' wf-compared ',
          workflow_name: ' Compared Workflow ',
          policy: ' branch_budget=1 ',
          governance_pressure_score: 1220,
          effective_force_score: 13,
        },
      },
      governance_blocked_reuse: [],
      canonical_workflow_name_overrides: {
        ' wf-selected ': ' Selected Workflow Canonical ',
        ' wf-compared ': ' Compared Workflow Canonical ',
        ' wf-budget-hold ': ' Branch Budget Template Canonical ',
      },
    };
    const workflowPreparationPayloadTask = {
      task_id: ' task-docs ',
      replanning_handoff: {
        parent_task_id: ' t-parent-governed-docs ',
        parent_decision_note: ' Retry only the governed documentation path before another launch. ',
      },
      governance_blocked_reuse: [
        {
          id: ' wf-budget-hold ',
          name: ' Branch Budget Template ',
          reason: ' checkpoint_branch_budget_exhausted ',
          checkpoint_id: ' cp-budget-hold ',
          adoption_status: ' mainline ',
          branch_budget: 0,
          workflow_tightness: ' tight ',
          oversight_strength: ' strong ',
        },
      ],
      canonical_governance_blocked_reuse_workflow_names: {
        ' wf-budget-hold ': ' Branch Budget Template Canonical ',
      },
    };
    const expectedPayloadTask = buildSessionDispatchPayloadWaitingTask(
      readyWaitingTask,
      workflowPreparationPayloadTask,
    );

    assert.deepEqual(
      buildSessionDispatchPacketWaitingArea(
        [readyWaitingTask],
        [workflowPreparationPayloadTask],
      ),
      {
        payloadWaitingTasks: [expectedPayloadTask],
        taskLines: describeSessionDispatchPayloadWaitingTask(expectedPayloadTask),
      },
    );
  });

  it('builds session-dispatch waiting-task view variants from workflow-preparation payload state', async () => {
    const result = await buildSessionDispatchPacketWaitingTaskViews(
      {
        workflow_preparation: {
          dispatch: {
            packet: {
              payload: {
                waiting_tasks: [
                  {
                    task_id: ' task-docs ',
                    task_name: ' Governed docs delivery legacy ',
                    task_type: ' documentation ',
                    milestone_id: ' ms-governance ',
                    task_document_path: ' docs/tasks/task-docs/task-docs.md ',
                    workflow_template_id: ' wf-selected ',
                    workflow_name: ' Selected Workflow Legacy ',
                    governance_selection_context: {
                      basis: ' governance_prefer_effective_force ',
                      preferred: {
                        workflow_id: ' wf-selected ',
                        workflow_name: ' Selected Workflow Legacy ',
                        policy: ' branch_budget=1 ',
                        governance_pressure_score: 1220,
                        effective_force_score: 19,
                      },
                      compared: {
                        workflow_id: ' wf-compared ',
                        workflow_name: ' Compared Workflow Legacy ',
                        policy: ' branch_budget=1 ',
                        governance_pressure_score: 1220,
                        effective_force_score: 13,
                      },
                    },
                    governance_blocked_reuse: [
                      {
                        id: ' wf-budget-hold ',
                        name: ' Branch Budget Template Legacy ',
                        reason: ' checkpoint_branch_budget_exhausted ',
                        checkpoint_id: ' cp-budget-hold ',
                        adoption_status: ' mainline ',
                        branch_budget: 0,
                        workflow_tightness: ' tight ',
                        oversight_strength: ' strong ',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      [
        {
          task_id: ' task-docs ',
          task_name: ' Governed docs delivery ready ',
          task_type: ' documentation ',
          milestone_id: ' ms-governance ',
          task_document_path: ' docs/tasks/task-docs/task-docs.md ',
          workflow_template_id: ' wf-selected ',
          workflow_name: ' Selected Workflow Ready ',
          governance_selection_context: {
            basis: ' governance_prefer_effective_force ',
            preferred: {
              workflow_id: ' wf-selected ',
              workflow_name: ' Selected Workflow Ready ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 19,
            },
            compared: {
              workflow_id: ' wf-compared ',
              workflow_name: ' Compared Workflow Ready ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 13,
            },
          },
          governance_blocked_reuse: [
            {
              id: ' wf-budget-hold ',
              name: ' Branch Budget Template Ready ',
              reason: ' checkpoint_branch_budget_exhausted ',
              checkpoint_id: ' cp-budget-hold ',
              adoption_status: ' mainline ',
              branch_budget: 0,
              workflow_tightness: ' tight ',
              oversight_strength: ' strong ',
            },
          ],
          task_document_ready: true,
          prerequisites_ready: true,
          workflow_ready: true,
          ready_at: '2026-04-28T02:00:00Z',
        },
      ],
      async (kind, id) => {
        if (kind === 'task' && id === 'task-docs') {
          return {
            id: 'task-docs',
            data: {
              name: 'Governed docs delivery canonical',
            },
          };
        }
        if (kind === 'workflow' && id === 'wf-selected') {
          return {
            id: 'wf-selected',
            data: {
              name: 'Selected Workflow Canonical',
            },
          };
        }
        if (kind === 'workflow' && id === 'wf-compared') {
          return {
            id: 'wf-compared',
            data: {
              name: 'Compared Workflow Canonical',
            },
          };
        }
        if (kind === 'workflow' && id === 'wf-budget-hold') {
          return {
            id: 'wf-budget-hold',
            data: {
              name: 'Branch Budget Template Canonical',
            },
          };
        }
        return null;
      },
    );

    assert.equal(result.workflowPreparationPayloadWaitingTasksForDispatchPacket[0].canonical_task_name, 'Governed docs delivery canonical');
    assert.equal(result.workflowPreparationPayloadWaitingTasksForDispatchPacket[0].canonical_workflow_name, 'Selected Workflow Canonical');
    assert.deepEqual(result.waitingTasksForSessionContext[0].canonical_selection_context_workflow_names, {
      'wf-selected': 'Selected Workflow Canonical',
      'wf-compared': 'Compared Workflow Canonical',
    });
    assert.deepEqual(result.waitingTasksForDispatchPacket, [
      {
        task_id: ' task-docs ',
        task_name: 'Governed docs delivery canonical',
        task_type: ' documentation ',
        milestone_id: ' ms-governance ',
        task_document_path: ' docs/tasks/task-docs/task-docs.md ',
        workflow_template_id: ' wf-selected ',
        workflow_name: 'Selected Workflow Canonical',
        governance_selection_context: {
          basis: 'governance_prefer_effective_force',
          preferred: {
            workflow_id: 'wf-selected',
            workflow_name: 'Selected Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: 'wf-compared',
            workflow_name: 'Compared Workflow Canonical',
            policy: 'branch_budget=1',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [{
          id: 'wf-budget-hold',
          name: 'Branch Budget Template Canonical',
          reason: 'checkpoint_branch_budget_exhausted',
          checkpoint_id: 'cp-budget-hold',
          adoption_status: 'mainline',
          branch_budget: 0,
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
        }],
        governance_reenable_guidance:
          'wf-budget-hold (Branch Budget Template Canonical) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
        task_document_ready: true,
        prerequisites_ready: true,
        workflow_ready: true,
        ready_at: '2026-04-28T02:00:00Z',
        canonical_task_name: 'Governed docs delivery canonical',
        canonical_workflow_name: 'Selected Workflow Canonical',
        canonical_workflow_name_overrides: {
          'wf-selected': 'Selected Workflow Canonical',
          'wf-compared': 'Compared Workflow Canonical',
          'wf-budget-hold': 'Branch Budget Template Canonical',
        },
        canonical_selection_context_workflow_names: {
          'wf-selected': 'Selected Workflow Canonical',
          'wf-compared': 'Compared Workflow Canonical',
        },
        canonical_governance_blocked_reuse_workflow_names: {
          'wf-budget-hold': 'Branch Budget Template Canonical',
        },
      },
    ]);
  });

  it('builds workflow-preparation payload waiting-task records from shared governance inputs', () => {
    assert.deepEqual(
      buildWorkflowPreparationPayloadWaitingTask(
        {
          id: ' task-docs ',
          data: {
            name: ' Governed docs delivery ',
            task_type: ' documentation ',
            milestone_id: ' ms-governance ',
            replanning: {
              parent_task_id: ' t-parent-docs ',
              parent_decision_note: ' Narrow the retry to the publication-only files. ',
            },
          },
        },
        {
          recommended: {
            workflow: {
              id: ' wf-selected ',
              data: {
                name: ' Selected Workflow ',
              },
            },
            rank: 7,
            mode: ' governance_prefer_effective_force ',
            note: ' Preferred because stronger checkpoint force carried less policy risk. ',
            selection_context: {
              basis: ' governance_prefer_effective_force ',
              preferred: {
                workflow_id: ' wf-selected ',
                workflow_name: ' Selected Workflow ',
                policy: ' branch_budget=1 ',
                governance_pressure_score: 1220,
                effective_force_score: 19,
              },
              compared: {
                workflow_id: ' wf-compared ',
                workflow_name: ' Compared Workflow ',
                policy: ' branch_budget=1 ',
                governance_pressure_score: 1220,
                effective_force_score: 13,
              },
            },
          },
          candidates: [
            {
              id: ' wf-selected ',
              name: ' Selected Workflow ',
            },
            {
              id: ' wf-roomier ',
              name: ' Roomier Template ',
            },
          ],
          governance_blocked_candidates: [
            {
              id: ' wf-budget-hold ',
              name: ' Branch Budget Template ',
              reason: ' checkpoint_branch_budget_exhausted ',
              checkpoint_id: ' cp-budget-hold ',
              adoption_status: ' mainline ',
              branch_budget: 0,
              workflow_tightness: ' tight ',
              oversight_strength: ' strong ',
            },
            {
              id: ' wf-missing-reason ',
              name: ' Missing Reason ',
            },
          ],
        },
      ),
      {
        task_id: 'task-docs',
        task_name: 'Governed docs delivery',
        task_type: 'documentation',
        milestone_id: 'ms-governance',
        task_document_path: 'docs/tasks/task-docs/task-docs.md',
        replanning_handoff: {
          parent_task_id: 't-parent-docs',
          parent_decision_note: 'Narrow the retry to the publication-only files.',
        },
        workflow_action: 'reuse',
        workflow_template_id: 'wf-selected',
        workflow_name: 'Selected Workflow',
        preferred_reuse:
          'wf-selected (Selected Workflow) rank 7 via governance_prefer_effective_force. Preferred because stronger checkpoint force carried less policy risk.',
        reusable_candidates: [
          {
            id: 'wf-selected',
            name: 'Selected Workflow',
          },
          {
            id: 'wf-roomier',
            name: 'Roomier Template',
          },
        ],
        governance_selection_context: {
          basis: ' governance_prefer_effective_force ',
          preferred: {
            workflow_id: ' wf-selected ',
            workflow_name: ' Selected Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 19,
          },
          compared: {
            workflow_id: ' wf-compared ',
            workflow_name: ' Compared Workflow ',
            policy: ' branch_budget=1 ',
            governance_pressure_score: 1220,
            effective_force_score: 13,
          },
        },
        governance_blocked_reuse: [{
          id: 'wf-budget-hold',
          name: 'Branch Budget Template',
          reason: 'checkpoint_branch_budget_exhausted',
          checkpoint_id: 'cp-budget-hold',
          adoption_status: 'mainline',
          branch_budget: 0,
          workflow_tightness: 'tight',
          oversight_strength: 'strong',
        }],
        governance_reenable_guidance:
          'wf-budget-hold (Branch Budget Template) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
      },
    );
  });

  it('describes workflow-preparation packet and scaffold task text from shared payload waiting-task state', () => {
    const reusePayloadTask = buildWorkflowPreparationPayloadWaitingTask(
      {
        id: ' task-docs ',
        data: {
          name: ' Governed docs delivery ',
          task_type: ' documentation ',
          milestone_id: ' ms-governance ',
          replanning: {
            parent_task_id: ' t-parent-docs ',
            parent_decision_note: ' Narrow the retry to the publication-only files. ',
          },
        },
      },
      {
        recommended: {
          workflow: {
            id: ' wf-selected ',
            data: {
              name: ' Selected Workflow ',
            },
          },
          rank: 7,
          mode: ' governance_prefer_effective_force ',
          note: ' Preferred because stronger checkpoint force carried less policy risk. ',
          selection_context: {
            basis: ' governance_prefer_effective_force ',
            preferred: {
              workflow_id: ' wf-selected ',
              workflow_name: ' Selected Workflow ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 19,
            },
            compared: {
              workflow_id: ' wf-compared ',
              workflow_name: ' Compared Workflow ',
              policy: ' branch_budget=1 ',
              governance_pressure_score: 1220,
              effective_force_score: 13,
            },
          },
        },
        candidates: [
          {
            id: ' wf-selected ',
            name: ' Selected Workflow ',
          },
          {
            id: ' wf-roomier ',
            name: ' Roomier Template ',
          },
        ],
        governance_blocked_candidates: [
          {
            id: ' wf-budget-hold ',
            name: ' Branch Budget Template ',
            reason: ' checkpoint_branch_budget_exhausted ',
            checkpoint_id: ' cp-budget-hold ',
            adoption_status: ' mainline ',
            branch_budget: 0,
            workflow_tightness: ' tight ',
            oversight_strength: ' strong ',
          },
        ],
      },
    );
    assert.equal(
      describeWorkflowPreparationPayloadWaitingTask(reusePayloadTask),
      '- task-docs: Governed docs delivery\n'
        + '  task_type: documentation\n'
        + '  milestone: ms-governance\n'
        + '  task_document: docs/tasks/task-docs/task-docs.md\n'
        + '  replanning_handoff: parent_task_id: t-parent-docs | parent_decision_note: Narrow the retry to the publication-only files.\n'
        + '  preferred_reuse: wf-selected (Selected Workflow) rank 7 via governance_prefer_effective_force. Preferred because stronger checkpoint force carried less policy risk.\n'
        + '  governance_selection_context: basis: governance_prefer_effective_force (preferred the stronger checkpoint effective force after governance cost tied) | preferred: wf-selected (Selected Workflow) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 19 | compared: wf-compared (Compared Workflow) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 13\n'
        + '  reusable_candidates: wf-selected (Selected Workflow), wf-roomier (Roomier Template)\n'
        + '  governance_blocked_reuse: wf-budget-hold (Branch Budget Template) last exhausted branch_budget=0 at active checkpoint cp-budget-hold under tight workflow_tightness / strong oversight, so automatic reuse stays blocked until a later run clears that constraint\n'
        + '  governance_reenable_guidance: wf-budget-hold (Branch Budget Template) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
    );
    assert.equal(
      describeWorkflowPreparationScaffoldTask(reusePayloadTask),
      '## Task task-docs: Governed docs delivery\n'
        + 'Task Type: documentation\n'
        + 'Milestone: ms-governance\n'
        + 'Task Document: docs/tasks/task-docs/task-docs.md\n'
        + 'Workflow Action: reuse\n'
        + 'Replanning handoff: parent_task_id: t-parent-docs | parent_decision_note: Narrow the retry to the publication-only files.\n'
        + 'Workflow ID: wf-selected\n'
        + '\n'
        + 'Preferred reuse: wf-selected (Selected Workflow) rank 7 via governance_prefer_effective_force. Preferred because stronger checkpoint force carried less policy risk.\n'
        + 'Governance selection context: basis: governance_prefer_effective_force (preferred the stronger checkpoint effective force after governance cost tied) | preferred: wf-selected (Selected Workflow) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 19 | compared: wf-compared (Compared Workflow) | policy: branch_budget=1 | governance_pressure_score: 1220 | effective_force_score: 13\n'
        + 'Other candidates: wf-selected, wf-roomier\n'
        + 'Governance-blocked reuse: wf-budget-hold (Branch Budget Template) last exhausted branch_budget=0 at active checkpoint cp-budget-hold under tight workflow_tightness / strong oversight, so automatic reuse stays blocked until a later run clears that constraint\n'
        + 'Governance re-enable guidance: wf-budget-hold (Branch Budget Template) should stay off automatic reuse until a later mainline checkpoint clears branch_budget=0 at active checkpoint cp-budget-hold.',
    );

    const createPayloadTask = buildWorkflowPreparationPayloadWaitingTask(
      {
        id: ' task-fresh ',
        data: {
          name: ' Fresh workflow design ',
          task_type: ' planning ',
          milestone_id: ' ms-design ',
        },
      },
      {
        governance_blocked_candidates: [
          {
            id: ' wf-lineage-hold ',
            name: ' Warm Lineage Template ',
            reason: ' warm_semantic_lineage ',
            checkpoint_id: ' cp-warm ',
            adoption_status: ' mainline ',
          },
        ],
      },
    );
    assert.equal(
      describeWorkflowPreparationScaffoldTask(createPayloadTask),
      '## Task task-fresh: Fresh workflow design\n'
        + 'Task Type: planning\n'
        + 'Milestone: ms-design\n'
        + 'Task Document: docs/tasks/task-fresh/task-fresh.md\n'
        + 'Workflow Action: create\n'
        + 'Workflow Name: Fresh workflow design Delivery Flow\n'
        + '\n'
        + 'Governance note: wf-lineage-hold (Warm Lineage Template) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse.\n'
        + 'Governance re-enable guidance: wf-lineage-hold (Warm Lineage Template) should stay off automatic reuse until governance records an explicit reuse decision for its warm semantic lineage.\n'
        + '\n'
        + '### Workflow Description\n'
        + '\n'
        + 'Describe the custom workflow that should execute task task-fresh once the session starts.\n'
        + '\n'
        + '### Steps\n'
        + '\n'
        + '- s1 | inspect | Review the task document and requirement context | inputs: task-document, requirement-document | outputs: scoped-plan\n'
        + '- s2 | execute | Produce the task deliverable | inputs: scoped-plan | outputs: candidate-output\n'
        + '- s3 | verify | Validate the task output against acceptance criteria | inputs: candidate-output, acceptance-criteria | outputs: verification-report',
    );
  });

  it('canonicalizes compared governance selection workflow labels when session enrichment provides live workflow names', () => {
    const readyTasks = [{
      task_id: ' task-docs ',
      task_name: ' Documentation ',
      canonical_task_name: ' Documentation (Renamed) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template ',
      canonical_workflow_name: ' Roomier Template Renamed ',
      canonical_workflow_name_overrides: {
        'wf-roomier-template': ' Roomier Template Renamed ',
        'wf-tight-template': ' Tight Template Renamed ',
      },
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    }];

    assert.deepEqual(sessionGovernanceSelectionContexts(readyTasks), [{
      task_id: 'task-docs',
      task_name: 'Documentation (Renamed)',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template Renamed',
      selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template Renamed',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template Renamed',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    }]);
  });

  it('canonicalizes waiting-task governance labels from injected live task and workflow names', () => {
    const readyTasks = [
      {
        task_id: ' task-docs ',
        task_name: ' Documentation (Legacy) ',
        canonical_task_name: ' Documentation (Renamed) ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template (Legacy) ',
        canonical_workflow_name: ' Roomier Template Renamed ',
        canonical_selection_context_workflow_names: {
          'wf-tight-template': ' Tight Template Renamed ',
        },
        governance_selection_context: {
          basis: ' governance_minimize_policy_carryover ',
          preferred: {
            workflow_id: ' wf-roomier-template ',
            workflow_name: ' Roomier Template (Legacy) ',
            policy: ' branch_budget=3 ',
            governance_pressure_score: 1206,
            effective_force_score: 14,
          },
          compared: {
            workflow_id: ' wf-tight-template ',
            workflow_name: ' Tight Template ',
            policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
            governance_pressure_score: 1228,
            effective_force_score: 0,
          },
        },
      },
      {
        task_id: 'task-review',
        task_name: ' Review docs (legacy) ',
        canonical_task_name: ' Review docs ',
        workflow_template_id: 'wf-review-template',
        workflow_name: ' Review Template (legacy) ',
        canonical_workflow_name: ' Review Template Renamed ',
        governance_selection_context: null,
      },
    ];

    assert.deepEqual(canonicalizeWaitingTaskGovernanceLabels(readyTasks), [
      {
        task_id: ' task-docs ',
        task_name: 'Documentation (Renamed)',
        canonical_task_name: ' Documentation (Renamed) ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: 'Roomier Template Renamed',
        canonical_workflow_name: ' Roomier Template Renamed ',
        canonical_selection_context_workflow_names: {
          'wf-tight-template': ' Tight Template Renamed ',
        },
        governance_selection_context: {
          basis: 'governance_minimize_policy_carryover',
          preferred: {
            workflow_id: 'wf-roomier-template',
            workflow_name: 'Roomier Template Renamed',
            policy: 'branch_budget=3',
            governance_pressure_score: 1206,
            effective_force_score: 14,
          },
          compared: {
            workflow_id: 'wf-tight-template',
            workflow_name: 'Tight Template Renamed',
            policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
            governance_pressure_score: 1228,
            effective_force_score: 0,
          },
        },
        governance_blocked_reuse: [],
        governance_reenable_guidance: 'none',
        canonical_workflow_name_overrides: {
          'wf-roomier-template': 'Roomier Template Renamed',
          'wf-tight-template': 'Tight Template Renamed',
        },
      },
      {
        task_id: 'task-review',
        task_name: 'Review docs',
        canonical_task_name: ' Review docs ',
        workflow_template_id: 'wf-review-template',
        workflow_name: 'Review Template Renamed',
        canonical_workflow_name: ' Review Template Renamed ',
        governance_selection_context: null,
        governance_blocked_reuse: [],
        governance_reenable_guidance: 'none',
        canonical_workflow_name_overrides: {
          'wf-review-template': 'Review Template Renamed',
        },
      },
    ]);
  });

  it('synthesizes shared canonical workflow-name overrides from legacy waiting-task maps', () => {
    const readyTasks = [{
      task_id: ' task-docs ',
      task_name: ' Documentation (Legacy) ',
      canonical_task_name: ' Documentation (Renamed) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (Legacy) ',
      canonical_workflow_name: ' Roomier Template Renamed ',
      canonical_selection_context_workflow_names: {
        'wf-tight-template': ' Tight Template Renamed ',
      },
      canonical_governance_blocked_reuse_workflow_names: {
        'wf-lineage-hold': ' Warm Lineage Template Renamed ',
      },
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template (Legacy) ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
      governance_blocked_reuse: [{
        id: ' wf-lineage-hold ',
        name: ' Warm Lineage Template (Legacy) ',
        reason: ' warm_semantic_lineage ',
        checkpoint_id: ' cp-lineage ',
      }],
    }];

    assert.deepEqual(canonicalizeWaitingTaskGovernanceLabels(readyTasks), [{
      task_id: ' task-docs ',
      task_name: 'Documentation (Renamed)',
      canonical_task_name: ' Documentation (Renamed) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: 'Roomier Template Renamed',
      canonical_workflow_name: ' Roomier Template Renamed ',
      canonical_selection_context_workflow_names: {
        'wf-tight-template': ' Tight Template Renamed ',
      },
      canonical_governance_blocked_reuse_workflow_names: {
        'wf-lineage-hold': ' Warm Lineage Template Renamed ',
      },
      governance_selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template Renamed',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template Renamed',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
      governance_blocked_reuse: [{
        id: 'wf-lineage-hold',
        name: 'Warm Lineage Template Renamed',
        reason: 'warm_semantic_lineage',
        checkpoint_id: 'cp-lineage',
        adoption_status: null,
        branch_budget: null,
        workflow_tightness: null,
        oversight_strength: null,
      }],
      governance_reenable_guidance:
        'wf-lineage-hold (Warm Lineage Template Renamed) should stay off automatic reuse until governance records an explicit reuse decision for its warm semantic lineage.',
      canonical_workflow_name_overrides: {
        'wf-roomier-template': 'Roomier Template Renamed',
        'wf-tight-template': 'Tight Template Renamed',
        'wf-lineage-hold': 'Warm Lineage Template Renamed',
      },
    }]);
  });

  it('hydrates waiting-task governance labels from live task, selection, and blocked-reuse workflow names', async () => {
    const readyTasks = [{
      task_id: ' task-docs ',
      task_name: ' Documentation (Legacy) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (Legacy) ',
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template (Legacy) ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template (Legacy) ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
      governance_blocked_reuse: [{
        id: ' wf-lineage-hold ',
        name: ' Warm Lineage Template (Legacy) ',
        reason: ' warm_semantic_lineage ',
        checkpoint_id: ' cp-lineage ',
      }],
    }];
    const liveDocs = new Map([
      ['task:task-docs', {
        id: 'task-docs',
        data: {
          name: 'Documentation Refresh',
          replanning: {
            parent_task_id: ' t-parent-docs ',
            parent_decision_note: ' Narrow the retry to publication-root artifacts only. ',
          },
        },
      }],
      ['workflow:wf-roomier-template', { id: 'wf-roomier-template', data: { name: 'Roomier Template Renamed' } }],
      ['workflow:wf-tight-template', { id: 'wf-tight-template', data: { name: 'Tight Template Renamed' } }],
      ['workflow:wf-lineage-hold', { id: 'wf-lineage-hold', data: { name: 'Warm Lineage Template Renamed' } }],
    ]);

    const hydrated = await hydrateWaitingTaskGovernanceLabels(
      readyTasks,
      async (kind, id) => liveDocs.get(`${kind}:${id}`) ?? null,
    );

    assert.deepEqual(hydrated, [{
      task_id: ' task-docs ',
      task_name: ' Documentation (Legacy) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (Legacy) ',
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template (Legacy) ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template (Legacy) ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
      governance_blocked_reuse: [{
        id: ' wf-lineage-hold ',
        name: ' Warm Lineage Template (Legacy) ',
        reason: ' warm_semantic_lineage ',
        checkpoint_id: ' cp-lineage ',
      }],
      canonical_task_name: 'Documentation Refresh',
      parent_task_id: 't-parent-docs',
      parent_decision_note: 'Narrow the retry to publication-root artifacts only.',
      canonical_workflow_name: 'Roomier Template Renamed',
      canonical_workflow_name_overrides: {
        'wf-roomier-template': 'Roomier Template Renamed',
        'wf-tight-template': 'Tight Template Renamed',
        'wf-lineage-hold': 'Warm Lineage Template Renamed',
      },
      canonical_selection_context_workflow_names: {
        'wf-roomier-template': 'Roomier Template Renamed',
        'wf-tight-template': 'Tight Template Renamed',
      },
      canonical_governance_blocked_reuse_workflow_names: {
        'wf-lineage-hold': 'Warm Lineage Template Renamed',
      },
    }]);
  });

  it('hydrates canonical blocked-reuse workflow names from fallback packet tasks for reused waiting tasks', async () => {
    const readyTasks = [{
      task_id: ' task-docs ',
      task_name: ' Documentation (Legacy) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (Legacy) ',
      governance_selection_context: null,
      governance_blocked_reuse: [],
    }];
    const fallbackWaitingTasks = [{
      task_id: 'task-docs',
      governance_blocked_reuse: [{
        id: ' wf-lineage-hold ',
        name: ' Warm Lineage Template (Legacy) ',
        reason: ' warm_semantic_lineage ',
        checkpoint_id: ' cp-lineage ',
      }],
    }];
    const liveDocs = new Map([
      ['task:task-docs', { id: 'task-docs', data: { name: 'Documentation Refresh' } }],
      ['workflow:wf-roomier-template', { id: 'wf-roomier-template', data: { name: 'Roomier Template Renamed' } }],
      ['workflow:wf-lineage-hold', { id: 'wf-lineage-hold', data: { name: 'Warm Lineage Template Renamed' } }],
    ]);

    const hydrated = await hydrateWaitingTaskGovernanceLabels(
      readyTasks,
      async (kind, id) => liveDocs.get(`${kind}:${id}`) ?? null,
      fallbackWaitingTasks,
    );

    assert.deepEqual(hydrated, [{
      task_id: ' task-docs ',
      task_name: ' Documentation (Legacy) ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (Legacy) ',
      governance_selection_context: null,
      governance_blocked_reuse: [],
      canonical_task_name: 'Documentation Refresh',
      canonical_workflow_name: 'Roomier Template Renamed',
      canonical_workflow_name_overrides: {
        'wf-roomier-template': 'Roomier Template Renamed',
        'wf-lineage-hold': 'Warm Lineage Template Renamed',
      },
      canonical_selection_context_workflow_names: {
        'wf-roomier-template': 'Roomier Template Renamed',
      },
      canonical_governance_blocked_reuse_workflow_names: {
        'wf-lineage-hold': 'Warm Lineage Template Renamed',
      },
    }]);
    assert.deepEqual(
      canonicalizeWaitingTaskGovernanceBlockedReuse(
        hydrated[0],
        fallbackWaitingTasks[0].governance_blocked_reuse,
      ),
      [{
        id: 'wf-lineage-hold',
        name: 'Warm Lineage Template Renamed',
        reason: 'warm_semantic_lineage',
        checkpoint_id: 'cp-lineage',
        adoption_status: null,
        branch_budget: null,
        workflow_tightness: null,
        oversight_strength: null,
      }],
    );
  });

  it('deduplicates normalized session governance selection context injection entries', () => {
    const readyTasks = [
      {
        task_id: ' task-docs ',
        task_name: ' Documentation ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template ',
        governance_selection_context: {
          basis: ' governance_minimize_policy_carryover ',
          preferred: {
            workflow_id: ' wf-roomier-template ',
            workflow_name: ' Roomier Template ',
            policy: ' branch_budget=3 ',
            governance_pressure_score: 1206,
            effective_force_score: 14,
          },
          compared: {
            workflow_id: ' wf-tight-template ',
            workflow_name: ' Tight Template ',
            policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
            governance_pressure_score: 1228,
            effective_force_score: 0,
          },
        },
      },
      {
        task_id: 'task-docs',
        task_name: 'Documentation',
        workflow_template_id: 'wf-roomier-template',
        workflow_name: 'Roomier Template',
        governance_selection_context: {
          basis: 'governance_minimize_policy_carryover',
          preferred: {
            workflow_id: 'wf-roomier-template',
            workflow_name: 'Roomier Template',
            policy: 'branch_budget=3',
            governance_pressure_score: 1206,
            effective_force_score: 14,
          },
          compared: {
            workflow_id: 'wf-tight-template',
            workflow_name: 'Tight Template',
            policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
            governance_pressure_score: 1228,
            effective_force_score: 0,
          },
        },
      },
    ];

    const expectedSelectionContexts = [{
      task_id: 'task-docs',
      task_name: 'Documentation',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template',
      selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    }];

    assert.deepEqual(sessionGovernanceSelectionContexts(readyTasks), expectedSelectionContexts);
    assert.deepEqual(buildSessionContextInjected(readyTasks), {
      workflow_template: 'wf-roomier-template',
      distillations_applied: [],
      registry_rank_at_selection: null,
      replanning_handoffs: [],
      governance_selection_contexts: expectedSelectionContexts,
    });
  });

  it('deduplicates duplicate governed selection-context entries after canonical labels are injected', () => {
    const staleEntry = {
      task_id: ' task-docs ',
      task_name: ' Docs ',
      canonical_task_name: ' Documentation Refresh ',
      workflow_template_id: ' wf-roomier-template ',
      workflow_name: ' Roomier Template (legacy) ',
      canonical_workflow_name: ' Roomier Template Renamed ',
      governance_selection_context: {
        basis: ' governance_minimize_policy_carryover ',
        preferred: {
          workflow_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template (legacy) ',
          policy: ' branch_budget=3 ',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: ' wf-tight-template ',
          workflow_name: ' Tight Template ',
          policy: ' tight workflow_tightness, strong oversight, branch_budget=1 ',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    };
    const currentEntry = {
      task_id: 'task-docs',
      task_name: 'Documentation Refresh',
      canonical_task_name: 'Documentation Refresh',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template Renamed',
      canonical_workflow_name: 'Roomier Template Renamed',
      governance_selection_context: structuredClone(staleEntry.governance_selection_context),
    };

    const expectedSelectionContexts = [{
      task_id: 'task-docs',
      task_name: 'Documentation Refresh',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template Renamed',
      selection_context: {
        basis: 'governance_minimize_policy_carryover',
        preferred: {
          workflow_id: 'wf-roomier-template',
          workflow_name: 'Roomier Template Renamed',
          policy: 'branch_budget=3',
          governance_pressure_score: 1206,
          effective_force_score: 14,
        },
        compared: {
          workflow_id: 'wf-tight-template',
          workflow_name: 'Tight Template',
          policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
          governance_pressure_score: 1228,
          effective_force_score: 0,
        },
      },
    }];

    assert.deepEqual(
      sessionGovernanceSelectionContexts([staleEntry, currentEntry]),
      expectedSelectionContexts,
    );
    assert.deepEqual(
      sessionGovernanceSelectionContexts([currentEntry, staleEntry]),
      expectedSelectionContexts,
    );
    assert.deepEqual(buildSessionContextInjected([staleEntry, currentEntry]), {
      workflow_template: 'wf-roomier-template',
      distillations_applied: [],
      registry_rank_at_selection: null,
      replanning_handoffs: [],
      governance_selection_contexts: expectedSelectionContexts,
    });
  });

  it('normalizes waiting-task governance blocked reuse and builds session governance context', () => {
    const blockedReuse = waitingTaskGovernanceBlockedReuse({
      recommended: null,
      governance_blocked_candidates: [
        {
          workflow_template_id: ' wf-roomier-template ',
          workflow_name: ' Roomier Template ',
          reason: ' warm_semantic_lineage ',
          checkpoint_id: ' cp-roomier ',
          adoption_status: ' synthesized ',
          branch_budget: 0,
          workflow_tightness: ' tight ',
          oversight_strength: ' strong ',
        },
        {
          workflow_template_id: 'wf-invalid-candidate',
          workflow_name: 'Invalid Candidate',
          reason: ' ',
        },
      ],
    }, 'custom_generated');

    assert.deepEqual(blockedReuse, [{
      id: 'wf-roomier-template',
      name: 'Roomier Template',
      reason: 'warm_semantic_lineage',
      checkpoint_id: 'cp-roomier',
      adoption_status: 'synthesized',
      branch_budget: 0,
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
    }]);
    assert.equal(describeWaitingTaskGovernance({ governance_blocked_reuse: blockedReuse }), 'wf-roomier-template (Roomier Template) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse');

    const governanceContext = buildSessionGovernanceContext([
      {
        task_id: ' task-docs ',
        task_name: ' Documentation ',
        governance_blocked_reuse: blockedReuse,
      },
    ]);

    assert.equal(governanceContext?.source, 'governance_blocked_reuse');
    assert.equal(governanceContext?.isolated_batch, true);
    assert.match(governanceContext?.batch_signature ?? '', /^warm_semantic_lineage:[a-f0-9]{12}$/);
    assert.deepEqual(governanceContext?.reasons, ['warm_semantic_lineage']);
    assert.deepEqual(governanceContext?.blocked_reuse, [{
      task_id: 'task-docs',
      task_name: 'Documentation',
      workflow_template_id: 'wf-roomier-template',
      workflow_name: 'Roomier Template',
      reason: 'warm_semantic_lineage',
      checkpoint_id: 'cp-roomier',
      adoption_status: 'synthesized',
      branch_budget: 0,
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      detail: 'wf-roomier-template (Roomier Template) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse',
    }]);
    assert.equal(buildSessionGovernanceContext([{ task_id: 'task-clean', governance_blocked_reuse: [] }]), null);
  });

  it('deduplicates repeated blocked reuse entries before persisting session governance context', () => {
    const governanceContext = buildSessionGovernanceContext([
      {
        task_id: 'task-dup',
        task_name: 'Duplicate Task',
        governance_blocked_reuse: [
          {
            id: ' wf-dup ',
            name: ' Duplicate Workflow ',
            reason: ' warm_semantic_lineage ',
            checkpoint_id: ' cp-dup ',
            adoption_status: ' synthesized ',
          },
          {
            workflow_template_id: 'wf-dup',
            workflow_name: 'Duplicate Workflow',
            reason: 'warm_semantic_lineage',
            checkpoint_id: 'cp-dup',
            adoption_status: 'synthesized',
          },
        ],
      },
    ]);

    assert.deepEqual(governanceContext, {
      source: 'governance_blocked_reuse',
      isolated_batch: true,
      batch_signature: governanceContext?.batch_signature,
      reasons: ['warm_semantic_lineage'],
      blocked_reuse: [{
        task_id: 'task-dup',
        task_name: 'Duplicate Task',
        workflow_template_id: 'wf-dup',
        workflow_name: 'Duplicate Workflow',
        reason: 'warm_semantic_lineage',
        checkpoint_id: 'cp-dup',
        adoption_status: 'synthesized',
        branch_budget: null,
        workflow_tightness: null,
        oversight_strength: null,
        detail: 'wf-dup (Duplicate Workflow) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse',
      }],
    });
    assert.match(governanceContext?.batch_signature ?? '', /^warm_semantic_lineage:[a-f0-9]{12}$/);
  });

  it('prefers hydrated task and blocked-reuse workflow labels when persisting session governance context', () => {
    const governanceContext = buildSessionGovernanceContext([
      {
        task_id: ' task-docs ',
        task_name: ' Docs ',
        canonical_task_name: ' Documentation Refresh ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template (Legacy) ',
        canonical_workflow_name: ' Roomier Template Renamed ',
        canonical_workflow_name_overrides: {
          'wf-roomier-template': ' Roomier Template Renamed ',
          'wf-lineage-hold': ' Warm Lineage Template Renamed ',
        },
        governance_blocked_reuse: [{
          id: ' wf-lineage-hold ',
          name: ' Warm Lineage Template (Legacy) ',
          reason: ' warm_semantic_lineage ',
          checkpoint_id: ' cp-lineage ',
        }],
      },
    ]);

    assert.equal(governanceContext?.blocked_reuse[0]?.task_name, 'Documentation Refresh');
    assert.equal(governanceContext?.blocked_reuse[0]?.workflow_name, 'Warm Lineage Template Renamed');
    assert.equal(
      governanceContext?.blocked_reuse[0]?.detail,
      'wf-lineage-hold (Warm Lineage Template Renamed) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse',
    );
  });

  it('describes waiting-task governance with canonical blocked-reuse workflow labels', () => {
    assert.equal(
      describeWaitingTaskGovernance({
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template (Legacy) ',
        canonical_workflow_name: ' Roomier Template Renamed ',
        canonical_governance_blocked_reuse_workflow_names: {
          'wf-lineage-hold': ' Warm Lineage Template Renamed ',
        },
        governance_blocked_reuse: [{
          id: ' wf-lineage-hold ',
          name: ' Warm Lineage Template (Legacy) ',
          reason: ' warm_semantic_lineage ',
          checkpoint_id: ' cp-lineage ',
        }],
      }),
      'wf-lineage-hold (Warm Lineage Template Renamed) already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse',
    );
  });

  it('describes waiting-task replanning handoffs with stable trimmed text', () => {
    assert.equal(
      describeWaitingTaskReplanningHandoff({
        parent_task_id: ' t-parent-docs ',
        parent_decision_note: ' Narrow the governed retry to publication-root artifacts only. ',
      }),
      'parent_task_id: t-parent-docs | parent_decision_note: Narrow the governed retry to publication-root artifacts only.',
    );
    assert.equal(
      describeWaitingTaskReplanningHandoff({
        replanning_handoff: {
          parent_task_id: ' t-parent-payload ',
          parent_decision_note: ' Reuse the persisted launch-time handoff. ',
        },
      }),
      'parent_task_id: t-parent-payload | parent_decision_note: Reuse the persisted launch-time handoff.',
    );
    assert.equal(describeWaitingTaskReplanningHandoff({ parent_task_id: 't-parent-docs' }), 'none');
  });

  it('hydrates nested replanning_handoff payloads into stable session handoffs when only the persisted payload shape is available', async () => {
    const [hydrated] = await hydrateWaitingTaskGovernanceLabels([
      {
        task_id: ' task-docs ',
        task_name: ' Documentation Refresh ',
        workflow_template_id: ' wf-roomier-template ',
        workflow_name: ' Roomier Template ',
        replanning_handoff: {
          parent_task_id: ' t-parent-docs ',
          parent_decision_note: ' Narrow the governed retry to publication-root artifacts only. ',
        },
      },
    ], async () => null);

    assert.equal(hydrated.parent_task_id, 't-parent-docs');
    assert.equal(
      hydrated.parent_decision_note,
      'Narrow the governed retry to publication-root artifacts only.',
    );
    assert.deepEqual(buildSessionContextInjected([hydrated]), {
      workflow_template: 'wf-roomier-template',
      distillations_applied: [],
      registry_rank_at_selection: null,
      governance_selection_contexts: [],
      replanning_handoffs: [{
        task_id: 'task-docs',
        task_name: 'Documentation Refresh',
        parent_task_id: 't-parent-docs',
        parent_decision_note: 'Narrow the governed retry to publication-root artifacts only.',
      }],
    });
  });

  it('fingerprints batch signatures from blocked lineage identity, not only the coarse reason', () => {
    const warmLineageA = buildSessionGovernanceContext([
      {
        task_id: 'task-a',
        task_name: 'Task A',
        governance_blocked_reuse: [{
          id: 'wf-alpha',
          name: 'Alpha Workflow',
          reason: 'warm_semantic_lineage',
          checkpoint_id: 'cp-alpha',
          adoption_status: 'synthesized',
        }],
      },
    ]);
    const warmLineageB = buildSessionGovernanceContext([
      {
        task_id: 'task-b',
        task_name: 'Task B',
        governance_blocked_reuse: [{
          id: 'wf-beta',
          name: 'Beta Workflow',
          reason: 'warm_semantic_lineage',
          checkpoint_id: 'cp-beta',
          adoption_status: 'synthesized',
        }],
      },
    ]);

    assert.match(warmLineageA?.batch_signature ?? '', /^warm_semantic_lineage:[a-f0-9]{12}$/);
    assert.match(warmLineageB?.batch_signature ?? '', /^warm_semantic_lineage:[a-f0-9]{12}$/);
    assert.notEqual(warmLineageA?.batch_signature, warmLineageB?.batch_signature);
  });

  it('describes governance selection context with stable governed comparison text', () => {
    const selectionContext = buildGovernanceSelectionContext(
      'governance_prefer_effective_force',
      { id: 'wf-high-force', data: { name: 'High Force Template' } },
      {
        constrained: true,
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
        branch_budget: 1,
        governance_pressure_score: 1228,
      },
      27,
      { id: 'wf-low-force', data: { name: 'Low Force Template' } },
      {
        constrained: true,
        workflow_tightness: 'tight',
        oversight_strength: 'strong',
        branch_budget: 1,
        governance_pressure_score: 1228,
      },
      12,
    );

    assert.equal(
      describeGovernanceSelectionContext(selectionContext),
      'basis: governance_prefer_effective_force (preferred the stronger checkpoint effective force after governance cost tied) | preferred: wf-high-force (High Force Template) | policy: tight workflow_tightness, strong oversight, branch_budget=1 | governance_pressure_score: 1228 | effective_force_score: 27 | compared: wf-low-force (Low Force Template) | policy: tight workflow_tightness, strong oversight, branch_budget=1 | governance_pressure_score: 1228 | effective_force_score: 12',
    );
    assert.equal(describeGovernanceSelectionContext(null), 'none');
  });

  it('assigns lower governance pressure when more branch budget remains under the same policy envelope', () => {
    const lowBudgetCheckpoint = buildCheckpoint();
    lowBudgetCheckpoint.data.policy_snapshot.branch_budget = 1;

    const higherBudgetCheckpoint = buildCheckpoint();
    higherBudgetCheckpoint.id = 'cp-mainline-policy-roomier';
    higherBudgetCheckpoint.data.policy_snapshot.branch_budget = 5;

    assert.equal(
      checkpointGovernancePressureState(higherBudgetCheckpoint).governancePressureScore
      < checkpointGovernancePressureState(lowBudgetCheckpoint).governancePressureScore,
      true,
    );
  });

  it('computes effective force from lineage progress evidence accumulation and synthesis composability', () => {
    const { synthesized, checkpoints } = buildCheckpointGraph();
    synthesized.data.evidence_refs = [
      { kind: 'artifact', ref: 'artifacts/branch-a.json', digest: 'sha:a' },
      { kind: 'artifact', ref: 'artifacts/branch-b.json', digest: 'sha:b' },
    ];

    assert.deepEqual(checkpointEffectiveForceState(synthesized, checkpoints), {
      checkpointId: 'cp-synth',
      branchId: 'main.synth',
      adoptionStatus: 'synthesized',
      workflowTightness: 'balanced',
      oversightStrength: 'normal',
      branchBudget: null,
      replayStatus: 'idle',
      evidenceCount: 2,
      lineageDepth: 4,
      divergenceScore: 3,
      composabilityScore: 2,
      governancePressureScore: 0,
      evidenceMomentum: 16,
      progressMomentum: 18,
      composabilityBoost: 10,
      adoptionBoost: 4,
      divergenceDrag: 12,
      constraintDrag: 0,
      replayFriction: 0,
      effectiveForceScore: 36,
    });
  });

  it('normalizes replay state and deduplicates evidence refs before scoring effective force', () => {
    const checkpoint = buildCheckpoint();
    checkpoint.id = ' cp-force-normalized ';
    checkpoint.data.branch_id = ' mainline ';
    checkpoint.data.adoption_status = ' mainline ';
    checkpoint.data.policy_snapshot.workflow_tightness = ' balanced ';
    checkpoint.data.policy_snapshot.oversight_strength = ' normal ';
    checkpoint.data.policy_snapshot.branch_budget = null;
    checkpoint.data.replay_state = { status: ' completed ' };
    checkpoint.data.evidence_refs = [
      { kind: ' artifact ', ref: ' evidence/summary.json ', digest: ' sha:1 ' },
      { kind: 'artifact', ref: 'evidence/summary.json', digest: 'sha:1' },
      { kind: 'note', ref: ' notes/checkpoint.md ', digest: null },
    ];

    assert.deepEqual(checkpointEffectiveForceState(checkpoint), {
      checkpointId: 'cp-force-normalized',
      branchId: 'mainline',
      adoptionStatus: 'mainline',
      workflowTightness: 'balanced',
      oversightStrength: 'normal',
      branchBudget: null,
      replayStatus: 'completed',
      evidenceCount: 2,
      lineageDepth: 1,
      divergenceScore: 0,
      composabilityScore: 0,
      governancePressureScore: 0,
      evidenceMomentum: 16,
      progressMomentum: 0,
      composabilityBoost: 0,
      adoptionBoost: 8,
      divergenceDrag: 0,
      constraintDrag: 0,
      replayFriction: 2,
      effectiveForceScore: 22,
    });
  });

  it('discounts effective force when replay friction and governance constraints stack on the same branch', () => {
    const { leftContinued, checkpoints } = buildCheckpointGraph();
    leftContinued.data.adoption_status = 'mainline';
    leftContinued.data.evidence_refs = [
      { kind: 'artifact', ref: 'artifacts/left-continued.json', digest: 'sha:left' },
      { kind: 'note', ref: 'notes/left-continued.md', digest: null },
    ];

    const lowFriction = structuredClone(leftContinued);
    lowFriction.id = 'cp-left-low-friction';
    lowFriction.data.policy_snapshot = {
      workflow_tightness: 'balanced',
      oversight_strength: 'normal',
      branch_budget: null,
      notes: null,
    };
    lowFriction.data.replay_state = { status: 'idle' };

    const constrained = structuredClone(leftContinued);
    constrained.id = 'cp-left-constrained';
    constrained.data.policy_snapshot = {
      workflow_tightness: 'tight',
      oversight_strength: 'strong',
      branch_budget: 1,
      notes: 'Tight governance carryover.',
    };
    constrained.data.replay_state = { status: 'requested' };

    assert.equal(checkpointEffectiveForceState(lowFriction, checkpoints).effectiveForceScore, 32);
    assert.equal(checkpointEffectiveForceState(constrained, checkpoints).effectiveForceScore, 3);
    assert.equal(
      checkpointEffectiveForceState(constrained, checkpoints).effectiveForceScore
      < checkpointEffectiveForceState(lowFriction, checkpoints).effectiveForceScore,
      true,
    );
  });

  it('requires failed status before automatic reuse is governance-blocked', () => {
    const workflowRun = buildWorkflowRun();
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), true);

    workflowRun.status = 'completed';
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), false);
  });
});
