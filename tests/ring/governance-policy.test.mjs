import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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

  it('requires failed status before automatic reuse is governance-blocked', () => {
    const workflowRun = buildWorkflowRun();
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), true);

    workflowRun.status = 'completed';
    assert.equal(workflowRunRequiresExplicitWorkflowReuse(workflowRun), false);
  });
});
