import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireLease,
  attachEvidence,
  completeReplay,
  createEmptyCapsuleState,
  expireLease,
  leaseExpired,
  recordCheckpoint,
  recordHeartbeat,
  renewLease,
  requestReplay,
} from '../../ring/lib/node-capsule.mjs';

describe('node capsule', () => {
  it('creates an empty node-centered capsule state with semantic replay defaults', () => {
    const state = createEmptyCapsuleState({ node_id: 'node-1' });

    assert.equal(state.schema_version, 'ring.node-capsule.v1');
    assert.equal(state.node_id, 'node-1');
    assert.deepEqual(state.lease, {
      holder: null,
      expires_at: null,
      acquired_at: null,
      renewed_at: null,
      released_at: null,
      fence_token: 0,
    });
    assert.deepEqual(state.heartbeat, {
      recorded_at: null,
      detail: null,
    });
    assert.equal(state.runtime_status, 'idle');
    assert.equal(state.current_checkpoint_id, null);
    assert.equal(state.last_checkpoint_at, null);
    assert.deepEqual(state.last_accepted_evidence_refs, []);
    assert.equal(state.replay.status, 'idle');
    assert.deepEqual(state.replay.journal_state, {
      mode: 'semantic',
      last_applied_entry_id: null,
      pending_entry_ids: [],
    });
    assert.deepEqual(state.journal, []);
  });

  it('normalizes blank nullable node identity and replay actor fields to null', () => {
    const state = createEmptyCapsuleState({
      node_id: '   ',
      replay: {
        requested_by: '   ',
      },
    });

    assert.equal(state.node_id, null);
    assert.equal(state.replay.requested_by, null);

    const requested = requestReplay(state, {
      now: '2026-04-17T14:00:00.000Z',
      requested_by: '   ',
      reason: 'operator requested replay',
    });

    assert.equal(requested.replay.requested_by, null);
    assert.equal(requested.journal.at(-1).requested_by, null);
  });

  it('normalizes blank checkpoint lineage ids to null before persistence', () => {
    const state = createEmptyCapsuleState({
      node_id: 'node-replay-lineage',
      current_checkpoint_id: '   ',
      replay: {
        source_checkpoint_id: '   ',
        target_checkpoint_id: '',
      },
    });

    assert.equal(state.current_checkpoint_id, null);
    assert.equal(state.replay.source_checkpoint_id, null);
    assert.equal(state.replay.target_checkpoint_id, null);

    const requested = requestReplay(createEmptyCapsuleState({
      node_id: 'node-replay-lineage',
      current_checkpoint_id: 'cp-current',
    }), {
      now: '2026-04-17T14:00:00.000Z',
      requested_by: 'session-runner',
      reason: 'resume semantic replay',
      source_checkpoint_id: '   ',
      target_checkpoint_id: '',
    });

    assert.equal(requested.replay.source_checkpoint_id, null);
    assert.equal(requested.replay.target_checkpoint_id, null);
    assert.equal(requested.journal.at(-1).source_checkpoint_id, null);
    assert.equal(requested.journal.at(-1).target_checkpoint_id, null);

    const completed = completeReplay(requested, {
      now: '2026-04-17T14:01:00.000Z',
      checkpoint_id: '   ',
    });

    assert.equal(completed.current_checkpoint_id, null);
    assert.equal(completed.replay.target_checkpoint_id, null);
    assert.equal(completed.journal.at(-1).checkpoint_id, null);
  });

  it('normalizes blank replay reasons to null while preserving meaningful replay rationale', () => {
    const state = createEmptyCapsuleState({
      replay: {
        reason: '   ',
      },
    });

    assert.equal(state.replay.reason, null);

    const requested = requestReplay(state, {
      now: '2026-04-17T14:00:00.000Z',
      requested_by: 'session-runner',
      reason: '   ',
    });

    assert.equal(requested.replay.reason, null);
    assert.equal(requested.journal.at(-1).reason, null);

    const meaningful = requestReplay(state, {
      now: '2026-04-17T14:01:00.000Z',
      requested_by: 'session-runner',
      reason: 'warm timeout lineage requested semantic replay',
    });

    assert.equal(meaningful.replay.reason, 'warm timeout lineage requested semantic replay');
    assert.equal(meaningful.journal.at(-1).reason, 'warm timeout lineage requested semantic replay');
  });

  it('normalizes blank replay journal state fields before persistence', () => {
    const state = createEmptyCapsuleState({
      replay: {
        journal_state: {
          mode: '   ',
          last_applied_entry_id: '   ',
          pending_entry_ids: ['journal-1', '   ', 'journal-2'],
        },
      },
    });

    assert.deepEqual(state.replay.journal_state, {
      mode: 'semantic',
      last_applied_entry_id: null,
      pending_entry_ids: ['journal-1', 'journal-2'],
    });

    const requested = requestReplay(state, {
      now: '2026-04-17T14:00:00.000Z',
      requested_by: 'session-runner',
      reason: 'resume semantic replay',
      journal_state: {
        mode: ' semantic-replay ',
        last_applied_entry_id: ' journal-3 ',
        pending_entry_ids: [' journal-4 ', '   '],
      },
    });

    assert.deepEqual(requested.replay.journal_state, {
      mode: 'semantic-replay',
      last_applied_entry_id: 'journal-3',
      pending_entry_ids: ['journal-4'],
    });
  });

  it('acquires, renews, and expires leases with holder ownership checks', () => {
    const initial = createEmptyCapsuleState({ node_id: 'node-lease' });
    const acquired = acquireLease(initial, 'worker-a', {
      now: '2026-04-17T14:00:00.000Z',
      ttl_ms: 60_000,
    });

    assert.equal(acquired.runtime_status, 'leased');
    assert.equal(acquired.lease.holder, 'worker-a');
    assert.equal(acquired.lease.acquired_at, '2026-04-17T14:00:00.000Z');
    assert.equal(acquired.lease.renewed_at, '2026-04-17T14:00:00.000Z');
    assert.equal(acquired.lease.expires_at, '2026-04-17T14:01:00.000Z');
    assert.equal(acquired.lease.fence_token, 1);
    assert.equal(leaseExpired(acquired, { now: '2026-04-17T14:00:59.999Z' }), false);

    assert.throws(
      () =>
        acquireLease(acquired, 'worker-b', {
          now: '2026-04-17T14:00:30.000Z',
          ttl_ms: 60_000,
        }),
      /Lease is already held by "worker-a"/,
    );

    const renewed = renewLease(acquired, 'worker-a', {
      now: '2026-04-17T14:00:45.000Z',
      ttl_ms: 60_000,
    });

    assert.equal(renewed.lease.renewed_at, '2026-04-17T14:00:45.000Z');
    assert.equal(renewed.lease.expires_at, '2026-04-17T14:01:45.000Z');
    assert.equal(renewed.lease.fence_token, 1);
    assert.equal(leaseExpired(renewed, { now: '2026-04-17T14:01:45.000Z' }), true);

    const expired = expireLease(renewed, {
      now: '2026-04-17T14:01:46.000Z',
      reason: 'heartbeat_timeout',
    });

    assert.equal(expired.runtime_status, 'idle');
    assert.equal(expired.lease.holder, null);
    assert.equal(expired.lease.expires_at, '2026-04-17T14:01:46.000Z');
    assert.equal(expired.lease.released_at, '2026-04-17T14:01:46.000Z');
    assert.equal(expired.journal.at(-1).event, 'lease_expired');
    assert.equal(expired.journal.at(-1).reason, 'heartbeat_timeout');
  });

  it('records heartbeats without disturbing the current semantic checkpoint', () => {
    const checkpointed = recordCheckpoint(
      createEmptyCapsuleState({ node_id: 'node-heartbeat' }),
      'cp-1',
      { now: '2026-04-17T14:05:00.000Z' },
    );

    const heartbeating = recordHeartbeat(checkpointed, {
      now: '2026-04-17T14:05:10.000Z',
      runtime_status: 'running',
      detail: {
        phase: 'execute',
        step: 'apply-patch',
      },
    });

    assert.equal(heartbeating.current_checkpoint_id, 'cp-1');
    assert.equal(heartbeating.runtime_status, 'running');
    assert.equal(heartbeating.heartbeat.recorded_at, '2026-04-17T14:05:10.000Z');
    assert.deepEqual(heartbeating.heartbeat.detail, {
      phase: 'execute',
      step: 'apply-patch',
    });
    assert.equal(heartbeating.journal.at(-1).event, 'heartbeat_recorded');
  });

  it('attaches accepted evidence refs and deduplicates repeated attachments', () => {
    const checkpointed = recordCheckpoint(
      createEmptyCapsuleState({ node_id: 'node-evidence' }),
      'cp-evidence-1',
      { now: '2026-04-17T14:10:00.000Z' },
    );

    const withEvidence = attachEvidence(
      checkpointed,
      ['evidence://stdout/1', 'evidence://stderr/1', 'evidence://stdout/1'],
      {
        now: '2026-04-17T14:10:05.000Z',
      },
    );

    assert.equal(withEvidence.current_checkpoint_id, 'cp-evidence-1');
    assert.equal(withEvidence.last_evidence_at, '2026-04-17T14:10:05.000Z');
    assert.deepEqual(withEvidence.last_accepted_evidence_refs, [
      'evidence://stdout/1',
      'evidence://stderr/1',
    ]);
    assert.equal(withEvidence.journal.at(-1).event, 'evidence_attached');
  });

  it('tracks replay requests and completion using semantic checkpoint and journal state', () => {
    const checkpointed = recordCheckpoint(
      createEmptyCapsuleState({ node_id: 'node-replay' }),
      'cp-before-replay',
      { now: '2026-04-17T14:15:00.000Z' },
    );

    const replayRequested = requestReplay(checkpointed, {
      now: '2026-04-17T14:15:05.000Z',
      requested_by: 'recovery-controller',
      reason: 'lease holder changed during execution',
      source_checkpoint_id: 'cp-before-replay',
      target_checkpoint_id: 'cp-after-replay',
      cursor: {
        journal_index: 12,
      },
      journal_state: {
        last_applied_entry_id: 'j-12',
        pending_entry_ids: ['j-13', 'j-14'],
      },
    });

    assert.equal(replayRequested.runtime_status, 'recovering');
    assert.equal(replayRequested.replay.status, 'requested');
    assert.equal(replayRequested.replay.requested_at, '2026-04-17T14:15:05.000Z');
    assert.equal(replayRequested.replay.requested_by, 'recovery-controller');
    assert.equal(replayRequested.replay.reason, 'lease holder changed during execution');
    assert.equal(replayRequested.replay.source_checkpoint_id, 'cp-before-replay');
    assert.equal(replayRequested.replay.target_checkpoint_id, 'cp-after-replay');
    assert.deepEqual(replayRequested.replay.cursor, {
      journal_index: 12,
    });
    assert.deepEqual(replayRequested.replay.journal_state, {
      mode: 'semantic',
      last_applied_entry_id: 'j-12',
      pending_entry_ids: ['j-13', 'j-14'],
    });
    assert.equal(replayRequested.journal.at(-1).event, 'replay_requested');

    const replayCompleted = completeReplay(replayRequested, {
      now: '2026-04-17T14:15:20.000Z',
      checkpoint_id: 'cp-after-replay',
      cursor: {
        journal_index: 14,
      },
      journal_state: {
        last_applied_entry_id: 'j-14',
        pending_entry_ids: [],
      },
      evidence_refs: ['evidence://replay/summary'],
    });

    assert.equal(replayCompleted.runtime_status, 'idle');
    assert.equal(replayCompleted.current_checkpoint_id, 'cp-after-replay');
    assert.equal(replayCompleted.last_checkpoint_at, '2026-04-17T14:15:20.000Z');
    assert.equal(replayCompleted.replay.status, 'completed');
    assert.equal(replayCompleted.replay.completed_at, '2026-04-17T14:15:20.000Z');
    assert.deepEqual(replayCompleted.replay.cursor, {
      journal_index: 14,
    });
    assert.deepEqual(replayCompleted.replay.journal_state, {
      mode: 'semantic',
      last_applied_entry_id: 'j-14',
      pending_entry_ids: [],
    });
    assert.deepEqual(replayCompleted.last_accepted_evidence_refs, ['evidence://replay/summary']);
    assert.equal(replayCompleted.journal.at(-1).event, 'replay_completed');
  });
});
