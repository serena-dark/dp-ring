import { createHash } from 'node:crypto';
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

function normalizeCanonicalWorkflowNameMap(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(overrides)
      .map(([workflowTemplateId, workflowName]) => [
        trimString(workflowTemplateId),
        trimString(workflowName),
      ])
      .filter(([workflowTemplateId, workflowName]) => workflowTemplateId && workflowName),
  );
}

function canonicalWorkflowNameOverrides(entry) {
  const workflowTemplateId = trimString(entry?.workflow_template_id);
  const canonicalWorkflowName = trimString(entry?.canonical_workflow_name);

  return {
    ...normalizeCanonicalWorkflowNameMap(entry?.canonical_selection_context_workflow_names),
    ...normalizeCanonicalWorkflowNameMap(entry?.canonical_governance_blocked_reuse_workflow_names),
    ...normalizeCanonicalWorkflowNameMap(entry?.canonical_workflow_name_overrides),
    ...(workflowTemplateId && canonicalWorkflowName
      ? { [workflowTemplateId]: canonicalWorkflowName }
      : {}),
  };
}

function waitingTaskSelectionContextWorkflowIds(item) {
  return uniqueTrimmedStrings([
    item?.workflow_template_id,
    item?.governance_selection_context?.preferred?.workflow_id,
    item?.governance_selection_context?.compared?.workflow_id,
  ]);
}

function waitingTaskBlockedReuseWorkflowIds(item) {
  if (!Array.isArray(item?.governance_blocked_reuse)) {
    return [];
  }

  return uniqueTrimmedStrings(
    item.governance_blocked_reuse.map((candidate) => normalizeWorkflowReuseGovernanceBlock(candidate)?.id),
  );
}

function waitingTaskCanonicalWorkflowIds(item) {
  return uniqueTrimmedStrings([
    item?.workflow_template_id,
    ...waitingTaskSelectionContextWorkflowIds(item),
    ...waitingTaskBlockedReuseWorkflowIds(item),
  ]);
}

function workflowNameOverridesForIds(workflowTemplateIds = [], workflowNameById = new Map()) {
  return Object.fromEntries(
    uniqueTrimmedStrings(workflowTemplateIds)
      .map((workflowTemplateId) => [
        workflowTemplateId,
        trimString(workflowNameById.get(workflowTemplateId)),
      ])
      .filter(([, workflowName]) => Boolean(workflowName)),
  );
}

function pickWorkflowNameOverrides(overrides, workflowTemplateIds = []) {
  const workflowNameOverrides = normalizeCanonicalWorkflowNameMap(overrides);
  return Object.fromEntries(
    uniqueTrimmedStrings(workflowTemplateIds)
      .map((workflowTemplateId) => [workflowTemplateId, workflowNameOverrides[workflowTemplateId] ?? null])
      .filter(([, workflowName]) => Boolean(workflowName)),
  );
}

export async function hydrateWaitingTaskGovernanceLabels(waitingTasks = [], readArtifact = async () => null) {
  const taskIds = uniqueTrimmedStrings(waitingTasks.map((item) => item?.task_id));
  const workflowTemplateIds = uniqueTrimmedStrings(
    waitingTasks.flatMap((item) => waitingTaskCanonicalWorkflowIds(item)),
  );

  const [loadedTaskResults, loadedWorkflowResults] = await Promise.all([
    Promise.allSettled(taskIds.map((taskId) => readArtifact('task', taskId))),
    Promise.allSettled(workflowTemplateIds.map((workflowTemplateId) => readArtifact('workflow', workflowTemplateId))),
  ]);

  const taskNameById = new Map();
  for (const result of loadedTaskResults) {
    if (result.status !== 'fulfilled') {
      continue;
    }
    const taskId = trimString(result.value?.id);
    const taskName = trimString(result.value?.data?.name);
    if (taskId && taskName) {
      taskNameById.set(taskId, taskName);
    }
  }

  const workflowNameById = new Map();
  for (const result of loadedWorkflowResults) {
    if (result.status !== 'fulfilled') {
      continue;
    }
    const workflowTemplateId = trimString(result.value?.id);
    const workflowName = trimString(result.value?.data?.name);
    if (workflowTemplateId && workflowName) {
      workflowNameById.set(workflowTemplateId, workflowName);
    }
  }

  return waitingTasks.map((item) => {
    const taskId = trimString(item?.task_id);
    const workflowTemplateId = trimString(item?.workflow_template_id);
    const canonicalWorkflowNameOverridesForTask = {
      ...canonicalWorkflowNameOverrides(item),
      ...workflowNameOverridesForIds(waitingTaskCanonicalWorkflowIds(item), workflowNameById),
    };
    const canonicalSelectionContextWorkflowNames = pickWorkflowNameOverrides(
      canonicalWorkflowNameOverridesForTask,
      waitingTaskSelectionContextWorkflowIds(item),
    );
    const canonicalBlockedReuseWorkflowNames = pickWorkflowNameOverrides(
      canonicalWorkflowNameOverridesForTask,
      waitingTaskBlockedReuseWorkflowIds(item),
    );

    return {
      ...item,
      canonical_task_name:
        taskNameById.get(taskId)
        || trimString(item?.canonical_task_name)
        || trimString(item?.task_name)
        || null,
      canonical_workflow_name:
        canonicalWorkflowNameOverridesForTask[workflowTemplateId]
        || trimString(item?.canonical_workflow_name)
        || trimString(item?.workflow_name)
        || null,
      ...(Object.keys(canonicalWorkflowNameOverridesForTask).length > 0
        ? { canonical_workflow_name_overrides: canonicalWorkflowNameOverridesForTask }
        : {}),
      canonical_selection_context_workflow_names: canonicalSelectionContextWorkflowNames,
      ...(Object.keys(canonicalBlockedReuseWorkflowNames).length > 0
        ? { canonical_governance_blocked_reuse_workflow_names: canonicalBlockedReuseWorkflowNames }
        : {}),
    };
  });
}

