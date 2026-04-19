function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function policySnapshot(value = {}) {
  return {
    workflow_tightness: value.workflow_tightness ?? 'balanced',
    oversight_strength: value.oversight_strength ?? 'normal',
    branch_budget: value.branch_budget ?? null,
    notes: value.notes ?? null,
  };
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const results = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
}

function strictestPolicyLevel(values, orderedLevels, fallback) {
  let strongestLevel = fallback;
  let strongestIndex = orderedLevels.indexOf(fallback);
  for (const value of values) {
    const levelIndex = orderedLevels.indexOf(value);
    if (levelIndex > strongestIndex) {
      strongestLevel = value;
      strongestIndex = levelIndex;
    }
  }
  return strongestLevel;
}

function synthesizedPolicySnapshot(inputs, overrides = {}) {
  const inputPolicies = inputs.map((checkpoint) => policySnapshot(checkpoint?.data?.policy_snapshot ?? {}));
  const branchBudgets = inputPolicies
    .map((snapshot) => snapshot.branch_budget)
    .filter((budget) => typeof budget === 'number' && Number.isFinite(budget));
  const mergedNotes = uniqueStrings(inputPolicies.map((snapshot) => snapshot.notes)).join(' | ') || null;

  return policySnapshot({
    workflow_tightness: strictestPolicyLevel(
      inputPolicies.map((snapshot) => snapshot.workflow_tightness),
      ['loose', 'balanced', 'tight'],
      'balanced',
    ),
    oversight_strength: strictestPolicyLevel(
      inputPolicies.map((snapshot) => snapshot.oversight_strength),
      ['weak', 'normal', 'strong'],
      'normal',
    ),
    branch_budget: branchBudgets.length > 0 ? Math.min(...branchBudgets) : null,
    notes: mergedNotes,
    ...clone(overrides),
  });
}

function executionCursor(value = {}) {
  return {
    phase: value.phase ?? 'created',
    step_id: value.step_id ?? null,
    ordinal: value.ordinal ?? null,
  };
}

function replayState(value = {}) {
  return {
    status: value.status ?? 'idle',
    requested_at: value.requested_at ?? null,
    completed_at: value.completed_at ?? null,
    requested_by: value.requested_by ?? null,
    reason: value.reason ?? null,
    source_checkpoint_id: value.source_checkpoint_id ?? null,
    target_checkpoint_id: value.target_checkpoint_id ?? null,
    cursor: value.cursor ?? null,
    journal_state: {
      mode: value.journal_state?.mode ?? 'semantic',
      last_applied_entry_id: value.journal_state?.last_applied_entry_id ?? null,
      pending_entry_ids: Array.isArray(value.journal_state?.pending_entry_ids)
        ? [...value.journal_state.pending_entry_ids]
        : [],
    },
  };
}

function evidenceRefs(values = []) {
  return [...values].map((item) => ({
    kind: item.kind,
    ref: item.ref,
    digest: item.digest ?? null,
  }));
}

function publicationStatements(values = []) {
  return [...values].map((item) => clone(item));
}

function checkpointScope(scopeRef = {}) {
  return {
    kind: scopeRef.kind ?? 'node',
    id: scopeRef.id ?? 'unknown-scope',
    path: scopeRef.path ?? null,
  };
}

function checkpointData(fields = {}, defaults = {}) {
  return {
    parent_checkpoint_id: fields.parent_checkpoint_id ?? defaults.parent_checkpoint_id ?? null,
    branch_id: fields.branch_id ?? defaults.branch_id ?? 'main',
    node_id: fields.node_id ?? defaults.node_id ?? 'unknown-node',
    scope_ref: checkpointScope(fields.scope_ref ?? defaults.scope_ref),
    policy_snapshot: policySnapshot(fields.policy_snapshot ?? defaults.policy_snapshot),
    execution_cursor: executionCursor(fields.execution_cursor ?? defaults.execution_cursor),
    evidence_refs: evidenceRefs(fields.evidence_refs ?? defaults.evidence_refs ?? []),
    publication_statements: publicationStatements(fields.publication_statements ?? defaults.publication_statements ?? []),
    adoption_status: fields.adoption_status ?? defaults.adoption_status ?? 'candidate',
    replay_state: replayState(fields.replay_state ?? defaults.replay_state),
    synthesis_inputs: clone(fields.synthesis_inputs ?? defaults.synthesis_inputs ?? []),
  };
}

export function createCheckpoint(fields = {}) {
  const now = fields.created_at ?? nowIso();
  return {
    id: fields.id,
    type: 'checkpoint',
    version: fields.version ?? 1,
    created_at: now,
    updated_at: fields.updated_at ?? now,
    created_by: fields.created_by ?? 'unknown',
    session_id: fields.session_id ?? null,
    status: fields.status ?? 'candidate',
    data: checkpointData(fields.data, {
      branch_id: fields.branch_id,
      node_id: fields.node_id,
      scope_ref: fields.scope_ref,
      policy_snapshot: fields.policy_snapshot,
      execution_cursor: fields.execution_cursor,
      evidence_refs: fields.evidence_refs,
      publication_statements: fields.publication_statements,
      adoption_status: fields.adoption_status,
      replay_state: fields.replay_state,
      synthesis_inputs: fields.synthesis_inputs,
      parent_checkpoint_id: fields.parent_checkpoint_id,
    }),
  };
}

