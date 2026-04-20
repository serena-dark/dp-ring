import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import {
  adoptBranch,
  continueFromCheckpoint,
  createCheckpoint,
  discardBranch,
  forkCheckpoint,
  lineageForCheckpoint,
  synthesizeCheckpoint,
} from '../../ring/lib/checkpoint-tree.mjs';
import { createBranchCommitStatement } from '../../ring/lib/governance-statement.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

function createBaseCheckpoint(overrides = {}) {
  return createCheckpoint({
    id: 'cp-root',
    created_by: 'test-agent',
    branch_id: 'main',
    node_id: 'n1-router',
    scope_ref: { kind: 'task', id: 't1-example', path: 'docs/tasks/t1-example/t1-example.md' },
    execution_cursor: { phase: 'dispatch', step_id: 'dispatch-1', ordinal: 0 },
    evidence_refs: [{ kind: 'summary', ref: 'docs/tasks/reviews/t1.md', digest: null }],
    ...overrides,
  });
}

function createBaseBranchEvent(overrides = {}) {
  const { data: dataOverrides = {}, ...eventOverrides } = overrides;
  return {
    id: 'be-checkpoint-created',
    type: 'branch-event',
    version: 1,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    created_by: 'test-agent',
    session_id: null,
    status: 'recorded',
    ...eventOverrides,
    data: {
      event_type: 'checkpoint_created',
      message_class: 'commit',
      branch_id: 'main',
      checkpoint_id: 'cp-root',
      actor: 'test-agent',
      occurred_at: '2026-04-17T00:00:00Z',
      statement: createBranchCommitStatement({
        event_type: 'checkpoint_created',
        branch_id: 'main',
        checkpoint_id: 'cp-root',
        actor: 'test-agent',
        occurred_at: '2026-04-17T00:00:00Z',
        parent_checkpoint_id: null,
        synthesis_inputs: [],
        reason: null,
      }),
      details: {
        parent_checkpoint_id: null,
        synthesis_inputs: [],
        reason: null,
      },
      ...dataOverrides,
    },
  };
}