export function workflowReuseGovernanceBlock(run, checkpoint = null) {
  const checkpointPolicy = checkpointAutomaticReusePolicyState(checkpoint);
  const checkpointId = checkpointPolicy.checkpointId
    || trimString(run?.data?.node_execution?.active_checkpoint_id)
    || null;

  if (workflowRunRequiresExplicitWorkflowReuse(run)) {
    return {
      reason: 'warm_semantic_lineage',
      checkpoint_id: checkpointId,
      adoption_status: checkpointPolicy.adoptionStatus,
    };
  }

  if (checkpointPolicy.branchBudget !== null && checkpointPolicy.branchBudget <= 0) {
    return {
      reason: 'checkpoint_branch_budget_exhausted',
      checkpoint_id: checkpointId,
      adoption_status: checkpointPolicy.adoptionStatus,
      branch_budget: checkpointPolicy.branchBudget,
      workflow_tightness:
        checkpointPolicy.workflowTightness !== 'balanced' ? checkpointPolicy.workflowTightness : null,
      oversight_strength:
        checkpointPolicy.oversightStrength !== 'normal' ? checkpointPolicy.oversightStrength : null,
    };
  }

  if (checkpointPolicy.adoptionStatus && checkpointPolicy.adoptionStatus !== 'mainline') {
    return {
      reason: `checkpoint_${checkpointPolicy.adoptionStatus}`,
      checkpoint_id: checkpointId,
      adoption_status: checkpointPolicy.adoptionStatus,
    };
  }

  return null;
}

export function describeWorkflowReuseGovernanceBlock(block) {
  if (!block) {
    return 'automatic reuse is governance-blocked';
  }

  const item = normalizeWorkflowReuseGovernanceBlock(block);
  const label = `${item.id ?? 'unknown'} (${item.name ?? item.id ?? 'unknown'})`;
  if (item.reason === 'warm_semantic_lineage') {
    return `${label} already has warm semantic checkpoint lineage that requires an explicit governance decision before reuse`;
  }

  if (item.reason === 'checkpoint_branch_budget_exhausted') {
    const checkpointLabel = item.checkpoint_id
      ? `active checkpoint ${item.checkpoint_id}`
      : 'the active checkpoint';
    const governanceLabels = [
      item.workflow_tightness ? `${item.workflow_tightness} workflow_tightness` : null,
      item.oversight_strength ? `${item.oversight_strength} oversight` : null,
    ].filter(Boolean);
    return `${label} last exhausted branch_budget=${item.branch_budget ?? 0} at ${checkpointLabel}${governanceLabels.length ? ` under ${governanceLabels.join(' / ')}` : ''}, so automatic reuse stays blocked until a later run clears that constraint`;
  }

  const checkpointLabel = item.checkpoint_id
    ? `active checkpoint ${item.checkpoint_id}`
    : 'the active checkpoint';
  if (item.adoption_status === 'synthesized') {
    return `${label} still ends on synthesized lineage at ${checkpointLabel}, so adoption into mainline has not happened yet`;
  }
  if (item.adoption_status === 'discarded') {
    return `${label} still ends on discarded lineage at ${checkpointLabel}`;
  }
  if (item.adoption_status) {
    return `${label} still ends on ${item.adoption_status} lineage at ${checkpointLabel} instead of mainline`;
  }
  return `${label} is governance-blocked for automatic reuse`;
}

