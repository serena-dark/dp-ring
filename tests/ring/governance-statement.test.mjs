import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import {
  canonicalizeGovernanceValue,
  createBranchCommitStatement,
  createGovernanceStatement,
} from '../../ring/lib/governance-statement.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

describe('governance statement', async () => {
  const validator = await createValidator(ringDir);

  it('canonicalizes nested predicate bodies deterministically before digesting them', () => {
    const left = canonicalizeGovernanceValue({
      z: 1,
      a: {
        beta: true,
        alpha: ['x', { y: 2, x: 1 }],
      },
    });
    const right = canonicalizeGovernanceValue({
      a: {
        alpha: ['x', { x: 1, y: 2 }],
        beta: true,
      },
      z: 1,
    });

    assert.equal(left, right);
    assert.equal(left, '{"a":{"alpha":["x",{"x":1,"y":2}],"beta":true},"z":1}');
  });

  it('creates a valid governance statement with immutable subject descriptors and canonical digests', () => {
    const statement = createGovernanceStatement({
      predicateType: 'https://dp-ring.dev/predicate/checkpoint-publication/v1',
      predicate: {
        status: 'published',
        checkpoint_id: 'cp-root',
        evidence: [
          { ref: 'docs/tasks/reviews/t1.md', kind: 'summary' },
        ],
      },
      subjects: [
        {
          name: 'checkpoint-publication/cp-root',
          mediaType: 'application/vnd.dp-ring.checkpoint-publication+json',
          body: {
            checkpoint_id: 'cp-root',
            branch_id: 'main',
            output_ref: 'docs/tasks/reviews/t1.md',
          },
          locator: {
            checkpoint_id: 'cp-root',
            branch_id: 'main',
          },
        },
      ],
    });

    const { valid, errors } = validator.validate('governance-statement', statement);
    assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    assert.match(statement.subject[0].digest, /^sha256:/);
    assert.ok(statement.subject[0].size > 0);
    assert.match(statement.canonicalization.predicate_digest, /^sha256:/);
  });

  it('builds commit statements for branch-event decisions from tree lineage context', () => {
    const statement = createBranchCommitStatement({
      event_type: 'checkpoint_created',
      branch_id: 'main',
      checkpoint_id: 'cp-root',
      actor: 'session-runner',
      occurred_at: '2026-04-17T00:00:00Z',
      parent_checkpoint_id: null,
      synthesis_inputs: [],
      reason: null,
    });

    assert.equal(statement.predicateType, 'https://dp-ring.dev/predicate/branch-event-commit/v1');
    assert.equal(statement.predicate.decision.event_type, 'checkpoint_created');
    assert.equal(statement.predicate.context.branch_id, 'main');
    assert.match(statement.subject[0].digest, /^sha256:/);
    assert.match(statement.canonicalization.subject_digest, /^sha256:/);
  });
});
