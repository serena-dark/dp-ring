function normalizedString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function semanticError(instancePath, message, params = {}) {
  return {
    instancePath,
    schemaPath: '#/semantic/acceptance-evaluation/references',
    keyword: 'semanticReference',
    params,
    message,
  };
}

function moveTimelineState(doc) {
  const moves = Array.isArray(doc?.data?.moves) ? doc.data.moves : [];
  const ids = new Set();
  const indexById = new Map();
  const errors = [];
  let previousSequence = null;

  moves.forEach((move, index) => {
    const id = normalizedString(move?.id);
    if (id) {
      if (ids.has(id)) {
        errors.push(
          semanticError(
            `/data/moves/${index}/id`,
            `duplicate move id ${id} is not allowed in append-only move history`,
            { duplicate_move_id: id, first_index: indexById.get(id), duplicate_index: index },
          ),
        );
      } else {
        ids.add(id);
        indexById.set(id, index);
      }
    }

    const sequence = move?.sequence;
    if (Number.isInteger(sequence)) {
      if (previousSequence != null && sequence <= previousSequence.sequence) {
        errors.push(
          semanticError(
            `/data/moves/${index}/sequence`,
            `move sequence for ${id ?? `move at index ${index}`} must strictly increase after ${previousSequence.sequence}`,
            {
              move_id: id,
              sequence,
              previous_sequence: previousSequence.sequence,
              previous_index: previousSequence.index,
            },
          ),
        );
      }
      previousSequence = { sequence, index };
    }
  });

  return { ids, indexById, errors };
}

function collectMissingMoveIds(values, knownMoveIds) {
  const ids = Array.isArray(values) ? values : [values];
  const missing = [];

  ids.forEach((value, index) => {
    const normalized = normalizedString(value);
    if (normalized && !knownMoveIds.has(normalized)) {
      missing.push({ id: normalized, index });
    }
  });

  return missing;
}

function pushMissingMoveReferenceError(errors, instancePath, label, missing) {
  if (missing.length === 0) {
    return;
  }

  errors.push(
    semanticError(
      instancePath,
      `${label} must reference existing append-only move ids: ${missing.map((item) => item.id).join(', ')}`,
      { missing_move_ids: missing },
    ),
  );
}

function collectForwardMoveIds(values, indexById, currentMoveIndex) {
  const ids = Array.isArray(values) ? values : [values];
  const forward = [];

  ids.forEach((value, index) => {
    const normalized = normalizedString(value);
    if (!normalized || !indexById.has(normalized)) {
      return;
    }
    const referencedIndex = indexById.get(normalized);
    if (referencedIndex >= currentMoveIndex) {
      forward.push({ id: normalized, index, referenced_index: referencedIndex });
    }
  });

  return forward;
}

function pushForwardAntecedentReferenceError(errors, instancePath, forward) {
  if (forward.length === 0) {
    return;
  }

  errors.push(
    semanticError(
      instancePath,
      `antecedent_move_ids must reference earlier append-only move ids: ${forward.map((item) => item.id).join(', ')}`,
      { forward_move_ids: forward },
    ),
  );
}

export function validateAcceptanceEvaluationReferences(doc) {
  const errors = [];
  const moveTimeline = moveTimelineState(doc);
  errors.push(...moveTimeline.errors);
  const knownMoveIds = moveTimeline.ids;
  const moves = Array.isArray(doc?.data?.moves) ? doc.data.moves : [];
  const commitments = Array.isArray(doc?.data?.current_commitments) ? doc.data.current_commitments : [];
  const responseDuties = Array.isArray(doc?.data?.open_response_duties) ? doc.data.open_response_duties : [];
  const settlement = doc?.data?.settlement_projection;

  moves.forEach((move, moveIndex) => {
    const antecedentPath = `/data/moves/${moveIndex}/antecedent_move_ids`;
    pushMissingMoveReferenceError(
      errors,
      antecedentPath,
      'antecedent_move_ids',
      collectMissingMoveIds(move?.antecedent_move_ids, knownMoveIds),
    );
    pushForwardAntecedentReferenceError(
      errors,
      antecedentPath,
      collectForwardMoveIds(move?.antecedent_move_ids, moveTimeline.indexById, moveIndex),
    );
  });

  commitments.forEach((commitment, commitmentIndex) => {
    pushMissingMoveReferenceError(
      errors,
      `/data/current_commitments/${commitmentIndex}/source_move_id`,
      'source_move_id',
      collectMissingMoveIds(commitment?.source_move_id, knownMoveIds),
    );
  });

  responseDuties.forEach((duty, dutyIndex) => {
    pushMissingMoveReferenceError(
      errors,
      `/data/open_response_duties/${dutyIndex}/opened_by_move_id`,
      'opened_by_move_id',
      collectMissingMoveIds(duty?.opened_by_move_id, knownMoveIds),
    );
    pushMissingMoveReferenceError(
      errors,
      `/data/open_response_duties/${dutyIndex}/satisfied_by_move_id`,
      'satisfied_by_move_id',
      collectMissingMoveIds(duty?.satisfied_by_move_id, knownMoveIds),
    );
  });

  if (settlement != null && typeof settlement === 'object' && !Array.isArray(settlement)) {
    pushMissingMoveReferenceError(
      errors,
      '/data/settlement_projection/basis_move_ids',
      'settlement basis_move_ids',
      collectMissingMoveIds(settlement.basis_move_ids, knownMoveIds),
    );
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
