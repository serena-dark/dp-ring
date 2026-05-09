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
  const moveById = new Map();
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
        moveById.set(id, move);
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

  return { ids, indexById, moveById, errors };
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

function publicRefKey(ref) {
  const artifactType = normalizedString(ref?.artifact_type);
  const id = normalizedString(ref?.id);
  let location;
  if (ref?.location === null) {
    location = null;
  } else if (typeof ref?.location === 'string') {
    location = ref.location.trim();
  } else {
    location = undefined;
  }

  if (!artifactType || !id || location === undefined) {
    return null;
  }

  return JSON.stringify([artifactType, id, location]);
}

function moveCarriesPublicRef(move, ref) {
  const targetKey = publicRefKey(ref);
  if (!targetKey || !Array.isArray(move?.target_refs)) {
    return false;
  }
  return move.target_refs.some((targetRef) => publicRefKey(targetRef) === targetKey);
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

const responseDutyProtocolRules = new Map([
  [
    'justify_or_withdraw',
    {
      openingLocutions: new Set(['challenge', 'ask_grounds']),
      satisfactionLocutions: new Set(['justify', 'withdraw']),
    },
  ],
]);

function describeLocutions(locutions) {
  return [...locutions].join(' or ');
}

function validateResponseDutyProtocolLocutions(errors, duty, dutyIndex, moveTimeline) {
  const dutyKind = normalizedString(duty?.duty_kind);
  const rule = responseDutyProtocolRules.get(dutyKind);
  if (!rule) {
    return;
  }

  const openedByMoveId = normalizedString(duty?.opened_by_move_id);
  const openedMove = openedByMoveId ? moveTimeline.moveById.get(openedByMoveId) : null;
  const openedLocution = normalizedString(openedMove?.locution);
  if (openedLocution && !rule.openingLocutions.has(openedLocution)) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}/opened_by_move_id`,
        `${dutyKind} response duties must be opened by ${describeLocutions(rule.openingLocutions)} locutions, not ${openedLocution}`,
        {
          duty_kind: dutyKind,
          opened_by_move_id: openedByMoveId,
          opened_locution: openedLocution,
          allowed_opening_locutions: [...rule.openingLocutions],
        },
      ),
    );
  }

  const satisfiedByMoveId = normalizedString(duty?.satisfied_by_move_id);
  const satisfiedMove = satisfiedByMoveId ? moveTimeline.moveById.get(satisfiedByMoveId) : null;
  const satisfiedLocution = normalizedString(satisfiedMove?.locution);
  if (satisfiedLocution && !rule.satisfactionLocutions.has(satisfiedLocution)) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}/satisfied_by_move_id`,
        `${dutyKind} response duties must be satisfied by ${describeLocutions(rule.satisfactionLocutions)} locutions, not ${satisfiedLocution}`,
        {
          duty_kind: dutyKind,
          satisfied_by_move_id: satisfiedByMoveId,
          satisfied_locution: satisfiedLocution,
          allowed_satisfaction_locutions: [...rule.satisfactionLocutions],
        },
      ),
    );
  }
}

function validateResponseDutyTargetRefs(errors, duty, dutyIndex, moveTimeline) {
  const dutyTargetKey = publicRefKey(duty?.target_ref);
  if (!dutyTargetKey) {
    return;
  }

  const openedByMoveId = normalizedString(duty?.opened_by_move_id);
  const openedMove = openedByMoveId ? moveTimeline.moveById.get(openedByMoveId) : null;
  if (openedMove && !moveCarriesPublicRef(openedMove, duty.target_ref)) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}/target_ref`,
        `response duty target_ref must match a target_ref carried by opened_by_move_id ${openedByMoveId}`,
        { opened_by_move_id: openedByMoveId, target_ref_key: dutyTargetKey },
      ),
    );
  }

  const satisfiedByMoveId = normalizedString(duty?.satisfied_by_move_id);
  const satisfiedMove = satisfiedByMoveId ? moveTimeline.moveById.get(satisfiedByMoveId) : null;
  if (satisfiedMove && !moveCarriesPublicRef(satisfiedMove, duty.target_ref)) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}/satisfied_by_move_id`,
        `satisfied_by_move_id ${satisfiedByMoveId} must carry the response duty target_ref`,
        { satisfied_by_move_id: satisfiedByMoveId, target_ref_key: dutyTargetKey },
      ),
    );
  }
}

function validateResponseDutySatisfaction(errors, duty, dutyIndex, moveTimeline) {
  const status = normalizedString(duty?.status);
  const openedByMoveId = normalizedString(duty?.opened_by_move_id);
  const satisfiedByMoveId = normalizedString(duty?.satisfied_by_move_id);
  const satisfiedPath = `/data/open_response_duties/${dutyIndex}/satisfied_by_move_id`;

  if (status === 'open' && satisfiedByMoveId) {
    errors.push(
      semanticError(
        satisfiedPath,
        'open response duties cannot carry a satisfied_by_move_id before the duty is resolved',
        { duty_status: status, satisfied_by_move_id: satisfiedByMoveId },
      ),
    );
  }

  if (status === 'satisfied' && !satisfiedByMoveId) {
    errors.push(
      semanticError(
        satisfiedPath,
        'satisfied response duties require a non-empty satisfied_by_move_id',
        { duty_status: status },
      ),
    );
  }

  if (
    openedByMoveId &&
    satisfiedByMoveId &&
    moveTimeline.indexById.has(openedByMoveId) &&
    moveTimeline.indexById.has(satisfiedByMoveId)
  ) {
    const openedIndex = moveTimeline.indexById.get(openedByMoveId);
    const satisfiedIndex = moveTimeline.indexById.get(satisfiedByMoveId);
    if (satisfiedIndex <= openedIndex) {
      errors.push(
        semanticError(
          satisfiedPath,
          `satisfied_by_move_id ${satisfiedByMoveId} must reference a move after opened_by_move_id ${openedByMoveId}`,
          {
            opened_by_move_id: openedByMoveId,
            opened_move_index: openedIndex,
            satisfied_by_move_id: satisfiedByMoveId,
            satisfied_move_index: satisfiedIndex,
          },
        ),
      );
    }
  }
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
    validateResponseDutyProtocolLocutions(errors, duty, dutyIndex, moveTimeline);
    validateResponseDutyTargetRefs(errors, duty, dutyIndex, moveTimeline);
    validateResponseDutySatisfaction(errors, duty, dutyIndex, moveTimeline);
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
