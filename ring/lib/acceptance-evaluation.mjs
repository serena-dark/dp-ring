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

function moveIdSet(doc) {
  const moves = Array.isArray(doc?.data?.moves) ? doc.data.moves : [];
  const ids = new Set();

  for (const move of moves) {
    const id = normalizedString(move?.id);
    if (id) {
      ids.add(id);
    }
  }

  return ids;
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

export function validateAcceptanceEvaluationReferences(doc) {
  const errors = [];
  const knownMoveIds = moveIdSet(doc);
  const moves = Array.isArray(doc?.data?.moves) ? doc.data.moves : [];
  const commitments = Array.isArray(doc?.data?.current_commitments) ? doc.data.current_commitments : [];
  const responseDuties = Array.isArray(doc?.data?.open_response_duties) ? doc.data.open_response_duties : [];
  const settlement = doc?.data?.settlement_projection;

  moves.forEach((move, moveIndex) => {
    pushMissingMoveReferenceError(
      errors,
      `/data/moves/${moveIndex}/antecedent_move_ids`,
      'antecedent_move_ids',
      collectMissingMoveIds(move?.antecedent_move_ids, knownMoveIds),
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
