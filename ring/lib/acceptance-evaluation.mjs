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

export function validateAcceptanceEvaluationReferences(doc) {
  const errors = [];
  const settlement = doc?.data?.settlement_projection;
  if (settlement == null || typeof settlement !== 'object' || Array.isArray(settlement)) {
    return { valid: true, errors: null };
  }

  const basisMoveIds = Array.isArray(settlement.basis_move_ids) ? settlement.basis_move_ids : [];
  const knownMoveIds = moveIdSet(doc);
  const missingBasisMoveIds = [];

  basisMoveIds.forEach((basisMoveId, index) => {
    const normalized = normalizedString(basisMoveId);
    if (normalized && !knownMoveIds.has(normalized)) {
      missingBasisMoveIds.push({ id: normalized, index });
    }
  });

  if (missingBasisMoveIds.length > 0) {
    errors.push(
      semanticError(
        '/data/settlement_projection/basis_move_ids',
        `settlement basis_move_ids must reference existing append-only move ids: ${missingBasisMoveIds
          .map((item) => item.id)
          .join(', ')}`,
        { missing_basis_move_ids: missingBasisMoveIds },
      ),
    );
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : null };
}
