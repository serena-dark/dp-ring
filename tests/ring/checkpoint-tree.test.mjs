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

describe('checkpoint tree groundwork', async () => {
  const validator = await createValidator(ringDir);

  it('accepts a valid checkpoint document', () => {
    const checkpoint = createBaseCheckpoint();
    const result = validator.validate('checkpoint', checkpoint);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });

  it('accepts a valid branch-event document', () => {
    const event = {
      id: 'be-checkpoint-created',
      type: 'branch-event',
      version: 1,
      created_at: '2026-04-17T00:00:00Z',
      updated_at: '2026-04-17T00:00:00Z',
      created_by: 'test-agent',
      session_id: null,
      status: 'recorded',
      data: {
        event_type: 'checkpoint_created',
        branch_id: 'main',
        checkpoint_id: 'cp-root',
        actor: 'test-agent',
        occurred_at: '2026-04-17T00:00:00Z',
        details: {
          parent_checkpoint_id: null,
          synthesis_inputs: [],
          reason: null,
        },
      },
    };
    const result = validator.validate('branch-event', event);
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
    });
    const right = forkCheckpoint(root, {
      id: 'cp-right',
      created_by: 'agent-right',
      branch_id: 'right',
      evidence_refs: [{ kind: 'doc', ref: 'doc:right', digest: 'b2' }],
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

    const result = validator.validate('checkpoint', synthesized);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  });
});
