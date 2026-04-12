import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { checkTransition, validNextStatuses, extractStateMachine } from '../../ring/lib/state-machine.mjs';
import { createValidator } from '../../ring/lib/validator.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

describe('state-machine', async () => {
  const validator = await createValidator(ringDir);

  describe('extractStateMachine()', () => {
    it('extracts from session schema', () => {
      const schema = validator.getSchema('session');
      const sm = extractStateMachine(schema);
      assert.ok(sm);
      assert.equal(sm.field, 'status');
      assert.ok(sm.transitions.gate_pending);
    });

    it('returns null for schema without state machine', () => {
      assert.equal(extractStateMachine({}), null);
      assert.equal(extractStateMachine(null), null);
    });
  });

  describe('checkTransition() — session', () => {
    const schema = validator.getSchema('session');

    it('allows gate_pending → preparing', () => {
      const r = checkTransition(schema, 'gate_pending', 'preparing');
      assert.equal(r.allowed, true);
    });

    it('allows gate_pending → failed', () => {
      const r = checkTransition(schema, 'gate_pending', 'failed');
      assert.equal(r.allowed, true);
    });

    it('allows failed → gate_pending (retry)', () => {
      const r = checkTransition(schema, 'failed', 'gate_pending');
      assert.equal(r.allowed, true);
    });

    it('allows reviewing → executing (loop back)', () => {
      const r = checkTransition(schema, 'reviewing', 'executing');
      assert.equal(r.allowed, true);
    });

    it('rejects gate_pending → closed (skip)', () => {
      const r = checkTransition(schema, 'gate_pending', 'closed');
      assert.equal(r.allowed, false);
      assert.ok(r.reason.includes('not allowed'));
    });

    it('rejects closed → executing (terminal)', () => {
      const r = checkTransition(schema, 'closed', 'executing');
      assert.equal(r.allowed, false);
    });

    it('allows same-status (no-op)', () => {
      const r = checkTransition(schema, 'executing', 'executing');
      assert.equal(r.allowed, true);
    });
  });

  describe('checkTransition() — task', () => {
    const schema = validator.getSchema('task');

    it('allows pending → ready', () => {
      assert.equal(checkTransition(schema, 'pending', 'ready').allowed, true);
    });

    it('allows failed → pending (retry)', () => {
      assert.equal(checkTransition(schema, 'failed', 'pending').allowed, true);
    });

    it('rejects completed → anything', () => {
      assert.equal(checkTransition(schema, 'completed', 'pending').allowed, false);
      assert.equal(checkTransition(schema, 'completed', 'failed').allowed, false);
    });
  });

  describe('checkTransition() — feedback', () => {
    const schema = validator.getSchema('feedback');

    it('allows open → acknowledged', () => {
      assert.equal(checkTransition(schema, 'open', 'acknowledged').allowed, true);
    });

    it('allows resolved → open (reopen)', () => {
      assert.equal(checkTransition(schema, 'resolved', 'open').allowed, true);
    });
  });

  describe('validNextStatuses()', () => {
    it('returns valid targets for session gate_pending', () => {
      const schema = validator.getSchema('session');
      const next = validNextStatuses(schema, 'gate_pending');
      assert.deepEqual(next, ['preparing', 'failed']);
    });

    it('returns empty array for terminal state', () => {
      const schema = validator.getSchema('session');
      const next = validNextStatuses(schema, 'closed');
      assert.deepEqual(next, []);
    });
  });
});