export function describeWorkflowReuseGovernanceBlockList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'none';
  }
  return items.map((item) => describeWorkflowReuseGovernanceBlock(item)).join('; ');
}

export function describeWorkflowReuseGovernanceReenableGuidance(block) {
  if (!block) {
    return 'Keep automatic reuse disabled until governance records an explicit re-enable decision.';
  }

  const item = normalizeWorkflowReuseGovernanceBlock(block);
  const label = `${item.id ?? 'unknown'} (${item.name ?? item.id ?? 'unknown'})`;
  const checkpointLabel = item.checkpoint_id
    ? `active checkpoint ${item.checkpoint_id}`
    : 'the active checkpoint';

  if (item.reason === 'warm_semantic_lineage') {
    return `${label} should stay off automatic reuse until governance records an explicit reuse decision for its warm semantic lineage.`;
  }

  if (item.reason === 'checkpoint_branch_budget_exhausted') {
    return `${label} should stay off automatic reuse until a later mainline checkpoint clears branch_budget=${item.branch_budget ?? 0} at ${checkpointLabel}.`;
  }

  if (item.adoption_status === 'synthesized') {
    return `${label} should stay off automatic reuse until ${checkpointLabel} is explicitly adopted into mainline.`;
  }

  if (item.adoption_status === 'discarded') {
    return `${label} should stay off automatic reuse unless governance creates a later mainline checkpoint that supersedes discarded lineage at ${checkpointLabel}.`;
  }

  if (item.adoption_status) {
    return `${label} should stay off automatic reuse until ${checkpointLabel} is explicitly adopted into mainline from ${item.adoption_status} lineage.`;
  }

  return `${label} should stay off automatic reuse until governance records an explicit re-enable decision.`;
}

export function describeWorkflowReuseGovernanceReenableGuidanceList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'none';
  }
  return items.map((item) => describeWorkflowReuseGovernanceReenableGuidance(item)).join('; ');
}

export function waitingTaskGovernanceBlockedReuse(recommendation, workflowSource) {
  if (workflowSource !== 'custom_generated' || recommendation?.recommended) {
    return [];
  }

  return Array.isArray(recommendation?.governance_blocked_candidates)
    ? recommendation.governance_blocked_candidates
        .map((item) => normalizeWorkflowReuseGovernanceBlock(item))
        .filter((item) => item.id && item.name && item.reason)
    : [];
}

export function describeWaitingTaskGovernance(waitingTask) {
  return describeWorkflowReuseGovernanceBlockList(waitingTask?.governance_blocked_reuse ?? []);
}

function governanceBatchIdentityEntries(waitingTasks = []) {
  return waitingTasks.flatMap((item) =>
    Array.isArray(item?.governance_blocked_reuse)
      ? item.governance_blocked_reuse
          .map((candidate) => normalizeWorkflowReuseGovernanceBlock(candidate))
          .filter((candidate) => candidate.reason)
          .map((candidate) => ({
            reason: candidate.reason,
            workflow_template_id: candidate.id,
            checkpoint_id: candidate.checkpoint_id,
            adoption_status: candidate.adoption_status,
            branch_budget: candidate.branch_budget,
            workflow_tightness: candidate.workflow_tightness,
            oversight_strength: candidate.oversight_strength,
          }))
      : [],
  );
}

export function governanceBatchSignature(waitingTasks = []) {
  const identities = governanceBatchIdentityEntries(waitingTasks);
  if (identities.length === 0) {
    return null;
  }

  const reasonSignature = [...new Set(identities.map((item) => item.reason))].sort().join('+');
  const identityFingerprint = createHash('sha256')
    .update(
      [...new Set(identities.map((item) => JSON.stringify(item)))].sort().join('|'),
      'utf-8',
    )
    .digest('hex')
    .slice(0, 12);
  return `${reasonSignature}:${identityFingerprint}`;
}

function blockedReuseSessionEntryKey(entry) {
  return [
    trimString(entry?.task_id),
    trimString(entry?.workflow_template_id),
    trimString(entry?.reason),
    trimString(entry?.checkpoint_id),
    trimString(entry?.adoption_status),
    nonNegativeInteger(entry?.branch_budget),
    trimString(entry?.workflow_tightness),
    trimString(entry?.oversight_strength),
  ].join('|');
}

