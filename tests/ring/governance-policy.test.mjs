import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkpointAutomaticReusePolicyState,
  checkpointGovernancePressureState,
  warmSemanticLineageState,
  workflowRunRequiresExplicitWorkflowReuse,
} from '../../ring/lib/governance-policy.mjs';

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

  it('requires failed status before automatic reuse is governance-blocked', () => {
    const workflowRun = buildWorkflowRun();
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), true);

    workflowRun.status = 'completed';
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), false);
  });
});