export function continueFromCheckpoint(parent, fields = {}) {
  return createCheckpoint({
    ...fields,
    branch_id: fields.branch_id ?? parent.data.branch_id,
    node_id: fields.node_id ?? parent.data.node_id,
    scope_ref: fields.scope_ref ?? parent.data.scope_ref,
    policy_snapshot: fields.policy_snapshot ?? parent.data.policy_snapshot,
    execution_cursor: fields.execution_cursor ?? parent.data.execution_cursor,
    evidence_refs: fields.evidence_refs ?? parent.data.evidence_refs,
    publication_statements: fields.publication_statements ?? [],
    replay_state: fields.replay_state ?? parent.data.replay_state,
    synthesis_inputs: fields.synthesis_inputs ?? [],
    parent_checkpoint_id: parent.id,
  });
}

export function forkCheckpoint(parent, fields = {}) {
  return createCheckpoint({
    ...fields,
    branch_id: fields.branch_id ?? `${parent.data.branch_id}.fork`,
    node_id: fields.node_id ?? parent.data.node_id,
    scope_ref: fields.scope_ref ?? parent.data.scope_ref,
    policy_snapshot: fields.policy_snapshot ?? parent.data.policy_snapshot,
    execution_cursor: fields.execution_cursor ?? parent.data.execution_cursor,
    evidence_refs: fields.evidence_refs ?? parent.data.evidence_refs,
    publication_statements: fields.publication_statements ?? [],
    replay_state: fields.replay_state ?? parent.data.replay_state,
    adoption_status: fields.adoption_status ?? 'candidate',
    parent_checkpoint_id: parent.id,
  });
}

export function adoptBranch(checkpoint, fields = {}) {
  return {
    ...clone(checkpoint),
    updated_at: fields.updated_at ?? nowIso(),
    status: fields.status ?? 'mainline',
    data: {
      ...clone(checkpoint.data),
      adoption_status: 'mainline',
    },
  };
}

export function discardBranch(checkpoint, fields = {}) {
  return {
    ...clone(checkpoint),
    updated_at: fields.updated_at ?? nowIso(),
    status: fields.status ?? 'discarded',
    data: {
      ...clone(checkpoint.data),
      adoption_status: 'discarded',
      replay_state: replayState({
        ...checkpoint.data.replay_state,
        status: fields.replay_status ?? checkpoint.data.replay_state?.status ?? 'idle',
      }),
    },
  };
}

export function synthesizeCheckpoint(inputs, fields = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('synthesizeCheckpoint requires at least one input checkpoint');
  }
  const parent = inputs[0];
  const mergedPolicySnapshot = synthesizedPolicySnapshot(inputs, fields.policy_snapshot);
  const mergedEvidence = [];
  const seen = new Set();
  for (const cp of inputs) {
    for (const ref of cp.data.evidence_refs ?? []) {
      const key = `${ref.kind}:${ref.ref}:${ref.digest ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mergedEvidence.push({ kind: ref.kind, ref: ref.ref, digest: ref.digest ?? null });
    }
  }
  return createCheckpoint({
    ...fields,
    branch_id: fields.branch_id ?? `${parent.data.branch_id}.synth`,
    node_id: fields.node_id ?? parent.data.node_id,
    scope_ref: fields.scope_ref ?? parent.data.scope_ref,
    policy_snapshot: mergedPolicySnapshot,
    execution_cursor: fields.execution_cursor ?? parent.data.execution_cursor,
    evidence_refs: fields.evidence_refs ?? mergedEvidence,
    publication_statements: fields.publication_statements ?? [],
    replay_state: fields.replay_state ?? parent.data.replay_state,
    adoption_status: fields.adoption_status ?? 'synthesized',
    status: fields.status ?? 'synthesized',
    parent_checkpoint_id: fields.parent_checkpoint_id ?? parent.id,
    synthesis_inputs: fields.synthesis_inputs ?? inputs.map((cp) => cp.id),
  });
}

export function lineageForCheckpoint(checkpoints, checkpointId) {
  const byId = checkpoints instanceof Map
    ? checkpoints
    : new Map((checkpoints ?? []).map((item) => [item.id, item]));
  const lineage = [];
  let cursor = byId.get(checkpointId) ?? null;
  while (cursor) {
    lineage.unshift(cursor);
    cursor = cursor.data?.parent_checkpoint_id ? byId.get(cursor.data.parent_checkpoint_id) ?? null : null;
  }
  return lineage;
}
