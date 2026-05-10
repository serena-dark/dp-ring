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

const commitmentTransitionEffectKinds = new Set([
  'commitment_opened',
  'commitment_updated',
  'commitment_closed',
]);

const responseDutyTransitionEffectKinds = new Set([
  'response_duty_opened',
  'response_duty_satisfied',
  'response_duty_withdrawn',
  'response_duty_expired',
]);

const settlementTransitionEffectKinds = new Set(['settlement_projected']);

const scorekeepingTransitionSourceLocutionRules = new Map([
  ['settlement_projected', new Set(['settle'])],
]);

const commitmentStateSourceLocutionRules = new Map([
  ['challenged', new Set(['challenge', 'ask_grounds'])],
  ['defended', new Set(['justify', 'defend'])],
  ['accepted', new Set(['accept'])],
  ['refused', new Set(['refuse'])],
  ['withdrawn', new Set(['withdraw'])],
  ['settled', new Set(['settle'])],
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

function validateScorekeepingTransitionRuleBinding(errors, transition, transitionIndex, moveTimeline) {
  const moveId = normalizedString(transition?.move_id);
  const ruleId = normalizedString(transition?.rule_id);
  if (!moveId || !ruleId) {
    return;
  }

  const move = moveTimeline.moveById.get(moveId);
  if (!move) {
    return;
  }

  const appliedRuleIds = new Set(
    Array.isArray(move.applied_rule_ids)
      ? move.applied_rule_ids.map((value) => normalizedString(value)).filter(Boolean)
      : [],
  );
  if (!appliedRuleIds.has(ruleId)) {
    errors.push(
      semanticError(
        `/data/scorekeeping_transitions/${transitionIndex}/rule_id`,
        `scorekeeping transition rule_id ${ruleId} must be listed in source move ${moveId} applied_rule_ids`,
        { move_id: moveId, rule_id: ruleId, applied_rule_ids: [...appliedRuleIds] },
      ),
    );
  }
}

function validateScorekeepingTransitionTargetRef(errors, transition, transitionIndex, moveTimeline) {
  const moveId = normalizedString(transition?.move_id);
  const targetRefKey = publicRefKey(transition?.target_ref);
  if (!moveId || !targetRefKey) {
    return;
  }

  const move = moveTimeline.moveById.get(moveId);
  if (!move) {
    return;
  }

  if (!moveCarriesPublicRef(move, transition.target_ref)) {
    errors.push(
      semanticError(
        `/data/scorekeeping_transitions/${transitionIndex}/target_ref`,
        `scorekeeping transition target_ref must be carried by source move ${moveId}`,
        { move_id: moveId, target_ref_key: targetRefKey },
      ),
    );
  }
}

function scorekeepingTransitionSourceLocutionRule(transition) {
  const effectKind = normalizedString(transition?.effect_kind);
  if (commitmentTransitionEffectKinds.has(effectKind)) {
    const afterState = normalizedString(transition?.after_commitment_state);
    const allowedLocutions = commitmentStateSourceLocutionRules.get(afterState);
    if (allowedLocutions) {
      return { allowedLocutions, projectedState: afterState };
    }
  }

  const allowedLocutions = scorekeepingTransitionSourceLocutionRules.get(effectKind);
  if (allowedLocutions) {
    return { allowedLocutions, projectedState: null };
  }

  return null;
}

function validateScorekeepingTransitionSourceLocution(errors, transition, transitionIndex, moveTimeline) {
  const effectKind = normalizedString(transition?.effect_kind);
  const rule = scorekeepingTransitionSourceLocutionRule(transition);
  if (!rule) {
    return;
  }

  const moveId = normalizedString(transition?.move_id);
  const move = moveId ? moveTimeline.moveById.get(moveId) : null;
  const locution = normalizedString(move?.locution);
  if (!locution || rule.allowedLocutions.has(locution)) {
    return;
  }

  const projectedState = rule.projectedState ? ` projecting ${rule.projectedState} commitments` : '';
  errors.push(
    semanticError(
      `/data/scorekeeping_transitions/${transitionIndex}/move_id`,
      `${effectKind} scorekeeping transitions${projectedState} require a ${describeLocutions(rule.allowedLocutions)} locution source move, not ${locution}`,
      {
        move_id: moveId,
        locution,
        projected_state: rule.projectedState,
        allowed_locutions: [...rule.allowedLocutions],
      },
    ),
  );
}

function validateScorekeepingTransitionStateSlots(errors, transition, transitionIndex) {
  const effectKind = normalizedString(transition?.effect_kind);
  if (commitmentTransitionEffectKinds.has(effectKind)) {
    const commitmentId = normalizedString(transition?.commitment_id);
    const afterState = normalizedString(transition?.after_commitment_state);
    if (!commitmentId) {
      errors.push(
        semanticError(
          `/data/scorekeeping_transitions/${transitionIndex}/commitment_id`,
          `${effectKind} commitment scorekeeping transitions require a commitment_id`,
          { effect_kind: effectKind },
        ),
      );
    }
    if (!afterState) {
      errors.push(
        semanticError(
          `/data/scorekeeping_transitions/${transitionIndex}/after_commitment_state`,
          `${effectKind} commitment scorekeeping transitions require an after_commitment_state`,
          { effect_kind: effectKind },
        ),
      );
    }
  }

  if (responseDutyTransitionEffectKinds.has(effectKind)) {
    const dutyId = normalizedString(transition?.response_duty_id);
    const afterStatus = normalizedString(transition?.after_response_duty_status);
    if (!dutyId) {
      errors.push(
        semanticError(
          `/data/scorekeeping_transitions/${transitionIndex}/response_duty_id`,
          `${effectKind} response duty scorekeeping transitions require a response_duty_id`,
          { effect_kind: effectKind },
        ),
      );
    }
    if (!afterStatus) {
      errors.push(
        semanticError(
          `/data/scorekeeping_transitions/${transitionIndex}/after_response_duty_status`,
          `${effectKind} response duty scorekeeping transitions require an after_response_duty_status`,
          { effect_kind: effectKind },
        ),
      );
    }
  }

  if (settlementTransitionEffectKinds.has(effectKind)) {
    const afterOutcome = normalizedString(transition?.after_settlement_outcome);
    if (!afterOutcome) {
      errors.push(
        semanticError(
          `/data/scorekeeping_transitions/${transitionIndex}/after_settlement_outcome`,
          `${effectKind} scorekeeping transitions require an after_settlement_outcome`,
          { effect_kind: effectKind },
        ),
      );
    }
  }
}

function latestCommitmentTransition(commitment, scorekeepingTransitions, moveTimeline) {
  const commitmentId = normalizedString(commitment?.id);
  const commitmentTargetKey = publicRefKey(commitment?.target_ref);
  if (!commitmentId || !commitmentTargetKey) {
    return null;
  }

  let latest = null;
  scorekeepingTransitions.forEach((transition, transitionIndex) => {
    const effectKind = normalizedString(transition?.effect_kind);
    if (!commitmentTransitionEffectKinds.has(effectKind)) {
      return;
    }
    if (normalizedString(transition?.commitment_id) !== commitmentId) {
      return;
    }
    if (publicRefKey(transition?.target_ref) !== commitmentTargetKey) {
      return;
    }

    const moveId = normalizedString(transition?.move_id);
    if (!moveId || !moveTimeline.indexById.has(moveId)) {
      return;
    }
    const moveIndex = moveTimeline.indexById.get(moveId);
    if (
      latest == null ||
      moveIndex > latest.moveIndex ||
      (moveIndex === latest.moveIndex && transitionIndex > latest.transitionIndex)
    ) {
      latest = {
        moveId,
        moveIndex,
        transitionIndex,
        afterState: normalizedString(transition?.after_commitment_state),
      };
    }
  });

  return latest;
}

function validateCurrentCommitmentTransitionProjection(
  errors,
  commitment,
  commitmentIndex,
  scorekeepingTransitions,
  moveTimeline,
) {
  const commitmentId = normalizedString(commitment?.id);
  const state = normalizedString(commitment?.state);
  const sourceMoveId = normalizedString(commitment?.source_move_id);
  if (!commitmentId || !state || !sourceMoveId || !publicRefKey(commitment?.target_ref)) {
    return;
  }

  const latest = latestCommitmentTransition(commitment, scorekeepingTransitions, moveTimeline);
  if (!latest) {
    errors.push(
      semanticError(
        `/data/current_commitments/${commitmentIndex}`,
        `current commitment ${commitmentId} must be backed by a commitment scorekeeping transition`,
        { commitment_id: commitmentId },
      ),
    );
    return;
  }

  if (latest.afterState !== state || latest.moveId !== sourceMoveId) {
    errors.push(
      semanticError(
        `/data/current_commitments/${commitmentIndex}`,
        `current commitment ${commitmentId} must match the latest scorekeeping transition for its commitment and target`,
        {
          commitment_id: commitmentId,
          state,
          source_move_id: sourceMoveId,
          latest_transition_index: latest.transitionIndex,
          latest_transition_move_id: latest.moveId,
          latest_transition_state: latest.afterState,
        },
      ),
    );
  }
}

function latestResponseDutyTransition(duty, scorekeepingTransitions, moveTimeline) {
  const dutyId = normalizedString(duty?.id);
  const dutyTargetKey = publicRefKey(duty?.target_ref);
  if (!dutyId || !dutyTargetKey) {
    return null;
  }

  let latest = null;
  scorekeepingTransitions.forEach((transition, transitionIndex) => {
    const effectKind = normalizedString(transition?.effect_kind);
    if (!responseDutyTransitionEffectKinds.has(effectKind)) {
      return;
    }
    if (normalizedString(transition?.response_duty_id) !== dutyId) {
      return;
    }
    if (publicRefKey(transition?.target_ref) !== dutyTargetKey) {
      return;
    }

    const moveId = normalizedString(transition?.move_id);
    if (!moveId || !moveTimeline.indexById.has(moveId)) {
      return;
    }
    const moveIndex = moveTimeline.indexById.get(moveId);
    if (
      latest == null ||
      moveIndex > latest.moveIndex ||
      (moveIndex === latest.moveIndex && transitionIndex > latest.transitionIndex)
    ) {
      latest = {
        moveId,
        moveIndex,
        transitionIndex,
        afterStatus: normalizedString(transition?.after_response_duty_status),
      };
    }
  });

  return latest;
}

function responseDutyCurrentSourceMoveId(duty, status) {
  if (status === 'open') {
    return normalizedString(duty?.opened_by_move_id);
  }
  if (status === 'satisfied') {
    return normalizedString(duty?.satisfied_by_move_id);
  }
  return null;
}

function validateCurrentResponseDutyTransitionProjection(
  errors,
  duty,
  dutyIndex,
  scorekeepingTransitions,
  moveTimeline,
) {
  const dutyId = normalizedString(duty?.id);
  const status = normalizedString(duty?.status);
  if (!dutyId || !status || !publicRefKey(duty?.target_ref)) {
    return;
  }

  const latest = latestResponseDutyTransition(duty, scorekeepingTransitions, moveTimeline);
  if (!latest) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}`,
        `current response duty ${dutyId} must be backed by a response duty scorekeeping transition`,
        { response_duty_id: dutyId },
      ),
    );
    return;
  }

  const sourceMoveId = responseDutyCurrentSourceMoveId(duty, status);
  const sourceMatches = sourceMoveId == null || latest.moveId === sourceMoveId;
  if (latest.afterStatus !== status || !sourceMatches) {
    errors.push(
      semanticError(
        `/data/open_response_duties/${dutyIndex}`,
        `current response duty ${dutyId} must match the latest scorekeeping transition for its duty and target`,
        {
          response_duty_id: dutyId,
          status,
          source_move_id: sourceMoveId,
          latest_transition_index: latest.transitionIndex,
          latest_transition_move_id: latest.moveId,
          latest_transition_status: latest.afterStatus,
        },
      ),
    );
  }
}

function latestSettlementProjectionTransition(settlement, scorekeepingTransitions, moveTimeline) {
  const outcome = normalizedString(settlement?.outcome);
  const basisMoveIds = new Set(
    Array.isArray(settlement?.basis_move_ids)
      ? settlement.basis_move_ids.map((value) => normalizedString(value)).filter(Boolean)
      : [],
  );
  if (!outcome || basisMoveIds.size === 0) {
    return null;
  }

  let latest = null;
  scorekeepingTransitions.forEach((transition, transitionIndex) => {
    const effectKind = normalizedString(transition?.effect_kind);
    if (!settlementTransitionEffectKinds.has(effectKind)) {
      return;
    }

    const moveId = normalizedString(transition?.move_id);
    if (!moveId || !basisMoveIds.has(moveId) || !moveTimeline.indexById.has(moveId)) {
      return;
    }

    const moveIndex = moveTimeline.indexById.get(moveId);
    if (
      latest == null ||
      moveIndex > latest.moveIndex ||
      (moveIndex === latest.moveIndex && transitionIndex > latest.transitionIndex)
    ) {
      latest = {
        moveId,
        moveIndex,
        transitionIndex,
        afterOutcome: normalizedString(transition?.after_settlement_outcome),
      };
    }
  });

  return latest;
}

function validateSettlementProjectionTransitionProjection(
  errors,
  settlement,
  scorekeepingTransitions,
  moveTimeline,
) {
  if (settlement == null || typeof settlement !== 'object' || Array.isArray(settlement)) {
    return;
  }

  const outcome = normalizedString(settlement?.outcome);
  if (!outcome) {
    return;
  }

  const latest = latestSettlementProjectionTransition(settlement, scorekeepingTransitions, moveTimeline);
  if (!latest) {
    errors.push(
      semanticError(
        '/data/settlement_projection',
        'settlement projection must be backed by a settlement scorekeeping transition whose move_id appears in basis_move_ids',
        { outcome },
      ),
    );
    return;
  }

  if (latest.afterOutcome !== outcome) {
    errors.push(
      semanticError(
        '/data/settlement_projection/outcome',
        'settlement projection outcome must match the latest scorekeeping transition for its settlement basis',
        {
          outcome,
          latest_transition_index: latest.transitionIndex,
          latest_transition_move_id: latest.moveId,
          latest_transition_outcome: latest.afterOutcome,
        },
      ),
    );
  }
}

export function validateAcceptanceEvaluationReferences(doc) {
  const errors = [];
  const moveTimeline = moveTimelineState(doc);
  errors.push(...moveTimeline.errors);
  const knownMoveIds = moveTimeline.ids;
  const moves = Array.isArray(doc?.data?.moves) ? doc.data.moves : [];
  const scorekeepingTransitions = Array.isArray(doc?.data?.scorekeeping_transitions)
    ? doc.data.scorekeeping_transitions
    : [];
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

  scorekeepingTransitions.forEach((transition, transitionIndex) => {
    pushMissingMoveReferenceError(
      errors,
      `/data/scorekeeping_transitions/${transitionIndex}/move_id`,
      'scorekeeping transition move_id',
      collectMissingMoveIds(transition?.move_id, knownMoveIds),
    );
    validateScorekeepingTransitionRuleBinding(errors, transition, transitionIndex, moveTimeline);
    validateScorekeepingTransitionTargetRef(errors, transition, transitionIndex, moveTimeline);
    validateScorekeepingTransitionSourceLocution(errors, transition, transitionIndex, moveTimeline);
    validateScorekeepingTransitionStateSlots(errors, transition, transitionIndex);
  });

  commitments.forEach((commitment, commitmentIndex) => {
    pushMissingMoveReferenceError(
      errors,
      `/data/current_commitments/${commitmentIndex}/source_move_id`,
      'source_move_id',
      collectMissingMoveIds(commitment?.source_move_id, knownMoveIds),
    );
    validateCurrentCommitmentTransitionProjection(
      errors,
      commitment,
      commitmentIndex,
      scorekeepingTransitions,
      moveTimeline,
    );
  });

  responseDuties.forEach((duty, dutyIndex) => {
    validateResponseDutyProtocolLocutions(errors, duty, dutyIndex, moveTimeline);
    validateResponseDutyTargetRefs(errors, duty, dutyIndex, moveTimeline);
    validateResponseDutySatisfaction(errors, duty, dutyIndex, moveTimeline);
    validateCurrentResponseDutyTransitionProjection(
      errors,
      duty,
      dutyIndex,
      scorekeepingTransitions,
      moveTimeline,
    );
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
    validateSettlementProjectionTransitionProjection(errors, settlement, scorekeepingTransitions, moveTimeline);
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