export function buildSessionGovernanceContext(waitingTasks = []) {
  const blockedReuse = [];
  const seenBlockedReuse = new Set();
  for (const item of waitingTasks) {
    const taskId = trimString(item?.task_id);
    const taskName = trimString(item?.canonical_task_name) ?? trimString(item?.task_name);
    const workflowNameOverrides = canonicalWorkflowNameOverrides(item);
    if (!taskId || !Array.isArray(item?.governance_blocked_reuse)) {
      continue;
    }
    for (const rawCandidate of item.governance_blocked_reuse) {
      const candidate = normalizeWorkflowReuseGovernanceBlock(rawCandidate);
      const workflowName = workflowNameOverrides[candidate.id] ?? candidate.name;
      if (!candidate.id || !workflowName || !candidate.reason) {
        continue;
      }
      const entry = {
        task_id: taskId,
        task_name: taskName,
        workflow_template_id: candidate.id,
        workflow_name: workflowName,
        reason: candidate.reason,
        checkpoint_id: candidate.checkpoint_id,
        adoption_status: candidate.adoption_status,
        branch_budget: candidate.branch_budget,
        workflow_tightness: candidate.workflow_tightness,
        oversight_strength: candidate.oversight_strength,
        detail: describeWorkflowReuseGovernanceBlock({
          ...candidate,
          name: workflowName,
        }),
      };
      const entryKey = blockedReuseSessionEntryKey(entry);
      if (seenBlockedReuse.has(entryKey)) {
        continue;
      }
      seenBlockedReuse.add(entryKey);
      blockedReuse.push(entry);
    }
  }

  if (blockedReuse.length === 0) {
    return null;
  }

  return {
    source: 'governance_blocked_reuse',
    isolated_batch: true,
    batch_signature: governanceBatchSignature(waitingTasks),
    reasons: [...new Set(blockedReuse.map((item) => item.reason))].sort(),
    blocked_reuse: blockedReuse,
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

function normalizeGovernanceSelectionContextEntry(entry) {
  const workflowId = trimString(entry?.workflow_id);
  const policy = trimString(entry?.policy);
  if (!workflowId || !policy) {
    return null;
  }

  return {
    workflow_id: workflowId,
    workflow_name: trimString(entry?.workflow_name) ?? workflowId,
    policy,
    governance_pressure_score: Number.isFinite(entry?.governance_pressure_score)
      ? entry.governance_pressure_score
      : null,
    effective_force_score: normalizeEffectiveForceScore(entry?.effective_force_score),
  };
}

function normalizeGovernanceSelectionContext(selectionContext) {
  const basis = trimString(selectionContext?.basis);
  const preferred = normalizeGovernanceSelectionContextEntry(selectionContext?.preferred);
  const compared = normalizeGovernanceSelectionContextEntry(selectionContext?.compared);
  if (!basis || !preferred || !compared) {
    return null;
  }

  return {
    basis,
    preferred,
    compared,
  };
}

function normalizeSelectionContextWorkflowNameOverrides(overrides) {
  const normalizedOverrides = new Map();
  if (!overrides || typeof overrides !== 'object') {
    return normalizedOverrides;
  }

  for (const [workflowTemplateId, workflowName] of Object.entries(overrides)) {
    const normalizedWorkflowTemplateId = trimString(workflowTemplateId);
    const normalizedWorkflowName = trimString(workflowName);
    if (!normalizedWorkflowTemplateId || !normalizedWorkflowName) {
      continue;
    }
    normalizedOverrides.set(normalizedWorkflowTemplateId, normalizedWorkflowName);
  }

  return normalizedOverrides;
}

function canonicalizeSelectionContextWorkflowLabels(selectionContext, workflowNameOverrides) {
  const normalizedOverrides = normalizeSelectionContextWorkflowNameOverrides(workflowNameOverrides);
  if (!selectionContext || normalizedOverrides.size === 0) {
    return selectionContext;
  }

  const nextSelectionContext = structuredClone(selectionContext);
  for (const key of ['preferred', 'compared']) {
    const workflowTemplateId = trimString(nextSelectionContext?.[key]?.workflow_id);
    const canonicalWorkflowName = normalizedOverrides.get(workflowTemplateId);
    if (workflowTemplateId && canonicalWorkflowName) {
      nextSelectionContext[key].workflow_name = canonicalWorkflowName;
    }
  }
  return nextSelectionContext;
}

function selectionContextWorkflowDisplayName(entry) {
  const workflowTemplateId = trimString(entry?.workflow_template_id);
  const canonicalWorkflowName = trimString(entry?.canonical_workflow_name);
  if (canonicalWorkflowName) {
    return canonicalWorkflowName;
  }
  if (!workflowTemplateId) {
    return null;
  }

  const preferredWorkflowId = trimString(entry?.selection_context?.preferred?.workflow_id);
  if (preferredWorkflowId === workflowTemplateId) {
    return trimString(entry?.selection_context?.preferred?.workflow_name) || workflowTemplateId;
  }

  const comparedWorkflowId = trimString(entry?.selection_context?.compared?.workflow_id);
  if (comparedWorkflowId === workflowTemplateId) {
    return trimString(entry?.selection_context?.compared?.workflow_name) || workflowTemplateId;
  }

  return trimString(entry?.workflow_name) || workflowTemplateId;
}

function selectionContextSessionEntry(entry) {
  const taskId = trimString(entry?.task_id);
  const workflowTemplateId = trimString(entry?.workflow_template_id);
  const canonicalWorkflowName = trimString(entry?.canonical_workflow_name);
  const selectionContextWorkflowNames = canonicalWorkflowNameOverrides(entry);
  const selectionContext = canonicalizeSelectionContextWorkflowLabels(
    normalizeGovernanceSelectionContext(entry?.selection_context),
    selectionContextWorkflowNames,
  );
  if (!taskId || !workflowTemplateId || !selectionContext) {
    return null;
  }

  return {
    task_id: taskId,
    task_name: trimString(entry?.canonical_task_name) || trimString(entry?.task_name) || null,
    workflow_template_id: workflowTemplateId,
    workflow_name: selectionContextWorkflowDisplayName({
      workflow_template_id: workflowTemplateId,
      workflow_name: entry?.workflow_name,
      canonical_workflow_name: canonicalWorkflowName,
      selection_context: selectionContext,
    }),
    selection_context: structuredClone(selectionContext),
  };
}

function selectionContextSessionEntryKey(entry) {
  return JSON.stringify({
    task_id: trimString(entry?.task_id),
    task_name: trimString(entry?.task_name),
    workflow_template_id: trimString(entry?.workflow_template_id),
    workflow_name: trimString(entry?.workflow_name),
    selection_context: normalizeGovernanceSelectionContext(entry?.selection_context),
  });
}

export function sessionGovernanceSelectionContexts(readyTasks = []) {
  const selectionContexts = [];
  const seenSelectionContexts = new Set();
  for (const item of readyTasks) {
    const entry = selectionContextSessionEntry({
      task_id: item?.task_id,
      task_name: item?.task_name,
      canonical_task_name: item?.canonical_task_name,
      workflow_template_id: item?.workflow_template_id,
      workflow_name: item?.workflow_name,
      canonical_workflow_name: item?.canonical_workflow_name,
      canonical_workflow_name_overrides: item?.canonical_workflow_name_overrides,
      canonical_selection_context_workflow_names: item?.canonical_selection_context_workflow_names,
      selection_context: item?.governance_selection_context,
    });
    if (!entry) {
      continue;
    }

    const entryKey = selectionContextSessionEntryKey(entry);
    if (seenSelectionContexts.has(entryKey)) {
      continue;
    }
    seenSelectionContexts.add(entryKey);
    selectionContexts.push(entry);
  }

  return selectionContexts;
}

export function canonicalizeWaitingTaskGovernanceLabels(readyTasks = []) {
  const selectionContextByTaskId = new Map(
    sessionGovernanceSelectionContexts(readyTasks).map((entry) => [trimString(entry?.task_id), entry]),
  );

  return readyTasks.map((item) => {
    const taskId = trimString(item?.task_id);
    const selectionContextEntry = selectionContextByTaskId.get(taskId) ?? null;
    return {
      ...item,
      task_name: selectionContextEntry?.task_name
        || trimString(item?.canonical_task_name)
        || trimString(item?.task_name)
        || null,
      workflow_name: selectionContextEntry?.workflow_name
        || trimString(item?.canonical_workflow_name)
        || trimString(item?.workflow_name)
        || null,
      governance_selection_context:
        selectionContextEntry?.selection_context ?? structuredClone(item?.governance_selection_context ?? null),
    };
  });
}

export function buildSessionContextInjected(readyTasks = []) {
  const workflowTemplateIds = [...new Set(
    readyTasks
      .map((item) => trimString(item?.workflow_template_id))
      .filter(Boolean),
  )];

  return {
    workflow_template: workflowTemplateIds.length === 1 ? workflowTemplateIds[0] : null,
    distillations_applied: [],
    registry_rank_at_selection: null,
    governance_selection_contexts: sessionGovernanceSelectionContexts(readyTasks),
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
