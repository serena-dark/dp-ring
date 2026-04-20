import { lineageForCheckpoint } from './checkpoint-tree.mjs';

function trimString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function orderedLevelIndex(value, orderedLevels, fallback) {
  const normalized = trimString(value) ?? fallback;
  const levelIndex = orderedLevels.indexOf(normalized);
  const fallbackIndex = orderedLevels.indexOf(fallback);
  return levelIndex >= 0 ? levelIndex : fallbackIndex;
}

function branchBudgetPressure(branchBudget) {
  return branchBudget === null ? 0 : Math.max(0, 9 - Math.min(branchBudget, 9));
}

function uniqueTrimmedStrings(values) {
  const results = [];
  const seen = new Set();
  for (const value of values ?? []) {
    const normalized = trimString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
  }
  return results;
}

function checkpointIdMap(checkpoints, checkpoint = null) {
  const byId = new Map();
  if (checkpoints instanceof Map) {
    for (const [key, value] of checkpoints.entries()) {
      const normalizedKey = trimString(key) ?? trimString(value?.id);
      if (normalizedKey) {
        byId.set(normalizedKey, value);
      }
    }
  } else if (Array.isArray(checkpoints)) {
    for (const item of checkpoints) {
      const normalizedId = trimString(item?.id);
      if (normalizedId) {
        byId.set(normalizedId, item);
      }
    }
  }

  const checkpointId = trimString(checkpoint?.id);
  if (checkpointId && checkpoint) {
    byId.set(checkpointId, checkpoint);
  }
  return byId;
}

function sharedLineageDepth(lineages) {
  if (!Array.isArray(lineages) || lineages.length < 2) {
    return 0;
  }

  let depth = 0;
  while (true) {
    const candidate = lineages[0][depth];
    if (!candidate) {
      return depth;
    }
    if (!lineages.every((lineage) => lineage[depth] === candidate)) {
      return depth;
    }
    depth += 1;
  }
}

function evidenceRefKey(ref) {
  const kind = trimString(ref?.kind);
  const pointer = trimString(ref?.ref);
  if (!kind || !pointer) {
    return null;
  }
  const digest = trimString(ref?.digest) ?? '';
  return `${kind}:${pointer}:${digest}`;
}

function replayFrictionScore(replayStatus) {
  switch (replayStatus) {
    case 'idle':
      return 0;
    case 'completed':
      return 2;
    case 'running':
    case 'replaying':
      return 8;
    case 'requested':
      return 14;
    case 'failed':
    case 'error':
      return 16;
    default:
      return replayStatus ? 6 : 0;
  }
}

function adoptionForceBoost(adoptionStatus) {
  switch (adoptionStatus) {
    case 'mainline':
      return 8;
    case 'synthesized':
      return 4;
    case 'discarded':
      return -20;
    default:
      return 0;
  }
}

function governanceConstraintDrag(governancePressure) {
  if (!governancePressure?.constrained) {
    return 0;
  }
  return governancePressure.branchBudgetPressure
    + Math.max(0, governancePressure.workflowTightnessLevel - 1) * 4
    + Math.max(0, governancePressure.oversightStrengthLevel - 1) * 3;
}

