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

export function workflowRunRequiresExplicitWorkflowReuse(workflowRun) {
  return workflowRun?.status === 'failed' && warmSemanticLineageState(workflowRun).hasWarmSemanticLineage;
}
