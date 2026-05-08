/**
 * Node capsule state transitions.
 *
 * The capsule is a lightweight runtime facade around node execution semantics:
 * leases, heartbeats, semantic checkpoints, evidence references, and replay.
 * It is intentionally implementation-agnostic and does not model a full VM.
 */

export const CAPSULE_SCHEMA_VERSION = 'ring.node-capsule.v1';
export const DEFAULT_LEASE_TTL_MS = 30_000;

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function toMilliseconds(value = new Date()) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  throw new TypeError('Expected a valid Date, timestamp, or ISO date string.');
}

function toIsoTimestamp(value = new Date()) {
  return new Date(toMilliseconds(value)).toISOString();
}

function plusMilliseconds(value, ttlMs) {
  return new Date(toMilliseconds(value) + ttlMs).toISOString();
}

function assertPositiveTtl(ttlMs) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new RangeError('Lease ttl_ms must be a positive number.');
  }
}

function assertLeaseHolder(holder) {
  if (typeof holder !== 'string' || holder.trim() === '') {
    throw new TypeError('Lease holder must be a non-empty string.');
  }
}

function evidenceKey(ref) {
  return typeof ref === 'string' ? `string:${ref}` : `json:${JSON.stringify(ref)}`;
}

function normalizeEvidenceRefs(refs) {
  const values = Array.isArray(refs) ? refs : refs == null ? [] : [refs];
  const normalized = [];
  const seen = new Set();
  for (const ref of values) {
    if (ref == null) {
      continue;
    }
    const copy = clone(ref);
    const key = evidenceKey(copy);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(copy);
  }
  return normalized;
}

function mergeEvidenceRefs(existingRefs, incomingRefs) {
  return normalizeEvidenceRefs([...(existingRefs ?? []), ...normalizeEvidenceRefs(incomingRefs)]);
}