export function checkpointBranchMetricsState(checkpoint, checkpoints = []) {
  const checkpointId = trimString(checkpoint?.id);
  const branchId = trimString(checkpoint?.data?.branch_id);
  const parentCheckpointId = trimString(checkpoint?.data?.parent_checkpoint_id);
  const byId = checkpointIdMap(checkpoints, checkpoint);
  const lineage = checkpointId ? lineageForCheckpoint(byId, checkpointId) : [];
  const lineageCheckpointIds = uniqueTrimmedStrings(lineage.map((item) => item?.id));
  const distinctLineageBranchIds = uniqueTrimmedStrings(lineage.map((item) => item?.data?.branch_id));
  const synthesisInputIds = uniqueTrimmedStrings(checkpoint?.data?.synthesis_inputs);
  const synthesisInputBranchIds = uniqueTrimmedStrings(
    synthesisInputIds.map((id) => byId.get(id)?.data?.branch_id),
  );
  const synthesisInputLineages = synthesisInputIds
    .map((id) => lineageForCheckpoint(byId, id).map((item) => trimString(item?.id)).filter(Boolean))
    .filter((lineageIds) => lineageIds.length > 0);
  const sharedSynthesisLineageDepth = sharedLineageDepth(synthesisInputLineages);
  const divergenceScore = Math.max(0, distinctLineageBranchIds.length - 1)
    + Math.max(0, synthesisInputBranchIds.length - 1);
  const composabilityScore = synthesisInputBranchIds.length > 1
    ? sharedSynthesisLineageDepth + (synthesisInputBranchIds.length - 1)
    : 0;

  return {
    checkpointId,
    branchId,
    parentCheckpointId,
    lineageDepth: lineageCheckpointIds.length,
    lineageCheckpointIds,
    distinctLineageBranchIds,
    synthesisInputCount: synthesisInputIds.length,
    synthesisInputIds,
    synthesisInputBranchIds,
    sharedSynthesisLineageDepth,
    divergenceScore,
    composabilityScore,
  };
}

export function warmSemanticLineageState(workflowRun) {
  const checkpointIds = workflowRun?.data?.node_execution?.checkpoint_ids;
  const checkpointCount = Array.isArray(checkpointIds) ? checkpointIds.length : 0;
  const replayStatus = trimString(workflowRun?.data?.node_execution?.capsule_state?.replay?.status) ?? 'idle';
  const sawProgressReport = Array.isArray(workflowRun?.data?.reports)
    && workflowRun.data.reports.some((report) => trimString(report?.status) === 'progress');
  const hasWarmSemanticLineage = sawProgressReport && checkpointCount > 2 && replayStatus === 'requested';

  return {
    checkpointCount,
    replayStatus,
    sawProgressReport,
    hasWarmSemanticLineage,
  };
}

export function checkpointAutomaticReusePolicyState(checkpoint) {
  const adoptionStatus = trimString(checkpoint?.data?.adoption_status);
  const workflowTightness = trimString(checkpoint?.data?.policy_snapshot?.workflow_tightness) ?? 'balanced';
  const oversightStrength = trimString(checkpoint?.data?.policy_snapshot?.oversight_strength) ?? 'normal';
  const branchBudget = nonNegativeInteger(checkpoint?.data?.policy_snapshot?.branch_budget);
  const notes = trimString(checkpoint?.data?.policy_snapshot?.notes);
  const constrained = adoptionStatus === 'mainline'
    && (workflowTightness !== 'balanced' || oversightStrength !== 'normal' || branchBudget !== null);

  return {
    checkpointId: trimString(checkpoint?.id),
    adoptionStatus,
    workflowTightness,
    oversightStrength,
    branchBudget,
    notes,
    constrained,
  };
}

export function normalizeWorkflowReuseGovernanceBlock(block) {
  const id = trimString(block?.id)
    ?? trimString(block?.workflow_template_id)
    ?? trimString(block?.workflow_name)
    ?? trimString(block?.name)
    ?? null;
  const name = trimString(block?.name)
    ?? trimString(block?.workflow_name)
    ?? trimString(block?.id)
    ?? trimString(block?.workflow_template_id)
    ?? null;

  return {
    id,
    name,
    reason: trimString(block?.reason),
    checkpoint_id: trimString(block?.checkpoint_id),
    adoption_status: trimString(block?.adoption_status),
    branch_budget: nonNegativeInteger(block?.branch_budget),
    workflow_tightness: trimString(block?.workflow_tightness),
    oversight_strength: trimString(block?.oversight_strength),
  };
}

export function checkpointGovernancePressureState(checkpoint) {
  const policy = checkpointAutomaticReusePolicyState(checkpoint);
  const workflowTightnessLevel = orderedLevelIndex(
    policy.workflowTightness,
    ['loose', 'balanced', 'tight'],
    'balanced',
  );
  const oversightStrengthLevel = orderedLevelIndex(
    policy.oversightStrength,
    ['weak', 'normal', 'strong'],
    'normal',
  );
  const budgetPressure = branchBudgetPressure(policy.branchBudget);

  return {
    ...policy,
    workflowTightnessLevel,
    oversightStrengthLevel,
    branchBudgetPressure: budgetPressure,
    governancePressureScore: policy.constrained
      ? 1000 + (workflowTightnessLevel * 100) + (oversightStrengthLevel * 10) + budgetPressure
      : 0,
  };
}