describe('checkpoint tree groundwork', async () => {
  const validator = await createValidator(ringDir);

  it('accepts a valid checkpoint document', () => {
    const checkpoint = createBaseCheckpoint();
    const result = validator.validate('checkpoint', checkpoint);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  it('accepts a valid branch-event document', () => {
    const event = createBaseBranchEvent();
    const result = validator.validate('branch-event', event);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  it('accepts optional governance linkage fields on checkpoint and branch-event documents', () => {
    const checkpoint = createBaseCheckpoint();
    Object.assign(checkpoint.data, {
      publication_root_id: 'pr-checkpoint-cp-root',
      validation_report_id: 'vrpt-checkpoint-cp-root',
      trace_id: 'trace-checkpoint-cp-root',
      span_id: 'span-checkpoint-cp-root',
      parent_span_id: 'span-checkpoint-parent',
    });

    const event = createBaseBranchEvent({
      data: {
        publication_root_id: 'pr-branch-decision-main',
        validation_report_id: 'vrpt-branch-decision-main',
        trace_id: 'trace-branch-decision-main',
        span_id: 'span-branch-decision-main',
        parent_span_id: 'span-branch-parent',
      },
    });

    const checkpointResult = validator.validate('checkpoint', checkpoint);
    const eventResult = validator.validate('branch-event', event);

    assert.equal(checkpointResult.valid, true, JSON.stringify(checkpointResult.errors));
    assert.equal(eventResult.valid, true, JSON.stringify(eventResult.errors));
  });

  it('rejects invalid publication and validation linkage identifiers', () => {
    const checkpoint = createBaseCheckpoint();
    Object.assign(checkpoint.data, {
      publication_root_id: 'checkpoint-root',
      validation_report_id: 'report-root',
    });

    const event = createBaseBranchEvent({
      data: {
        publication_root_id: 'branch-root',
        validation_report_id: 'branch-report',
      },
    });

    const checkpointResult = validator.validate('checkpoint', checkpoint);
    const eventResult = validator.validate('branch-event', event);

    assert.equal(checkpointResult.valid, false);
    assert.match(JSON.stringify(checkpointResult.errors), /publication_root_id/);
    assert.match(JSON.stringify(checkpointResult.errors), /validation_report_id/);
    assert.equal(eventResult.valid, false);
    assert.match(JSON.stringify(eventResult.errors), /publication_root_id/);
    assert.match(JSON.stringify(eventResult.errors), /validation_report_id/);
  });

  it('threads governance linkage fields through helper-created checkpoints', () => {
    const root = createBaseCheckpoint({
      publication_root_id: 'pr-root-checkpoint',
      validation_report_id: 'vrpt-root-checkpoint',
      trace_id: 'trace-root-checkpoint',
      span_id: 'span-root-checkpoint',
      parent_span_id: 'span-root-parent',
    });
    const continued = continueFromCheckpoint(root, {
      id: 'cp-main-linked',
      created_by: 'test-agent',
      execution_cursor: { phase: 'execute', step_id: 'work-linked', ordinal: 1 },
    });
    const forked = forkCheckpoint(root, {
      id: 'cp-branch-linked',
      created_by: 'test-agent',
      branch_id: 'branch-linked',
      execution_cursor: { phase: 'explore', step_id: 'work-branch-linked', ordinal: 1 },
      span_id: 'span-branch-linked',
      parent_span_id: root.data.span_id,
    });
    const synthesized = synthesizeCheckpoint([continued, forked], {
      id: 'cp-synth-linked',
      created_by: 'test-agent',
      branch_id: 'main.synth-linked',
      execution_cursor: { phase: 'synthesize', step_id: 'merge-linked', ordinal: 2 },
      validation_report_id: 'vrpt-synth-linked',
      span_id: 'span-synth-linked',
      parent_span_id: forked.data.span_id,
    });

    assert.equal(root.data.publication_root_id, 'pr-root-checkpoint');
    assert.equal(root.data.validation_report_id, 'vrpt-root-checkpoint');
    assert.equal(root.data.trace_id, 'trace-root-checkpoint');
    assert.equal(root.data.span_id, 'span-root-checkpoint');
    assert.equal(root.data.parent_span_id, 'span-root-parent');

    assert.equal(continued.data.publication_root_id, root.data.publication_root_id);
    assert.equal(continued.data.validation_report_id, root.data.validation_report_id);
    assert.equal(continued.data.trace_id, root.data.trace_id);
    assert.equal(continued.data.span_id, root.data.span_id);
    assert.equal(continued.data.parent_span_id, root.data.parent_span_id);

    assert.equal(forked.data.publication_root_id, root.data.publication_root_id);
    assert.equal(forked.data.validation_report_id, root.data.validation_report_id);
    assert.equal(forked.data.trace_id, root.data.trace_id);
    assert.equal(forked.data.span_id, 'span-branch-linked');
    assert.equal(forked.data.parent_span_id, root.data.span_id);

    assert.equal(synthesized.data.publication_root_id, root.data.publication_root_id);
    assert.equal(synthesized.data.validation_report_id, 'vrpt-synth-linked');
    assert.equal(synthesized.data.trace_id, root.data.trace_id);
    assert.equal(synthesized.data.span_id, 'span-synth-linked');
    assert.equal(synthesized.data.parent_span_id, forked.data.span_id);

    const result = validator.validate('checkpoint', synthesized);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  it('preserves lineage across continue and fork', () => {
    const root = createBaseCheckpoint();
    const continued = continueFromCheckpoint(root, {
      id: 'cp-main-1',
      created_by: 'test-agent',
      execution_cursor: { phase: 'execute', step_id: 'work-1', ordinal: 1 },
    });
    const forked = forkCheckpoint(root, {
      id: 'cp-branch-a',
      created_by: 'test-agent',
      branch_id: 'branch-a',
      execution_cursor: { phase: 'explore', step_id: 'work-a', ordinal: 1 },
    });

    assert.equal(continued.data.parent_checkpoint_id, root.id);
    assert.equal(continued.data.branch_id, 'main');
    assert.equal(forked.data.parent_checkpoint_id, root.id);
    assert.equal(forked.data.branch_id, 'branch-a');

    const lineage = lineageForCheckpoint([root, continued, forked], continued.id);
    assert.deepEqual(lineage.map((item) => item.id), ['cp-root', 'cp-main-1']);
  });

  it('adopts and discards branches explicitly', () => {
    const root = createBaseCheckpoint();
    const forked = forkCheckpoint(root, {
      id: 'cp-branch-b',
      created_by: 'test-agent',
      branch_id: 'branch-b',
    });

    const adopted = adoptBranch(forked);
    assert.equal(adopted.status, 'mainline');
    assert.equal(adopted.data.adoption_status, 'mainline');

    const discarded = discardBranch(forked);
    assert.equal(discarded.status, 'discarded');
    assert.equal(discarded.data.adoption_status, 'discarded');
    assert.equal(discarded.data.replay_state.status, 'idle');
  });

  it('creates synthesized checkpoints from multiple inputs', () => {
    const root = createBaseCheckpoint();
    const left = forkCheckpoint(root, {
      id: 'cp-left',
      created_by: 'agent-left',
      branch_id: 'left',
      evidence_refs: [{ kind: 'doc', ref: 'doc:left', digest: 'a1' }],
      policy_snapshot: {
        workflow_tightness: 'tight',
        oversight_strength: 'normal',
        branch_budget: 0,
        notes: 'Left branch already exhausted its branch budget.',
      },
    });
    const right = forkCheckpoint(root, {
      id: 'cp-right',
      created_by: 'agent-right',
      branch_id: 'right',
      evidence_refs: [{ kind: 'doc', ref: 'doc:right', digest: 'b2' }],
      policy_snapshot: {
        workflow_tightness: 'balanced',
        oversight_strength: 'strong',
        branch_budget: 2,
        notes: 'Right branch required stronger oversight for review.',
      },
    });

    const synthesized = synthesizeCheckpoint([left, right], {
      id: 'cp-synth',
      created_by: 'judge-agent',
      branch_id: 'main.synth',
      execution_cursor: { phase: 'synthesize', step_id: 'merge-1', ordinal: 2 },
    });

    assert.equal(synthesized.status, 'synthesized');
    assert.equal(synthesized.data.adoption_status, 'synthesized');
    assert.deepEqual(synthesized.data.synthesis_inputs, ['cp-left', 'cp-right']);
    assert.equal(synthesized.data.evidence_refs.length, 2);
    assert.equal(synthesized.data.policy_snapshot.workflow_tightness, 'tight');
    assert.equal(synthesized.data.policy_snapshot.oversight_strength, 'strong');
    assert.equal(synthesized.data.policy_snapshot.branch_budget, 0);
    assert.match(synthesized.data.policy_snapshot.notes ?? '', /Left branch already exhausted its branch budget\./);
    assert.match(synthesized.data.policy_snapshot.notes ?? '', /Right branch required stronger oversight for review\./);

    const result = validator.validate('checkpoint', synthesized);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
});