function normalizeNullableString(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeJournalState(state = {}) {
  const base = clone(state ?? {});
  const mode = normalizeNullableString(base.mode);
  const lastAppliedEntryId = normalizeNullableString(base.last_applied_entry_id);
  const pendingEntryIds = Array.isArray(base.pending_entry_ids)
    ? base.pending_entry_ids
      .map((entryId) => normalizeNullableString(entryId))
      .filter((entryId) => typeof entryId === 'string')
    : [];

  return {
    mode: typeof mode === 'string' ? mode : 'semantic',
    last_applied_entry_id: typeof lastAppliedEntryId === 'string' ? lastAppliedEntryId : null,
    pending_entry_ids: pendingEntryIds,
  };
}

function normalizeReplayState(state = {}) {
  const base = clone(state ?? {});
  return {
    status: 'idle',
    requested_at: null,
    completed_at: null,
    source_checkpoint_id: null,
    target_checkpoint_id: null,
    ...base,
    requested_by: normalizeNullableString(base.requested_by),
    reason: normalizeNullableString(base.reason),
    cursor: clone(base.cursor ?? null),
    journal_state: normalizeJournalState(base.journal_state),
  };
}

function appendJournal(state, entry) {
  return {
    ...state,
    journal: [
      ...(state.journal ?? []),
      {
        ...clone(entry),
        timestamp: toIsoTimestamp(entry?.timestamp ?? new Date()),
      },
    ],
  };
}

function hasLease(state) {
  return Boolean(state?.lease?.holder && state?.lease?.expires_at);
}

export function leaseExpired(state, { now = new Date() } = {}) {
  if (!hasLease(state)) {
    return false;
  }
  return toMilliseconds(state.lease.expires_at) <= toMilliseconds(now);
}

export function createEmptyCapsuleState({
  node_id = null,
  runtime_status = 'idle',
  current_checkpoint_id = null,
  last_accepted_evidence_refs = [],
  replay = {},
} = {}) {
  return {
    schema_version: CAPSULE_SCHEMA_VERSION,
    node_id: normalizeNullableString(node_id),
    lease: {
      holder: null,
      expires_at: null,
      acquired_at: null,
      renewed_at: null,
      released_at: null,
      fence_token: 0,
    },
    heartbeat: {
      recorded_at: null,
      detail: null,
    },
    runtime_status,
    current_checkpoint_id,
    last_checkpoint_at: null,
    last_evidence_at: null,
    last_accepted_evidence_refs: normalizeEvidenceRefs(last_accepted_evidence_refs),
    replay: normalizeReplayState({
      source_checkpoint_id: current_checkpoint_id,
      target_checkpoint_id: current_checkpoint_id,
      ...replay,
    }),
    journal: [],
  };
}

export function recordCheckpoint(state, checkpointId, { now = new Date(), metadata = null } = {}) {
  if (typeof checkpointId !== 'string' || checkpointId.trim() === '') {
    throw new TypeError('Checkpoint id must be a non-empty string.');
  }
  const timestamp = toIsoTimestamp(now);
  return appendJournal(
    {
      ...state,
      current_checkpoint_id: checkpointId,
      last_checkpoint_at: timestamp,
    },
    {
      timestamp,
      event: 'checkpoint_recorded',
      checkpoint_id: checkpointId,
      metadata: clone(metadata),
    },
  );
}

export function acquireLease(
  state,
  holder,
  {
    now = new Date(),
    ttl_ms = DEFAULT_LEASE_TTL_MS,
    runtime_status = 'leased',
  } = {},
) {
  assertLeaseHolder(holder);
  assertPositiveTtl(ttl_ms);

  if (hasLease(state) && !leaseExpired(state, { now })) {
    throw new Error(
      `Lease is already held by "${state.lease.holder}" until ${state.lease.expires_at}.`,
    );
  }

  const timestamp = toIsoTimestamp(now);
  const nextLease = {
    ...state.lease,
    holder,
    expires_at: plusMilliseconds(now, ttl_ms),
    acquired_at: timestamp,
    renewed_at: timestamp,
    released_at: null,
    fence_token: (state.lease?.fence_token ?? 0) + 1,
  };

  return appendJournal(
    {
      ...state,
      runtime_status,
      lease: nextLease,
    },
    {
      timestamp,
      event: 'lease_acquired',
      holder,
      expires_at: nextLease.expires_at,
      fence_token: nextLease.fence_token,
    },
  );
}

export function renewLease(
  state,
  holder,
  {
    now = new Date(),
    ttl_ms = DEFAULT_LEASE_TTL_MS,
    runtime_status = state.runtime_status,
  } = {},
) {
  assertLeaseHolder(holder);
  assertPositiveTtl(ttl_ms);

  if (!hasLease(state) || state.lease.holder !== holder) {
    throw new Error(`Cannot renew lease: holder "${holder}" does not own the active lease.`);
  }
  if (leaseExpired(state, { now })) {
    throw new Error(`Cannot renew lease for "${holder}": the lease has already expired.`);
  }

  const timestamp = toIsoTimestamp(now);
  const nextLease = {
    ...state.lease,
    expires_at: plusMilliseconds(now, ttl_ms),
    renewed_at: timestamp,
  };

  return appendJournal(
    {
      ...state,
      runtime_status,
      lease: nextLease,
    },
    {
      timestamp,
      event: 'lease_renewed',
      holder,
      expires_at: nextLease.expires_at,
      fence_token: nextLease.fence_token,
    },
  );
}

export function expireLease(state, options = {}) {
  const timestamp = toIsoTimestamp(options.now ?? new Date());
  const runtimeStatus =
    options.runtime_status ?? (state.runtime_status === 'leased' ? 'idle' : state.runtime_status);
  const previousHolder = state.lease?.holder ?? null;

  const nextState = {
    ...state,
    runtime_status: runtimeStatus,
    lease: {
      ...state.lease,
      holder: null,
      expires_at: timestamp,
      released_at: timestamp,
    },
  };

  if (!previousHolder) {
    return nextState;
  }

  return appendJournal(nextState, {
    timestamp,
    event: 'lease_expired',
    holder: previousHolder,
    reason: options.reason ?? 'expired',
  });
}

export function recordHeartbeat(
  state,
  {
    now = new Date(),
    runtime_status = state.runtime_status,
    detail = null,
  } = {},
) {
  const timestamp = toIsoTimestamp(now);
  return appendJournal(
    {
      ...state,
      runtime_status,
      heartbeat: {
        ...state.heartbeat,
        recorded_at: timestamp,
        detail: clone(detail),
      },
    },
    {
      timestamp,
      event: 'heartbeat_recorded',
      runtime_status,
      detail: clone(detail),
    },
  );
}

export function attachEvidence(
  state,
  evidenceRefs,
  {
    now = new Date(),
    checkpoint_id = state.current_checkpoint_id,
  } = {},
) {
  const refs = normalizeEvidenceRefs(evidenceRefs);
  if (refs.length === 0) {
    throw new TypeError('At least one evidence reference is required.');
  }

  const timestamp = toIsoTimestamp(now);
  return appendJournal(
    {
      ...state,
      current_checkpoint_id: checkpoint_id,
      last_evidence_at: timestamp,
      last_accepted_evidence_refs: mergeEvidenceRefs(state.last_accepted_evidence_refs, refs),
    },
    {
      timestamp,
      event: 'evidence_attached',
      checkpoint_id,
      evidence_refs: refs,
    },
  );
}

export function requestReplay(state, options = {}) {
  const timestamp = toIsoTimestamp(options.now ?? new Date());
  const nextReplay = normalizeReplayState({
    ...state.replay,
    status: 'requested',
    requested_at: timestamp,
    completed_at: null,
    requested_by: options.requested_by ?? null,
    reason: options.reason ?? null,
    source_checkpoint_id: options.source_checkpoint_id ?? state.current_checkpoint_id,
    target_checkpoint_id: options.target_checkpoint_id ?? state.current_checkpoint_id,
    cursor: clone(options.cursor ?? null),
    journal_state: normalizeJournalState(options.journal_state ?? state.replay?.journal_state),
  });

  return appendJournal(
    {
      ...state,
      runtime_status: options.runtime_status ?? 'recovering',
      replay: nextReplay,
    },
    {
      timestamp,
      event: 'replay_requested',
      requested_by: nextReplay.requested_by,
      reason: nextReplay.reason,
      source_checkpoint_id: nextReplay.source_checkpoint_id,
      target_checkpoint_id: nextReplay.target_checkpoint_id,
      cursor: clone(nextReplay.cursor),
    },
  );
}

export function completeReplay(state, options = {}) {
  if (!state?.replay || state.replay.status === 'idle') {
    throw new Error('Cannot complete replay when no replay has been requested.');
  }

  const timestamp = toIsoTimestamp(options.now ?? new Date());
  const checkpointId = options.checkpoint_id ?? state.replay.target_checkpoint_id ?? state.current_checkpoint_id;
  const nextReplay = normalizeReplayState({
    ...state.replay,
    status: 'completed',
    completed_at: timestamp,
    target_checkpoint_id: checkpointId,
    cursor: clone(Object.hasOwn(options, 'cursor') ? options.cursor : state.replay.cursor),
    journal_state: normalizeJournalState(options.journal_state ?? state.replay.journal_state),
  });

  let nextState = {
    ...state,
    runtime_status: options.runtime_status ?? 'idle',
    current_checkpoint_id: checkpointId,
    last_checkpoint_at: checkpointId ? timestamp : state.last_checkpoint_at,
    replay: nextReplay,
  };

  if (Object.hasOwn(options, 'evidence_refs')) {
    nextState = {
      ...nextState,
      last_evidence_at: timestamp,
      last_accepted_evidence_refs: mergeEvidenceRefs(
        nextState.last_accepted_evidence_refs,
        options.evidence_refs,
      ),
    };
  }

  return appendJournal(nextState, {
    timestamp,
    event: 'replay_completed',
    checkpoint_id: checkpointId,
    cursor: clone(nextReplay.cursor),
    evidence_refs: normalizeEvidenceRefs(options.evidence_refs),
  });
}