export function checkpointAutomaticReuseSelectionPolicy(checkpoint) {
  const checkpointPressure = checkpointGovernancePressureState(checkpoint);

  return {
    constrained: checkpointPressure.constrained,
    adoption_status: checkpointPressure.adoptionStatus,
    workflow_tightness: checkpointPressure.constrained ? checkpointPressure.workflowTightness : null,
    oversight_strength: checkpointPressure.constrained ? checkpointPressure.oversightStrength : null,
    branch_budget: checkpointPressure.constrained ? checkpointPressure.branchBudget : null,
    governance_pressure_score: checkpointPressure.governancePressureScore,
  };
}

export function automaticReusePolicyGovernancePressureScore(policy) {
  if (Number.isFinite(policy?.governance_pressure_score)) {
    return policy.governance_pressure_score;
  }
  return policy?.constrained ? Number.POSITIVE_INFINITY : 0;
}

function automaticReusePolicyBranchBudget(policy) {
  return Number.isInteger(policy?.branch_budget) && policy.branch_budget >= 0
    ? policy.branch_budget
    : Number.POSITIVE_INFINITY;
}

export function compareAutomaticReusePolicies(leftPolicy, rightPolicy) {
  const leftConstrained = leftPolicy?.constrained ?? false;
  const rightConstrained = rightPolicy?.constrained ?? false;
  if (leftConstrained !== rightConstrained) {
    return leftConstrained ? 1 : -1;
  }

  const pressureComparison = automaticReusePolicyGovernancePressureScore(leftPolicy)
    - automaticReusePolicyGovernancePressureScore(rightPolicy);
  if (pressureComparison !== 0) {
    return pressureComparison;
  }

  const leftBranchBudget = automaticReusePolicyBranchBudget(leftPolicy);
  const rightBranchBudget = automaticReusePolicyBranchBudget(rightPolicy);
  if (leftBranchBudget !== rightBranchBudget) {
    return rightBranchBudget - leftBranchBudget;
  }

  return 0;
}

function normalizeEffectiveForceScore(score) {
  return Number.isFinite(score) ? score : 0;
}

function selectionContextEntry(workflow, policy, effectiveForceScore) {
  const workflowId = trimString(workflow?.id);
  if (!workflowId) {
    return null;
  }

  const governancePressureScore = automaticReusePolicyGovernancePressureScore(policy);
  return {
    workflow_id: workflowId,
    workflow_name: trimString(workflow?.data?.name) ?? workflowId,
    policy: describeAutomaticReusePolicy(policy),
    governance_pressure_score: Number.isFinite(governancePressureScore)
      ? governancePressureScore
      : null,
    effective_force_score: normalizeEffectiveForceScore(effectiveForceScore),
  };
}

export function buildGovernanceSelectionContext(
  basis,
  preferredWorkflow,
  preferredPolicy,
  preferredEffectiveForceScore,
  comparedWorkflow,
  comparedPolicy,
  comparedEffectiveForceScore,
) {
  const normalizedBasis = trimString(basis);
  const preferred = selectionContextEntry(
    preferredWorkflow,
    preferredPolicy,
    preferredEffectiveForceScore,
  );
  const compared = selectionContextEntry(
    comparedWorkflow,
    comparedPolicy,
    comparedEffectiveForceScore,
  );

  if (!normalizedBasis || !preferred || !compared) {
    return null;
  }

  return {
    basis: normalizedBasis,
    preferred,
    compared,
  };
}

function describeGovernanceSelectionBasis(basis) {
  const normalizedBasis = trimString(basis);
  if (normalizedBasis === 'governance_minimize_policy_carryover') {
    return `${normalizedBasis} (preferred the lower inherited governance cost)`;
  }
  if (normalizedBasis === 'governance_prefer_effective_force') {
    return `${normalizedBasis} (preferred the stronger checkpoint effective force after governance cost tied)`;
  }
  return normalizedBasis || 'unknown';
}

