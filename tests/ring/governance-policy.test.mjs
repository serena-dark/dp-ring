import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticReusePolicyGovernancePressureScore,
  checkpointAutomaticReuseSelectionPolicy,
  checkpointAutomaticReusePolicyState,
  checkpointBranchMetricsState,
  checkpointEffectiveForceState,
  checkpointGovernancePressureState,
  compareAutomaticReusePolicies,
  describeAutomaticReusePolicy,
  normalizeWorkflowReuseGovernanceBlock,
  warmSemanticLineageState,
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
