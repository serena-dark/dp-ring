import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

describe('validator', async () => {
  const validator = await createValidator(ringDir);

  describe('validate() — valid documents', () => {
    it('accepts a valid requirement', () => {
      const doc = {
        id: 'r1-test', type: 'requirement', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'draft',
        data: { name: 'Test', description: 'A test requirement', acceptance_criteria: [], priority: 'medium' },
      };
      const { valid, errors } = validator.validate('requirement', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid session', () => {
      const doc = {
        id: 's1-test', type: 'session', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-test', status: 'gate_pending',
        data: {
          requirement_id: 'r1-test', milestone_id: 'r1m1-test',
          task_ids: [], workflow_run_ids: [],
          evaluation_id: null, distillation_id: null,
          execution_log: [],
        },
      };
      const { valid, errors } = validator.validate('session', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid task', () => {
      const doc = {
        id: 't1-test', type: 'task', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'pending',
        data: {
          name: 'Test Task', description: 'A test', task_type: 'feature-implementation',
          requirement_id: 'r1-test', milestone_id: 'r1m1-test',
          acceptance_criteria: [{ id: 'ac1', description: 'It works', satisfied: false }],
        },
      };
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid evaluation', () => {
      const doc = {
        id: 'eval-test', type: 'evaluation', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-test', status: 'draft',
        data: {
          session_id: 's1-test', outcome: 'success',
          scores: { correctness: 0.9, completeness: 0.8, efficiency: 0.7, adherence: 1.0, reusability: 0.5 },
          composite_score: 0.82, score_weights: { correctness: 0.3, completeness: 0.25, efficiency: 0.2, adherence: 0.15, reusability: 0.1 },
          evidence: { tests_passed: 10, tests_failed: 0, build_status: 'success' },
          evaluator: 'automated',
        },
      };
      const { valid, errors } = validator.validate('evaluation', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid feedback', () => {
      const doc = {
        id: 'fb-1-test', type: 'feedback', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'open',
        data: {
          severity: 'major', category: 'requirement_gap',
          target: { type: 'requirement', id: 'r1-test', field: null },
          description: 'Missing acceptance criterion for edge case.',
          proposed_action: 'Add criterion for empty input.',
        },
      };
      const { valid, errors } = validator.validate('feedback', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });
  });

  describe('validate() — invalid documents', () => {
    it('rejects a requirement with missing data.name', () => {
      const doc = {
        id: 'r1-bad', type: 'requirement', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'draft',
        data: { description: 'No name', acceptance_criteria: [], priority: 'medium' },
      };
      const { valid } = validator.validate('requirement', doc);
      assert.equal(valid, false);
    });

    it('rejects a session with invalid status', () => {
      const doc = {
        id: 's1-bad', type: 'session', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-bad', status: 'invalid_status',
        data: { requirement_id: 'r1', milestone_id: 'm1', task_ids: [], workflow_run_ids: [], execution_log: [] },
      };
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a task with invalid id prefix', () => {
      const doc = {
        id: 'bad-prefix', type: 'task', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'pending',
        data: {
          name: 'Bad', description: 'Bad prefix', task_type: 'bug-fix',
          requirement_id: 'r1', milestone_id: 'm1', acceptance_criteria: [],
        },
      };
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects an evaluation with score > 1', () => {
      const doc = {
        id: 'eval-bad', type: 'evaluation', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1', status: 'draft',
        data: {
          session_id: 's1', outcome: 'success',
          scores: { correctness: 1.5, completeness: 0.8, efficiency: 0.7, adherence: 1.0, reusability: 0.5 },
          composite_score: 0.9, score_weights: { correctness: 0.3, completeness: 0.25, efficiency: 0.2, adherence: 0.15, reusability: 0.1 },
          evidence: {}, evaluator: 'human',
        },
      };
      const { valid } = validator.validate('evaluation', doc);
      assert.equal(valid, false);
    });

    it('returns error for unknown type', () => {
      const { valid, errors } = validator.validate('nonexistent', {});
      assert.equal(valid, false);
      assert.ok(errors[0].message.includes('Unknown artifact type'));
    });
  });

  describe('getSchema()', () => {
    it('returns schema for known types', () => {
      const schema = validator.getSchema('session');
      assert.ok(schema);
      assert.equal(schema.title, 'Session');
    });

    it('returns null for unknown type', () => {
      assert.equal(validator.getSchema('nonexistent'), null);
    });
  });
});