function describeGovernanceSelectionContextEntry(entry) {
  if (!entry) {
    return 'none';
  }

  const workflowId = trimString(entry.workflow_id) ?? 'unknown';
  const workflowName = trimString(entry.workflow_name) ?? workflowId;
  const policy = trimString(entry.policy) ?? 'unknown policy';
  const governancePressure = Number.isFinite(entry.governance_pressure_score)
    ? entry.governance_pressure_score
    : 'n/a';
  const effectiveForce = Number.isFinite(entry.effective_force_score)
    ? entry.effective_force_score
    : 'n/a';
  return `${workflowId} (${workflowName}) | policy: ${policy} | governance_pressure_score: ${governancePressure} | effective_force_score: ${effectiveForce}`;
}

export function describeGovernanceSelectionContext(selectionContext) {
  if (!selectionContext) {
    return 'none';
  }

  return [
    `basis: ${describeGovernanceSelectionBasis(selectionContext.basis)}`,
    `preferred: ${describeGovernanceSelectionContextEntry(selectionContext.preferred)}`,
    `compared: ${describeGovernanceSelectionContextEntry(selectionContext.compared)}`,
  ].join(' | ');
}

export function describeAutomaticReusePolicy(policy) {
  if (!policy?.constrained) {
    return 'no active inherited checkpoint policy';
  }

  const labels = [
    policy.workflow_tightness && policy.workflow_tightness !== 'balanced'
      ? `${policy.workflow_tightness} workflow_tightness`
      : null,
    policy.oversight_strength && policy.oversight_strength !== 'normal'
      ? `${policy.oversight_strength} oversight`
      : null,
    policy.branch_budget !== null ? `branch_budget=${policy.branch_budget}` : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(', ') : 'an inherited mainline checkpoint policy';
}

export function checkpointEffectiveForceState(checkpoint, checkpoints = []) {
  const branchMetrics = checkpointBranchMetricsState(checkpoint, checkpoints);
  const governancePressure = checkpointGovernancePressureState(checkpoint);
  const replayStatus = trimString(checkpoint?.data?.replay_state?.status) ?? 'idle';
  const evidenceCount = uniqueTrimmedStrings(
    (checkpoint?.data?.evidence_refs ?? []).map((ref) => evidenceRefKey(ref)),
  ).length;
  const evidenceMomentum = Math.min(evidenceCount, 5) * 8;
  const progressMomentum = Math.max(0, branchMetrics.lineageDepth - 1) * 6;
  const composabilityBoost = branchMetrics.composabilityScore * 5;
  const adoptionBoost = adoptionForceBoost(governancePressure.adoptionStatus);
  const divergenceDrag = branchMetrics.divergenceScore * 4;
  const constraintDrag = governanceConstraintDrag(governancePressure);
  const replayFriction = replayFrictionScore(replayStatus);
  const effectiveForceScore = Math.max(
    0,
    evidenceMomentum
      + progressMomentum
      + composabilityBoost
      + adoptionBoost
      - divergenceDrag
      - constraintDrag
      - replayFriction,
  );

  return {
    checkpointId: branchMetrics.checkpointId,
    branchId: branchMetrics.branchId,
    adoptionStatus: governancePressure.adoptionStatus,
    workflowTightness: governancePressure.workflowTightness,
    oversightStrength: governancePressure.oversightStrength,
    branchBudget: governancePressure.branchBudget,
    replayStatus,
    evidenceCount,
    lineageDepth: branchMetrics.lineageDepth,
    divergenceScore: branchMetrics.divergenceScore,
    composabilityScore: branchMetrics.composabilityScore,
    governancePressureScore: governancePressure.governancePressureScore,
    evidenceMomentum,
    progressMomentum,
    composabilityBoost,
    adoptionBoost,
    divergenceDrag,
    constraintDrag,
    replayFriction,
    effectiveForceScore,
  };
}

export function workflowRunRequiresExplicitWorkflowReuse(workflowRun) {
  return workflowRun?.status === 'failed' && warmSemanticLineageState(workflowRun).hasWarmSemanticLineage;
}
