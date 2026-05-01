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

function normalizeReusableWorkflowCandidate(candidate) {
  const id = trimString(candidate?.id)
    ?? trimString(candidate?.workflow_template_id)
    ?? trimString(candidate?.workflow_name)
    ?? trimString(candidate?.name)
    ?? null;
  const name = trimString(candidate?.name)
    ?? trimString(candidate?.workflow_name)
    ?? trimString(candidate?.id)
    ?? trimString(candidate?.workflow_template_id)
    ?? null;

  return {
    id,
    name,
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

function waitingTaskSelectionContext(item, fallbackWaitingTask = null) {
  return item?.governance_selection_context ?? fallbackWaitingTask?.governance_selection_context ?? null;
}

function waitingTaskSelectionContextWorkflowIds(item, fallbackWaitingTask = null) {
  const selectionContext = waitingTaskSelectionContext(item, fallbackWaitingTask);
  return uniqueTrimmedStrings([
    item?.workflow_template_id,
    fallbackWaitingTask?.workflow_template_id,
    selectionContext?.preferred?.workflow_id,
    selectionContext?.compared?.workflow_id,
  ]);
}

function waitingTaskBlockedReuseWorkflowIds(item, fallbackWaitingTask = null) {
  const currentCandidateIds = Array.isArray(item?.governance_blocked_reuse)
    ? item.governance_blocked_reuse.map((candidate) => normalizeWorkflowReuseGovernanceBlock(candidate)?.id)
    : [];
  const fallbackCandidateIds = Array.isArray(fallbackWaitingTask?.governance_blocked_reuse)
    ? fallbackWaitingTask.governance_blocked_reuse.map(
        (candidate) => normalizeWorkflowReuseGovernanceBlock(candidate)?.id,
      )
    : [];

  return uniqueTrimmedStrings([
    ...currentCandidateIds,
    ...fallbackCandidateIds,
  ]);
}

function waitingTaskReusableCandidateWorkflowIds(item, fallbackWaitingTask = null) {
  const currentCandidateIds = Array.isArray(item?.reusable_candidates)
    ? item.reusable_candidates.map((candidate) => normalizeReusableWorkflowCandidate(candidate)?.id)
    : [];
  const fallbackCandidateIds = Array.isArray(fallbackWaitingTask?.reusable_candidates)
    ? fallbackWaitingTask.reusable_candidates.map(
        (candidate) => normalizeReusableWorkflowCandidate(candidate)?.id,
      )
    : [];

  return uniqueTrimmedStrings([
    ...currentCandidateIds,
    ...fallbackCandidateIds,
  ]);
}

function waitingTaskCanonicalWorkflowIds(item, fallbackWaitingTask = null) {
  return uniqueTrimmedStrings([
    item?.workflow_template_id,
    ...waitingTaskSelectionContextWorkflowIds(item, fallbackWaitingTask),
    ...waitingTaskBlockedReuseWorkflowIds(item, fallbackWaitingTask),
    ...waitingTaskReusableCandidateWorkflowIds(item, fallbackWaitingTask),
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

function waitingTaskLookup(waitingTasks = []) {
  if (waitingTasks instanceof Map) {
    return new Map(
      [...waitingTasks.entries()]
        .map(([taskId, item]) => [trimString(taskId) ?? trimString(item?.task_id), item])
        .filter(([taskId]) => Boolean(taskId)),
    );
  }

  if (Array.isArray(waitingTasks)) {
    return new Map(
      waitingTasks
        .map((item) => [trimString(item?.task_id), item])
        .filter(([taskId]) => Boolean(taskId)),
    );
  }

  return new Map();
}

export async function hydrateWaitingTaskGovernanceLabels(
  waitingTasks = [],
  readArtifact = async () => null,
  fallbackWaitingTasks = [],
) {
  const fallbackWaitingTaskById = waitingTaskLookup(fallbackWaitingTasks);
  const taskIds = uniqueTrimmedStrings(waitingTasks.map((item) => item?.task_id));
  const workflowTemplateIds = uniqueTrimmedStrings(
    waitingTasks.flatMap((item) => {
      const taskId = trimString(item?.task_id);
      return waitingTaskCanonicalWorkflowIds(item, fallbackWaitingTaskById.get(taskId) ?? null);
    }),
  );

  const [loadedTaskResults, loadedWorkflowResults] = await Promise.all([
    Promise.allSettled(taskIds.map((taskId) => readArtifact('task', taskId))),
    Promise.allSettled(workflowTemplateIds.map((workflowTemplateId) => readArtifact('workflow', workflowTemplateId))),
  ]);

  const taskNameById = new Map();
  const taskReplanningHandoffById = new Map();
  for (const result of loadedTaskResults) {
    if (result.status !== 'fulfilled') {
      continue;
    }
    const taskId = trimString(result.value?.id);
    const taskName = trimString(result.value?.data?.name);
    if (taskId && taskName) {
      taskNameById.set(taskId, taskName);
    }
    const replanningHandoff = waitingTaskReplanningHandoff(result.value?.data?.replanning);
    if (taskId && replanningHandoff) {
      taskReplanningHandoffById.set(taskId, replanningHandoff);
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
    const fallbackWaitingTask = fallbackWaitingTaskById.get(taskId) ?? null;
    const selectionContext = normalizeGovernanceSelectionContext(
      waitingTaskSelectionContext(item, fallbackWaitingTask),
    );
    const workflowTemplateId = trimString(item?.workflow_template_id)
      || trimString(fallbackWaitingTask?.workflow_template_id)
      || trimString(selectionContext?.preferred?.workflow_id)
      || null;
    const replanningHandoff =
      taskReplanningHandoffById.get(taskId) ?? waitingTaskReplanningHandoff(item);
    const canonicalWorkflowNameOverridesForTask = {
      ...canonicalWorkflowNameOverrides(fallbackWaitingTask),
      ...canonicalWorkflowNameOverrides(item),
      ...workflowNameOverridesForIds(
        waitingTaskCanonicalWorkflowIds(item, fallbackWaitingTask),
        workflowNameById,
      ),
    };
    const canonicalSelectionContextWorkflowNames = pickWorkflowNameOverrides(
      canonicalWorkflowNameOverridesForTask,
      waitingTaskSelectionContextWorkflowIds(item, fallbackWaitingTask),
    );
    const canonicalBlockedReuseWorkflowNames = pickWorkflowNameOverrides(
      canonicalWorkflowNameOverridesForTask,
      waitingTaskBlockedReuseWorkflowIds(item, fallbackWaitingTask),
    );
    const reusableCandidates = canonicalizeWaitingTaskReusableCandidates(
      {
        ...fallbackWaitingTask,
        ...item,
        canonical_workflow_name_overrides: canonicalWorkflowNameOverridesForTask,
      },
      fallbackWaitingTask?.reusable_candidates,
    );
    const preferredReuse = trimString(item?.preferred_reuse)
      || trimString(fallbackWaitingTask?.preferred_reuse)
      || null;
    const canonicalWorkflowName = workflowTemplateId
      ? canonicalWorkflowNameOverridesForTask[workflowTemplateId]
        || trimString(item?.canonical_workflow_name)
        || trimString(fallbackWaitingTask?.canonical_workflow_name)
        || null
      : trimString(item?.canonical_workflow_name)
        || trimString(fallbackWaitingTask?.canonical_workflow_name)
        || null;
    const fallbackWorkflowName = item?.workflow_name
      ?? fallbackWaitingTask?.workflow_name
      ?? (trimString(selectionContext?.preferred?.workflow_id) === workflowTemplateId
        ? selectionContext?.preferred?.workflow_name ?? null
        : null);

    return {
      ...item,
      ...(trimString(item?.workflow_template_id)
        ? {}
        : workflowTemplateId
          ? { workflow_template_id: fallbackWaitingTask?.workflow_template_id ?? workflowTemplateId }
          : {}),
      ...(trimString(item?.workflow_name) || fallbackWorkflowName == null
        ? {}
        : { workflow_name: fallbackWorkflowName }),
      governance_selection_context:
        item?.governance_selection_context ?? fallbackWaitingTask?.governance_selection_context ?? null,
      ...(preferredReuse ? { preferred_reuse: preferredReuse } : {}),
      ...(reusableCandidates.length > 0 ? { reusable_candidates: reusableCandidates } : {}),
      canonical_task_name:
        taskNameById.get(taskId)
        || trimString(item?.canonical_task_name)
        || trimString(item?.task_name)
        || null,
      canonical_workflow_name:
        canonicalWorkflowName
        || trimString(item?.workflow_name)
        || trimString(fallbackWaitingTask?.workflow_name)
        || null,
      ...(replanningHandoff ?? {}),
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

function waitingTaskReplanningHandoff(replanning) {
  const replanningSource = replanning?.replanning_handoff ?? replanning;
  const parentTaskId = trimString(replanningSource?.parent_task_id);
  const parentDecisionNote = trimString(replanningSource?.parent_decision_note);
  if (!parentTaskId || !parentDecisionNote) {
    return null;
  }

  return {
    parent_task_id: parentTaskId,
    parent_decision_note: parentDecisionNote,
  };
}

function sessionReplanningHandoffs(readyTasks = []) {
  const handoffs = [];
  const seenTaskIds = new Set();
  for (const item of readyTasks) {
    const taskId = trimString(item?.task_id);
    if (!taskId || seenTaskIds.has(taskId)) {
      continue;
    }

    const replanningHandoff = waitingTaskReplanningHandoff(item);
    if (!replanningHandoff) {
      continue;
    }

    seenTaskIds.add(taskId);
    handoffs.push({
      task_id: taskId,
      task_name: trimString(item?.canonical_task_name) || trimString(item?.task_name) || null,
      parent_task_id: replanningHandoff.parent_task_id,
      parent_decision_note: replanningHandoff.parent_decision_note,
    });
  }

  return handoffs;
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

export function canonicalizeWaitingTaskGovernanceBlockedReuse(
  waitingTask,
  fallbackCandidates = null,
) {
  const rawCandidates = Array.isArray(waitingTask?.governance_blocked_reuse)
    && waitingTask.governance_blocked_reuse.length > 0
    ? waitingTask.governance_blocked_reuse
    : Array.isArray(fallbackCandidates)
      ? fallbackCandidates
      : [];

  const workflowNameOverrides = canonicalWorkflowNameOverrides(waitingTask);
  return rawCandidates
    .map((rawCandidate) => {
      const candidate = normalizeWorkflowReuseGovernanceBlock(rawCandidate);
      const workflowName = workflowNameOverrides[candidate.id] ?? candidate.name;
      if (!candidate.id || !workflowName || !candidate.reason) {
        return null;
      }
      return {
        ...candidate,
        name: workflowName,
      };
    })
    .filter(Boolean);
}

function canonicalizeWaitingTaskReusableCandidates(
  waitingTask,
  fallbackCandidates = null,
) {
  const rawCandidates = Array.isArray(waitingTask?.reusable_candidates)
    && waitingTask.reusable_candidates.length > 0
    ? waitingTask.reusable_candidates
    : Array.isArray(fallbackCandidates)
      ? fallbackCandidates
      : [];

  const workflowNameOverrides = canonicalWorkflowNameOverrides(waitingTask);
  const seenCandidateIds = new Set();
  return rawCandidates
    .map((rawCandidate) => {
      const candidate = normalizeReusableWorkflowCandidate(rawCandidate);
      const workflowName = workflowNameOverrides[candidate.id] ?? candidate.name;
      if (!candidate.id || !workflowName || seenCandidateIds.has(candidate.id)) {
        return null;
      }
      seenCandidateIds.add(candidate.id);
      return {
        id: candidate.id,
        name: workflowName,
      };
    })
    .filter(Boolean);
}

export function describeWaitingTaskGovernance(waitingTask) {
  return describeWorkflowReuseGovernanceBlockList(
    canonicalizeWaitingTaskGovernanceBlockedReuse(waitingTask),
  );
}

export function describeWaitingTaskReplanningHandoff(waitingTask) {
  const replanningHandoff = waitingTaskReplanningHandoff(waitingTask);
  if (!replanningHandoff) {
    return 'none';
  }

  return `parent_task_id: ${replanningHandoff.parent_task_id} | parent_decision_note: ${replanningHandoff.parent_decision_note}`;
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
    if (!taskId) {
      continue;
    }
    for (const candidate of canonicalizeWaitingTaskGovernanceBlockedReuse(item)) {
      const entry = {
        task_id: taskId,
        task_name: taskName,
        workflow_template_id: candidate.id,
        workflow_name: candidate.name,
        reason: candidate.reason,
        checkpoint_id: candidate.checkpoint_id,
        adoption_status: candidate.adoption_status,
        branch_budget: candidate.branch_budget,
        workflow_tightness: candidate.workflow_tightness,
        oversight_strength: candidate.oversight_strength,
        detail: describeWorkflowReuseGovernanceBlock(candidate),
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

export function canonicalizeWaitingTaskGovernanceLabels(
  readyTasks = [],
  fallbackWaitingTasks = [],
) {
  const selectionContextByTaskId = new Map(
    sessionGovernanceSelectionContexts(readyTasks).map((entry) => [trimString(entry?.task_id), entry]),
  );
  const fallbackWaitingTaskById = waitingTaskLookup(fallbackWaitingTasks);

  return readyTasks.map((item) => {
    const taskId = trimString(item?.task_id);
    const selectionContextEntry = selectionContextByTaskId.get(taskId) ?? null;
    const fallbackWaitingTask = fallbackWaitingTaskById.get(taskId) ?? null;
    const labelCarrier = {
      ...fallbackWaitingTask,
      ...item,
      canonical_workflow_name_overrides: {
        ...(fallbackWaitingTask?.canonical_workflow_name_overrides ?? {}),
        ...(item?.canonical_workflow_name_overrides ?? {}),
      },
      canonical_selection_context_workflow_names: {
        ...(fallbackWaitingTask?.canonical_selection_context_workflow_names ?? {}),
        ...(item?.canonical_selection_context_workflow_names ?? {}),
      },
      canonical_governance_blocked_reuse_workflow_names: {
        ...(fallbackWaitingTask?.canonical_governance_blocked_reuse_workflow_names ?? {}),
        ...(item?.canonical_governance_blocked_reuse_workflow_names ?? {}),
      },
    };
    const workflowNameOverrides = canonicalWorkflowNameOverrides(labelCarrier);
    const fallbackSelectionContext = canonicalizeSelectionContextWorkflowLabels(
      normalizeGovernanceSelectionContext(waitingTaskSelectionContext(item, fallbackWaitingTask)),
      workflowNameOverrides,
    );
    const recoveredWorkflowTemplateId = trimString(item?.workflow_template_id)
      || trimString(fallbackWaitingTask?.workflow_template_id)
      || trimString(fallbackSelectionContext?.preferred?.workflow_id)
      || null;
    const canonicalWorkflowName = trimString(item?.canonical_workflow_name)
      || trimString(fallbackWaitingTask?.canonical_workflow_name)
      || (recoveredWorkflowTemplateId ? workflowNameOverrides[recoveredWorkflowTemplateId] ?? null : null);
    const governanceBlockedReuse = canonicalizeWaitingTaskGovernanceBlockedReuse(
      labelCarrier,
      fallbackWaitingTask?.governance_blocked_reuse,
    );
    const reusableCandidates = canonicalizeWaitingTaskReusableCandidates(
      labelCarrier,
      fallbackWaitingTask?.reusable_candidates,
    );
    const preferredReuse = trimString(item?.preferred_reuse)
      || trimString(fallbackWaitingTask?.preferred_reuse)
      || null;
    const governanceReenableGuidance = describeWorkflowReuseGovernanceReenableGuidanceList(
      governanceBlockedReuse,
    );
    return {
      ...item,
      ...(trimString(item?.workflow_template_id)
        ? {}
        : recoveredWorkflowTemplateId
          ? { workflow_template_id: fallbackWaitingTask?.workflow_template_id ?? recoveredWorkflowTemplateId }
          : {}),
      task_name: selectionContextEntry?.task_name
        || trimString(item?.canonical_task_name)
        || trimString(item?.task_name)
        || null,
      workflow_name: selectionContextEntry?.workflow_name
        || canonicalWorkflowName
        || selectionContextWorkflowDisplayName({
          workflow_template_id: recoveredWorkflowTemplateId,
          workflow_name: item?.workflow_name ?? fallbackWaitingTask?.workflow_name,
          canonical_workflow_name: canonicalWorkflowName,
          selection_context: fallbackSelectionContext,
        })
        || trimString(item?.workflow_name)
        || trimString(fallbackWaitingTask?.workflow_name)
        || null,
      governance_selection_context:
        selectionContextEntry?.selection_context ?? fallbackSelectionContext ?? null,
      ...(preferredReuse ? { preferred_reuse: preferredReuse } : {}),
      ...(reusableCandidates.length > 0 ? { reusable_candidates: reusableCandidates } : {}),
      governance_blocked_reuse: governanceBlockedReuse,
      governance_reenable_guidance: governanceReenableGuidance,
      ...(Object.keys(workflowNameOverrides).length > 0
        ? { canonical_workflow_name_overrides: workflowNameOverrides }
        : {}),
    };
  });
}

function summarizeWorkflowPreparationRecommendation(recommendation) {
  if (!recommendation?.recommended) {
    const blockedSummary = describeWorkflowReuseGovernanceBlockList(
      recommendation?.governance_blocked_candidates ?? [],
    );
    if (blockedSummary !== 'none') {
      return `Automatic reuse is withheld because ${blockedSummary}.`;
    }
    return 'No ranked workflow recommendation yet.';
  }

  const workflowId = trimString(recommendation?.recommended?.workflow?.id) ?? 'unknown-workflow';
  const workflowName = trimString(recommendation?.recommended?.workflow?.data?.name) ?? workflowId;
  const rank = Number.isFinite(recommendation?.recommended?.rank)
    ? recommendation.recommended.rank
    : '--';
  const mode = trimString(recommendation?.recommended?.mode) ?? 'direct selection';
  const note = trimString(recommendation?.recommended?.note);
  const summary = `${workflowId} (${workflowName}) rank ${rank} via ${mode}.`;
  return note ? `${summary} ${note}` : summary;
}

function workflowPreparationReusableCandidates(recommendation) {
  if (!Array.isArray(recommendation?.candidates)) {
    return [];
  }
  return recommendation.candidates
    .map((item) => {
      const id = trimString(item?.id);
      if (!id) {
        return null;
      }
      return {
        id,
        name: trimString(item?.name) ?? trimString(item?.data?.name) ?? id,
      };
    })
    .filter(Boolean);
}

function describeWorkflowPreparationReusableCandidates(waitingTask, includeNames = true) {
  if (!Array.isArray(waitingTask?.reusable_candidates) || waitingTask.reusable_candidates.length === 0) {
    return 'none';
  }
  return waitingTask.reusable_candidates
    .map((item) => {
      const workflowId = trimString(item?.id);
      const workflowName = trimString(item?.name) ?? workflowId;
      if (!workflowId) {
        return null;
      }
      return includeNames ? `${workflowId} (${workflowName})` : workflowId;
    })
    .filter(Boolean)
    .join(', ');
}

function workflowPreparationSuggestedWorkflowName(taskName, taskId) {
  if (taskName) {
    return `${taskName} Delivery Flow`;
  }
  if (taskId) {
    return `${taskId} Delivery Flow`;
  }
  return 'Waiting workflow';
}

export function buildWorkflowPreparationPayloadWaitingTask(task = {}, recommendation = null) {
  const taskId = trimString(task?.id);
  const taskName = trimString(task?.data?.name) || null;
  const taskType = trimString(task?.data?.task_type) || null;
  const milestoneId = trimString(task?.data?.milestone_id) || null;
  const replanningHandoff = waitingTaskReplanningHandoff(task?.data?.replanning ?? null);
  const recommendedWorkflow = recommendation?.recommended?.workflow ?? null;
  const workflowTemplateId = trimString(recommendedWorkflow?.id) || null;
  const workflowAction = workflowTemplateId ? 'reuse' : 'create';
  const governanceSelectionContext = recommendation?.recommended?.selection_context
    ? structuredClone(recommendation.recommended.selection_context)
    : null;
  const governanceBlockedReuse = Array.isArray(recommendation?.governance_blocked_candidates)
    ? recommendation.governance_blocked_candidates
        .map((item) => normalizeWorkflowReuseGovernanceBlock(item))
        .filter((item) => item.id && item.name && item.reason)
    : [];
  const governanceReenableGuidance = describeWorkflowReuseGovernanceReenableGuidanceList(
    governanceBlockedReuse,
  );

  return {
    task_id: taskId,
    task_name: taskName,
    task_type: taskType,
    milestone_id: milestoneId,
    task_document_path: taskId ? `docs/tasks/${taskId}/${taskId}.md` : null,
    replanning_handoff: replanningHandoff,
    workflow_action: workflowAction,
    workflow_template_id: workflowTemplateId,
    workflow_name: workflowTemplateId
      ? trimString(recommendedWorkflow?.data?.name) ?? workflowTemplateId
      : workflowPreparationSuggestedWorkflowName(taskName, taskId),
    preferred_reuse: summarizeWorkflowPreparationRecommendation(recommendation),
    reusable_candidates: workflowPreparationReusableCandidates(recommendation),
    governance_selection_context: governanceSelectionContext,
    governance_blocked_reuse: governanceBlockedReuse,
    governance_reenable_guidance: governanceReenableGuidance,
  };
}

export function buildWorkflowPreparationReuseGuidanceView(waitingTask = {}) {
  return {
    preferredReuse: trimString(waitingTask?.preferred_reuse) ?? 'No ranked workflow recommendation yet.',
    governanceSelectionContext: describeGovernanceSelectionContext(
      waitingTask?.governance_selection_context ?? null,
    ),
    reusableCandidatesWithNames: describeWorkflowPreparationReusableCandidates(waitingTask, true),
    reusableCandidatesWithoutNames: describeWorkflowPreparationReusableCandidates(waitingTask, false),
    governanceBlockedReuse: describeWaitingTaskGovernance(waitingTask),
    governanceReenableGuidance: trimString(waitingTask?.governance_reenable_guidance) ?? 'none',
  };
}

export function buildWorkflowPreparationTaskHeaderView(waitingTask = {}) {
  const taskId = trimString(waitingTask?.task_id) ?? 'unknown-task';
  const taskName = trimString(waitingTask?.task_name) ?? 'Unnamed task';

  return {
    taskId,
    taskName,
    taskLabel: `${taskId}: ${taskName}`,
    taskType: trimString(waitingTask?.task_type) ?? 'unknown',
    milestoneId: trimString(waitingTask?.milestone_id) ?? 'unknown',
    taskDocumentPath: trimString(waitingTask?.task_document_path) ?? 'none',
    replanningHandoff: describeWaitingTaskReplanningHandoff(waitingTask),
  };
}

function workflowPreparationDefaultCreateStepLines() {
  return [
    '- s1 | inspect | Review the task document and requirement context | inputs: task-document, requirement-document | outputs: scoped-plan',
    '- s2 | execute | Produce the task deliverable | inputs: scoped-plan | outputs: candidate-output',
    '- s3 | verify | Validate the task output against acceptance criteria | inputs: candidate-output, acceptance-criteria | outputs: verification-report',
  ];
}

export function buildWorkflowPreparationScaffoldActionView(waitingTask = {}) {
  const workflowTemplateId = trimString(waitingTask?.workflow_template_id);
  const workflowAction = trimString(waitingTask?.workflow_action) === 'reuse' && workflowTemplateId
    ? 'reuse'
    : 'create';
  const taskHeaderView = buildWorkflowPreparationTaskHeaderView(waitingTask);
  const reuseGuidanceView = buildWorkflowPreparationReuseGuidanceView(waitingTask);

  if (workflowAction === 'reuse') {
    return {
      workflowAction,
      bodyLines: [
        `Workflow ID: ${workflowTemplateId}`,
        '',
        `Preferred reuse: ${reuseGuidanceView.preferredReuse}`,
        `Governance selection context: ${reuseGuidanceView.governanceSelectionContext}`,
        `Other candidates: ${reuseGuidanceView.reusableCandidatesWithoutNames}`,
        `Governance-blocked reuse: ${reuseGuidanceView.governanceBlockedReuse}`,
        `Governance re-enable guidance: ${reuseGuidanceView.governanceReenableGuidance}`,
      ],
    };
  }

  const bodyLines = [
    `Workflow Name: ${trimString(waitingTask?.workflow_name) ?? 'Waiting workflow'}`,
    '',
  ];
  if (reuseGuidanceView.governanceBlockedReuse !== 'none') {
    bodyLines.push(`Governance note: ${reuseGuidanceView.governanceBlockedReuse}.`);
    bodyLines.push(`Governance re-enable guidance: ${reuseGuidanceView.governanceReenableGuidance}`);
    bodyLines.push('');
  }
  bodyLines.push('### Workflow Description');
  bodyLines.push('');
  bodyLines.push(
    `Describe the custom workflow that should execute task ${taskHeaderView.taskId} once the session starts.`,
  );
  bodyLines.push('');
  bodyLines.push('### Steps');
  bodyLines.push('');
  bodyLines.push(...workflowPreparationDefaultCreateStepLines());
  return {
    workflowAction,
    bodyLines,
  };
}

export function buildWorkflowPreparationTaskRenderView(waitingTask = {}) {
  const taskHeaderView = buildWorkflowPreparationTaskHeaderView(waitingTask);
  const reuseGuidanceView = buildWorkflowPreparationReuseGuidanceView(waitingTask);
  const actionView = buildWorkflowPreparationScaffoldActionView(waitingTask);
  const payloadLines = [
    `- ${taskHeaderView.taskLabel}`,
    `  task_type: ${taskHeaderView.taskType}`,
    `  milestone: ${taskHeaderView.milestoneId}`,
    `  task_document: ${taskHeaderView.taskDocumentPath}`,
    `  replanning_handoff: ${taskHeaderView.replanningHandoff}`,
    `  preferred_reuse: ${reuseGuidanceView.preferredReuse}`,
    `  governance_selection_context: ${reuseGuidanceView.governanceSelectionContext}`,
    `  reusable_candidates: ${reuseGuidanceView.reusableCandidatesWithNames}`,
    `  governance_blocked_reuse: ${reuseGuidanceView.governanceBlockedReuse}`,
    `  governance_reenable_guidance: ${reuseGuidanceView.governanceReenableGuidance}`,
  ];
  const scaffoldLines = [
    `## Task ${taskHeaderView.taskLabel}`,
    `Task Type: ${taskHeaderView.taskType}`,
    `Milestone: ${taskHeaderView.milestoneId}`,
    `Task Document: ${taskHeaderView.taskDocumentPath}`,
    `Workflow Action: ${actionView.workflowAction}`,
    ...(taskHeaderView.replanningHandoff !== 'none'
      ? [`Replanning handoff: ${taskHeaderView.replanningHandoff}`]
      : []),
    ...actionView.bodyLines,
  ];

  return {
    taskHeaderView,
    reuseGuidanceView,
    actionView,
    payloadLines,
    scaffoldLines,
  };
}

export function describeWorkflowPreparationPayloadWaitingTask(waitingTask = {}) {
  return buildWorkflowPreparationTaskRenderView(waitingTask).payloadLines.join('\n');
}

export function describeWorkflowPreparationScaffoldTask(waitingTask = {}) {
  return buildWorkflowPreparationTaskRenderView(waitingTask).scaffoldLines.join('\n');
}

export function buildWorkflowPreparationPayloadWaitingTaskListState(
  tasks = [],
  recommendationsByTaskId = new Map(),
) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const payloadWaitingTasks = taskList.map((task) =>
    buildWorkflowPreparationPayloadWaitingTask(
      task,
      recommendationsByTaskId instanceof Map
        ? recommendationsByTaskId.get(trimString(task?.id)) ?? null
        : null,
    )
  );

  return {
    payloadWaitingTasks,
    payloadTaskLines: payloadWaitingTasks.map((item) => describeWorkflowPreparationPayloadWaitingTask(item)),
    scaffoldTaskSections: payloadWaitingTasks.map((item) => describeWorkflowPreparationScaffoldTask(item)),
  };
}

function workflowPreparationEmptyPayloadTaskListText() {
  return '- no dispatchable tasks are waiting';
}

function workflowPreparationEmptyScaffoldTaskSectionsText() {
  return [
    '## Task pending: No tasks yet',
    'Workflow Action: create',
    'Workflow Name: Waiting workflow',
    '',
    '### Workflow Description',
    '',
    'Create tasks first, then replace this placeholder.',
    '',
    '### Steps',
    '',
    '- s1 | inspect | Review the waiting task set | inputs: task-document | outputs: scoped-plan',
  ].join('\n');
}

export function buildWorkflowPreparationPromptRenderView(
  requirement = {},
  workflowDocumentPath = null,
  taskDispatchDocumentPath = null,
) {
  const requirementId = trimString(requirement?.id) ?? 'pending';
  const requirementName = trimString(requirement?.data?.name) ?? 'Untitled requirement';
  const normalizedWorkflowDocumentPath = trimString(workflowDocumentPath)
    ?? 'docs/workflows/plans/pending.md';
  const normalizedTaskDispatchDocumentPath = trimString(taskDispatchDocumentPath)
    ?? 'docs/tasks/plans/pending.md';
  const assignmentGoalText =
    'Assign exactly one workflow to each waiting task. Reuse ranked templates when possible, otherwise define a custom workflow.';
  const packetTaskHeading = 'Task:';
  const packetWaitingTaskHeading = 'Tasks waiting for workflow assignment:';
  const outputContractHeading = 'Output contract:';
  const outputContractLines = [
    '- Use sections named "## Task <task-id>: <task-name>".',
    '- Add "Workflow Action: reuse" or "Workflow Action: create".',
    '- Reuse path: add "Workflow ID: <workflow-id>".',
    '- Create path: add "Workflow Name: <name>".',
    '- For created workflows add "### Workflow Description" with a short paragraph.',
    '- For created workflows add "### Steps" and bullet lines in the format:',
    '  - <step-id> | <step-name> | <description> | inputs: a, b | outputs: x, y',
  ];
  const rulesHeading = 'Rules:';
  const ruleLines = [
    '- One task maps to one workflow.',
    '- Prefer previous templates ranked for the task type.',
    '- If a reusable workflow is omitted as governance-blocked, do not silently reinstate it; follow governance_reenable_guidance instead.',
    '- Use the task document and ready prerequisites as the planning context.',
    '- When finished, report completion back to the orchestrator.',
  ];

  return {
    requirementId,
    requirementName,
    workflowDocumentPath: normalizedWorkflowDocumentPath,
    taskDispatchDocumentPath: normalizedTaskDispatchDocumentPath,
    packetSubject: `Assign reusable or custom workflows for requirement ${requirementId}`,
    packetRequirementLine: `Requirement ${requirementId}: ${requirementName}`,
    packetWorkflowPlanLine: `Target workflow plan: ${normalizedWorkflowDocumentPath}`,
    packetTaskHeading,
    packetWaitingTaskHeading,
    assignmentGoalText,
    outputContractHeading,
    outputContractLines,
    rulesHeading,
    ruleLines,
    scaffoldTitle: `${requirementName} Workflow Preparation`,
    scaffoldRequirementLine: `> Requirement ${requirementId}`,
    scaffoldTaskDispatchSourceLine:
      `> Task dispatch source: ${normalizedTaskDispatchDocumentPath}`,
    scaffoldGoalHeading: '## Goal',
  };
}

export function buildWorkflowPreparationWaitingTaskListRenderView(
  workflowPreparationPayloadWaitingTaskList = null,
) {
  const payloadWaitingTasks = Array.isArray(workflowPreparationPayloadWaitingTaskList?.payloadWaitingTasks)
    ? workflowPreparationPayloadWaitingTaskList.payloadWaitingTasks
    : [];
  const payloadTaskLines = Array.isArray(workflowPreparationPayloadWaitingTaskList?.payloadTaskLines)
    ? workflowPreparationPayloadWaitingTaskList.payloadTaskLines
    : [];
  const scaffoldTaskSections = Array.isArray(
    workflowPreparationPayloadWaitingTaskList?.scaffoldTaskSections,
  )
    ? workflowPreparationPayloadWaitingTaskList.scaffoldTaskSections
    : [];

  return {
    payloadWaitingTasks,
    payloadTaskLines,
    scaffoldTaskSections,
    payloadTaskListText: payloadTaskLines.length > 0
      ? payloadTaskLines.join('\n')
      : workflowPreparationEmptyPayloadTaskListText(),
    scaffoldTaskSectionsText: scaffoldTaskSections.length > 0
      ? scaffoldTaskSections.join('\n\n')
      : workflowPreparationEmptyScaffoldTaskSectionsText(),
  };
}

export function buildWorkflowPreparationPacketScaffoldState({
  requirement = {},
  workflowPreparationPayloadWaitingTaskList = null,
  workflowDocumentPath = null,
  taskDispatchDocumentPath = null,
} = {}) {
  const promptRenderView = buildWorkflowPreparationPromptRenderView(
    requirement,
    workflowDocumentPath,
    taskDispatchDocumentPath,
  );
  const waitingTaskListRenderView = buildWorkflowPreparationWaitingTaskListRenderView(
    workflowPreparationPayloadWaitingTaskList,
  );

  return {
    payloadWaitingTasks: waitingTaskListRenderView.payloadWaitingTasks,
    packetSubject: promptRenderView.packetSubject,
    packetBody: [
      promptRenderView.packetRequirementLine,
      promptRenderView.packetWorkflowPlanLine,
      '',
      promptRenderView.packetTaskHeading,
      promptRenderView.assignmentGoalText,
      '',
      promptRenderView.packetWaitingTaskHeading,
      waitingTaskListRenderView.payloadTaskListText,
      '',
      promptRenderView.outputContractHeading,
      ...promptRenderView.outputContractLines,
      '',
      promptRenderView.rulesHeading,
      ...promptRenderView.ruleLines,
    ].join('\n'),
    packetPayload: {
      requirement_id: promptRenderView.requirementId,
      requirement_name: promptRenderView.requirementName,
      description: requirement?.data?.description,
      acceptance_criteria: requirement?.data?.acceptance_criteria,
      document_path: promptRenderView.workflowDocumentPath,
      source_document_path: null,
      waiting_tasks: waitingTaskListRenderView.payloadWaitingTasks,
    },
    scaffoldText: `# ${promptRenderView.scaffoldTitle}\n\n${promptRenderView.scaffoldRequirementLine}\n${promptRenderView.scaffoldTaskDispatchSourceLine}\n\n${promptRenderView.scaffoldGoalHeading}\n\n${promptRenderView.assignmentGoalText}\n\n${waitingTaskListRenderView.scaffoldTaskSectionsText}\n`,
  };
}

export function buildWorkflowPreparationPacket({
  requirement = {},
  workflowPreparationPayloadWaitingTaskList = null,
  workflowDocumentPath = null,
  jobId = null,
  recipient = null,
  dispatchedAt = null,
} = {}) {
  const workflowPreparationRenderState = buildWorkflowPreparationPacketScaffoldState({
    requirement,
    workflowPreparationPayloadWaitingTaskList,
    workflowDocumentPath,
  });

  return {
    id: `pkt-${trimString(jobId) || 'unknown-job'}-workflow-plan`,
    recipient: trimString(recipient) || null,
    kind: 'tasks_to_workflows',
    subject: workflowPreparationRenderState.packetSubject,
    dispatched_at: trimString(dispatchedAt) || null,
    body: workflowPreparationRenderState.packetBody,
    payload: workflowPreparationRenderState.packetPayload,
  };
}

export function buildWorkflowPreparationArtifacts(job = null) {
  return [
    {
      kind: 'task_dispatch_plan',
      id: null,
      path: trimString(job?.post_milestone?.task_dispatch?.document?.path) || null,
      role: 'source',
    },
    {
      kind: 'workflow_plan',
      id: null,
      path: trimString(job?.workflow_preparation?.document?.path) || null,
      role: 'target',
    },
  ];
}

export function buildWorkflowPreparationMessageEnvelopeOptions({
  config = null,
  job = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  recipient = null,
} = {}) {
  const jobId = trimString(job?.id);
  return {
    protocolVersion: trimString(config?.message_protocol_version) || null,
    traceId: trimString(job?.trace?.trace_id) || null,
    senderId: trimString(senderId) || null,
    senderRole: trimString(senderRole) || null,
    recipientCard: recipientCard ?? null,
    callbackPath: jobId ? `/api/orchestrator/jobs/${jobId}/agent-report` : null,
    routing: job?.routing ?? null,
    recipient: trimString(recipient) || null,
  };
}

export function buildWorkflowPreparationMessageEnvelope({
  job = null,
  requirement = {},
  workflowPreparationPayloadWaitingTaskList = null,
  workflowDocumentPath = null,
  protocolVersion = null,
  traceId = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  callbackPath = null,
  routing = null,
  recipient = null,
  dispatchedAt = null,
} = {}) {
  const packet = buildWorkflowPreparationPacket({
    requirement,
    workflowPreparationPayloadWaitingTaskList,
    workflowDocumentPath,
    jobId: job?.id,
    recipient,
    dispatchedAt,
  });

  return {
    ...packet,
    protocol_version: trimString(protocolVersion) || null,
    trace_id: trimString(traceId) || null,
    sender: {
      id: trimString(senderId) || null,
      role: trimString(senderRole) || null,
    },
    recipient_card: recipientCard ?? null,
    callback: {
      kind: 'orchestrator_agent_report',
      method: 'POST',
      path: trimString(callbackPath) || null,
    },
    artifacts: buildWorkflowPreparationArtifacts(job),
    routing:
      typeof routing === 'object' && routing !== null
        ? structuredClone(routing)
        : routing ?? null,
  };
}

export function buildWorkflowPreparationMessageEnvelopeState({
  job = null,
  requirement = {},
  workflowPreparationPayloadWaitingTaskList = null,
  workflowDocumentPath = null,
  inspection = null,
  protocolVersion = null,
  traceId = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  callbackPath = null,
  routing = null,
  recipient = null,
  dispatchedAt = null,
} = {}) {
  const packet = buildWorkflowPreparationMessageEnvelope({
    job,
    requirement,
    workflowPreparationPayloadWaitingTaskList,
    workflowDocumentPath,
    protocolVersion,
    traceId,
    senderId,
    senderRole,
    recipientCard,
    callbackPath,
    routing,
    recipient,
    dispatchedAt,
  });
  const existingWorkflowPreparation =
    typeof job?.workflow_preparation === 'object' && job.workflow_preparation !== null
      ? structuredClone(job.workflow_preparation)
      : {};
  const existingDispatch =
    typeof existingWorkflowPreparation.dispatch === 'object'
      && existingWorkflowPreparation.dispatch !== null
      ? structuredClone(existingWorkflowPreparation.dispatch)
      : {};
  const existingDocument =
    typeof existingWorkflowPreparation.document === 'object'
      && existingWorkflowPreparation.document !== null
      ? structuredClone(existingWorkflowPreparation.document)
      : {};
  const signature = trimString(inspection?.signature);
  const modifiedAt = trimString(inspection?.modified_at);
  const normalizedDispatchedAt = trimString(dispatchedAt);

  return {
    packet,
    workflowPreparation: {
      ...existingWorkflowPreparation,
      status: 'planning',
      parse_error: null,
      completed_at: null,
      waiting_tasks: [],
      generated_workflow_ids: [],
      reused_workflow_ids: [],
      dispatch: {
        ...existingDispatch,
        packet,
        reports: [],
        last_dispatched_at: normalizedDispatchedAt,
      },
      document: {
        ...existingDocument,
        exists: Boolean(inspection?.exists),
        initial_signature: signature,
        current_signature: signature,
        last_modified_at: modifiedAt,
        last_activity_at: modifiedAt,
        has_observed_progress: false,
        completion_reason: null,
        completion_reported_at: null,
      },
    },
  };
}

function workflowPreparationPayloadWaitingTasksFromJob(job = null) {
  return Array.isArray(job?.workflow_preparation?.dispatch?.packet?.payload?.waiting_tasks)
    ? job.workflow_preparation.dispatch.packet.payload.waiting_tasks
    : [];
}

export async function buildWaitingTaskGovernanceViewState(
  waitingTasks = [],
  readArtifact = async () => null,
  fallbackWaitingTasks = [],
) {
  const waitingTasksForSessionContext = await hydrateWaitingTaskGovernanceLabels(
    waitingTasks,
    readArtifact,
    fallbackWaitingTasks,
  );

  return {
    waitingTasksForSessionContext,
    waitingTasksForDispatchPacket: canonicalizeWaitingTaskGovernanceLabels(
      waitingTasksForSessionContext,
      fallbackWaitingTasks,
    ),
  };
}

export async function buildSessionDispatchPacketWaitingTaskViews(
  job = null,
  waitingTasks = null,
  readArtifact = async () => null,
) {
  const payloadWaitingTasks = workflowPreparationPayloadWaitingTasksFromJob(job);
  const workflowPreparationPayloadWaitingTaskViews = await buildWaitingTaskGovernanceViewState(
    payloadWaitingTasks,
    readArtifact,
  );
  const waitingTaskViews = Array.isArray(waitingTasks)
    ? await buildWaitingTaskGovernanceViewState(
        waitingTasks,
        readArtifact,
        payloadWaitingTasks,
      )
    : {
        waitingTasksForSessionContext: [],
        waitingTasksForDispatchPacket: [],
      };

  return {
    workflowPreparationPayloadWaitingTasksForDispatchPacket:
      workflowPreparationPayloadWaitingTaskViews.waitingTasksForDispatchPacket,
    waitingTasksForSessionContext: waitingTaskViews.waitingTasksForSessionContext,
    waitingTasksForDispatchPacket: waitingTaskViews.waitingTasksForDispatchPacket,
  };
}

export function buildSessionDispatchPayloadWaitingTask(
  waitingTask = {},
  workflowPreparationPayloadTask = null,
) {
  const taskId = trimString(waitingTask?.task_id)
    || trimString(workflowPreparationPayloadTask?.task_id)
    || null;
  const taskDocumentPath = trimString(waitingTask?.task_document_path)
    || trimString(workflowPreparationPayloadTask?.task_document_path)
    || (taskId ? `docs/tasks/${taskId}/${taskId}.md` : null);
  const replanningHandoff = waitingTaskReplanningHandoff(waitingTask)
    || waitingTaskReplanningHandoff(workflowPreparationPayloadTask)
    || null;
  const currentGovernanceBlockedReuse = Array.isArray(waitingTask?.governance_blocked_reuse)
    ? waitingTask.governance_blocked_reuse
    : [];
  const currentReusableCandidates = Array.isArray(waitingTask?.reusable_candidates)
    ? waitingTask.reusable_candidates
    : [];
  const preferredReuse = trimString(waitingTask?.preferred_reuse)
    || trimString(workflowPreparationPayloadTask?.preferred_reuse)
    || null;
  const mergedWaitingTask = {
    ...workflowPreparationPayloadTask,
    ...waitingTask,
    task_id: taskId,
    task_name: trimString(waitingTask?.task_name)
      || trimString(workflowPreparationPayloadTask?.task_name)
      || null,
    task_type: trimString(waitingTask?.task_type)
      || trimString(workflowPreparationPayloadTask?.task_type)
      || null,
    milestone_id: trimString(waitingTask?.milestone_id)
      || trimString(workflowPreparationPayloadTask?.milestone_id)
      || null,
    task_document_path: taskDocumentPath,
    workflow_template_id: trimString(waitingTask?.workflow_template_id)
      || trimString(workflowPreparationPayloadTask?.workflow_template_id)
      || null,
    workflow_name: trimString(waitingTask?.workflow_name)
      || trimString(workflowPreparationPayloadTask?.workflow_name)
      || null,
    ...(preferredReuse ? { preferred_reuse: preferredReuse } : {}),
    reusable_candidates: currentReusableCandidates.length > 0
      ? currentReusableCandidates
      : Array.isArray(workflowPreparationPayloadTask?.reusable_candidates)
        ? workflowPreparationPayloadTask.reusable_candidates
        : [],
    governance_selection_context:
      waitingTask?.governance_selection_context
      ?? workflowPreparationPayloadTask?.governance_selection_context
      ?? null,
    governance_blocked_reuse: currentGovernanceBlockedReuse.length > 0
      ? currentGovernanceBlockedReuse
      : Array.isArray(workflowPreparationPayloadTask?.governance_blocked_reuse)
        ? workflowPreparationPayloadTask.governance_blocked_reuse
        : [],
    canonical_workflow_name_overrides: {
      ...(workflowPreparationPayloadTask?.canonical_workflow_name_overrides ?? {}),
      ...(waitingTask?.canonical_workflow_name_overrides ?? {}),
    },
    canonical_selection_context_workflow_names: {
      ...(workflowPreparationPayloadTask?.canonical_selection_context_workflow_names ?? {}),
      ...(waitingTask?.canonical_selection_context_workflow_names ?? {}),
    },
    canonical_governance_blocked_reuse_workflow_names: {
      ...(workflowPreparationPayloadTask?.canonical_governance_blocked_reuse_workflow_names ?? {}),
      ...(waitingTask?.canonical_governance_blocked_reuse_workflow_names ?? {}),
    },
    ...(replanningHandoff ? { replanning_handoff: replanningHandoff } : {}),
  };
  const waitingTaskRecord = buildWaitingTaskRecord(mergedWaitingTask);
  const selectedWorkflowTemplateId = waitingTaskRecord?.workflow_template_id
    || trimString(mergedWaitingTask.workflow_template_id)
    || null;
  const seenGovernanceBlockedReuse = new Set();
  const governanceBlockedReuse = (waitingTaskRecord?.governance_blocked_reuse ?? []).filter((candidate) => {
    if (!candidate?.id || !candidate?.name || !candidate?.reason || candidate.id === selectedWorkflowTemplateId) {
      return false;
    }
    const dedupeKey = [
      candidate.id,
      candidate.reason,
      candidate.checkpoint_id ?? '',
      candidate.adoption_status ?? '',
      candidate.branch_budget ?? '',
      candidate.workflow_tightness ?? '',
      candidate.oversight_strength ?? '',
    ].join('|');
    if (seenGovernanceBlockedReuse.has(dedupeKey)) {
      return false;
    }
    seenGovernanceBlockedReuse.add(dedupeKey);
    return true;
  });
  const governanceReenableGuidance = describeWorkflowReuseGovernanceReenableGuidanceList(
    governanceBlockedReuse,
  );

  return {
    task_id: waitingTaskRecord?.task_id || taskId,
    task_name: waitingTaskRecord?.task_name || trimString(mergedWaitingTask.task_name) || null,
    task_type: waitingTaskRecord?.task_type || trimString(mergedWaitingTask.task_type) || null,
    milestone_id: waitingTaskRecord?.milestone_id || trimString(mergedWaitingTask.milestone_id) || null,
    task_document_path: waitingTaskRecord?.task_document_path || taskDocumentPath,
    workflow_template_id:
      waitingTaskRecord?.workflow_template_id
      || trimString(mergedWaitingTask.workflow_template_id)
      || null,
    workflow_name:
      waitingTaskRecord?.workflow_name
      || trimString(mergedWaitingTask.workflow_name)
      || trimString(mergedWaitingTask.workflow_template_id)
      || null,
    replanning_handoff: waitingTaskRecord?.parent_task_id && waitingTaskRecord?.parent_decision_note
      ? {
          parent_task_id: waitingTaskRecord.parent_task_id,
          parent_decision_note: waitingTaskRecord.parent_decision_note,
        }
      : replanningHandoff,
    ...(waitingTaskRecord?.preferred_reuse || preferredReuse
      ? { preferred_reuse: waitingTaskRecord?.preferred_reuse ?? preferredReuse }
      : {}),
    ...(Array.isArray(waitingTaskRecord?.reusable_candidates) && waitingTaskRecord.reusable_candidates.length > 0
      ? { reusable_candidates: waitingTaskRecord.reusable_candidates }
      : {}),
    governance_selection_context: waitingTaskRecord?.governance_selection_context ?? null,
    governance_blocked_reuse: governanceBlockedReuse,
    governance_reenable_guidance: governanceReenableGuidance,
  };
}

export function buildSessionDispatchPacketWaitingArea(
  waitingTasks = [],
  workflowPreparationPayloadWaitingTasks = [],
  job = null,
) {
  const waitingTasksSource = Array.isArray(waitingTasks) ? waitingTasks : [];
  const workflowPreparationPayloadWaitingTaskById = waitingTaskLookup(
    Array.isArray(workflowPreparationPayloadWaitingTasks)
      ? workflowPreparationPayloadWaitingTasks
      : workflowPreparationPayloadWaitingTasksFromJob(job),
  );
  const payloadWaitingTasks = waitingTasksSource.map((item) =>
    buildSessionDispatchPayloadWaitingTask(
      item,
      workflowPreparationPayloadWaitingTaskById.get(trimString(item?.task_id)) ?? null,
    )
  );

  return {
    payloadWaitingTasks,
    taskLines: payloadWaitingTasks.length > 0
      ? payloadWaitingTasks.map((item) => describeSessionDispatchPayloadWaitingTask(item)).join('\n')
      : '- no waiting tasks',
  };
}

export function buildSessionDispatchPacket({
  job = null,
  requirement = null,
  waitingTasks = [],
  workflowPreparationPayloadWaitingTasks = null,
  recipient = null,
  dispatchedAt = null,
} = {}) {
  const { payloadWaitingTasks, taskLines } = buildSessionDispatchPacketWaitingArea(
    waitingTasks,
    workflowPreparationPayloadWaitingTasks,
    job,
  );
  const requirementId = trimString(requirement?.id) || null;
  const requirementName = trimString(requirement?.data?.name) || null;
  const readyTaskCount = Array.isArray(waitingTasks)
    ? waitingTasks.length
    : payloadWaitingTasks.length;

  return {
    id: `pkt-${trimString(job?.id) || 'unknown-job'}-session-batch`,
    recipient: trimString(recipient) || null,
    kind: 'batch_session_launch',
    subject: `Launch a batch session for ${readyTaskCount} ready tasks`,
    dispatched_at: trimString(dispatchedAt) || null,
    body: [
      `Requirement ${requirementId}: ${requirementName}`,
      '',
      'Waiting area:',
      taskLines,
      '',
      'Dispatcher launch rule:',
      '- Start every task that is currently in the waiting area.',
      '- One batch launch creates exactly one session.',
      '- Each launched task keeps exactly one workflow template.',
      '- Keep governance-sensitive fallback tasks in their own batch group instead of merging them into a normal healthy-reuse launch.',
    ].join('\n'),
    payload: {
      requirement_id: requirementId,
      requirement_name: requirementName,
      description: requirement?.data?.description,
      acceptance_criteria: requirement?.data?.acceptance_criteria,
      document_path: trimString(job?.workflow_preparation?.document?.path) || null,
      source_document_path: trimString(job?.post_milestone?.task_dispatch?.document?.path) || null,
      waiting_tasks: payloadWaitingTasks,
    },
  };
}

export function buildSessionDispatchArtifacts(job = null) {
  return [
    {
      kind: 'workflow_plan',
      id: null,
      path: trimString(job?.workflow_preparation?.document?.path) || null,
      role: 'source',
    },
    {
      kind: 'session_batch',
      id: null,
      path: null,
      role: 'target',
    },
  ];
}

export function buildSessionDispatchMessageEnvelopeOptions({
  config = null,
  job = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  recipient = null,
} = {}) {
  const jobId = trimString(job?.id);
  return {
    protocolVersion: trimString(config?.message_protocol_version) || null,
    traceId: trimString(job?.trace?.trace_id) || null,
    senderId: trimString(senderId) || null,
    senderRole: trimString(senderRole) || null,
    recipientCard: recipientCard ?? null,
    callbackPath: jobId ? `/api/orchestrator/jobs/${jobId}/agent-report` : null,
    routing: job?.routing ?? null,
    recipient: trimString(recipient) || null,
  };
}

export function buildSessionDispatchMessageEnvelope({
  job = null,
  requirement = null,
  waitingTasks = [],
  workflowPreparationPayloadWaitingTasks = null,
  protocolVersion = null,
  traceId = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  callbackPath = null,
  routing = null,
  recipient = null,
  dispatchedAt = null,
} = {}) {
  const packet = buildSessionDispatchPacket({
    job,
    requirement,
    waitingTasks,
    workflowPreparationPayloadWaitingTasks,
    recipient,
    dispatchedAt,
  });

  return {
    ...packet,
    protocol_version: trimString(protocolVersion) || null,
    trace_id: trimString(traceId) || null,
    sender: {
      id: trimString(senderId) || null,
      role: trimString(senderRole) || null,
    },
    recipient_card: recipientCard ?? null,
    callback: {
      kind: 'orchestrator_agent_report',
      method: 'POST',
      path: trimString(callbackPath) || null,
    },
    artifacts: buildSessionDispatchArtifacts(job),
    routing:
      typeof routing === 'object' && routing !== null
        ? structuredClone(routing)
        : routing ?? null,
  };
}

export function buildSessionDispatchMessageEnvelopeState({
  job = null,
  requirement = null,
  storedWaitingTasks = [],
  dispatchWaitingTasks = null,
  refreshedWaitingTasks = null,
  workflowPreparationPayloadWaitingTasks = null,
  protocolVersion = null,
  traceId = null,
  senderId = null,
  senderRole = null,
  recipientCard = null,
  callbackPath = null,
  routing = null,
  recipient = null,
  dispatchedAt = null,
  dispatchRecordedAt = null,
} = {}) {
  const waitingTasksForPacket = Array.isArray(dispatchWaitingTasks)
    ? dispatchWaitingTasks
    : Array.isArray(storedWaitingTasks)
    ? storedWaitingTasks
    : [];
  const waitingTasksForRefresh = Array.isArray(refreshedWaitingTasks)
    ? refreshedWaitingTasks
    : waitingTasksForPacket;
  const existingSessionDispatch =
    typeof job?.session_dispatch === 'object' && job.session_dispatch !== null
      ? structuredClone(job.session_dispatch)
      : {};
  const existingDispatch =
    typeof existingSessionDispatch.dispatch === 'object' && existingSessionDispatch.dispatch !== null
      ? structuredClone(existingSessionDispatch.dispatch)
      : {};
  const packet = buildSessionDispatchMessageEnvelope({
    job,
    requirement,
    waitingTasks: waitingTasksForPacket,
    workflowPreparationPayloadWaitingTasks,
    protocolVersion,
    traceId,
    senderId,
    senderRole,
    recipientCard,
    callbackPath,
    routing,
    recipient,
    dispatchedAt,
  });
  const normalizedDispatchRecordedAt = trimString(dispatchRecordedAt);

  return {
    packet,
    dispatch: {
      ...existingDispatch,
      packet,
      reports: [],
      last_dispatched_at: normalizedDispatchRecordedAt,
    },
    waitingTasks: refreshSessionDispatchWaitingTasks(storedWaitingTasks, packet, {
      refreshedWaitingTasks: waitingTasksForRefresh,
      dispatchedAt,
    }),
  };
}

export function mergeSessionDispatchPayloadWaitingTask(
  waitingTask = {},
  sessionDispatchPayloadTask = null,
) {
  if (!sessionDispatchPayloadTask) {
    return waitingTask;
  }

  const mergedPayloadWaitingTask = buildSessionDispatchPayloadWaitingTask(
    sessionDispatchPayloadTask,
    waitingTask,
  );

  return {
    ...waitingTask,
    task_name: mergedPayloadWaitingTask?.task_name ?? waitingTask?.task_name ?? null,
    task_type: mergedPayloadWaitingTask?.task_type ?? waitingTask?.task_type ?? null,
    milestone_id: mergedPayloadWaitingTask?.milestone_id ?? waitingTask?.milestone_id ?? null,
    task_document_path:
      mergedPayloadWaitingTask?.task_document_path
      ?? waitingTask?.task_document_path
      ?? null,
    workflow_template_id:
      mergedPayloadWaitingTask?.workflow_template_id
      ?? waitingTask?.workflow_template_id
      ?? null,
    workflow_name: mergedPayloadWaitingTask?.workflow_name ?? waitingTask?.workflow_name ?? null,
    replanning_handoff:
      mergedPayloadWaitingTask?.replanning_handoff
      ?? waitingTask?.replanning_handoff
      ?? null,
    governance_selection_context:
      mergedPayloadWaitingTask?.governance_selection_context
      ?? waitingTask?.governance_selection_context
      ?? null,
    governance_blocked_reuse:
      mergedPayloadWaitingTask?.governance_blocked_reuse
      ?? waitingTask?.governance_blocked_reuse
      ?? [],
    governance_reenable_guidance:
      mergedPayloadWaitingTask?.governance_reenable_guidance
      ?? waitingTask?.governance_reenable_guidance
      ?? 'none',
  };
}

export function refreshSessionDispatchWaitingTasks(
  waitingTasks = [],
  sessionDispatchPacket = null,
  {
    refreshedWaitingTasks = [],
    dispatchedAt = null,
  } = {},
) {
  if (!Array.isArray(waitingTasks)) {
    return [];
  }

  const payloadWaitingTaskById = waitingTaskLookup(
    Array.isArray(sessionDispatchPacket?.payload?.waiting_tasks)
      ? sessionDispatchPacket.payload.waiting_tasks
      : [],
  );
  const refreshedWaitingTaskById = waitingTaskLookup(refreshedWaitingTasks);
  const normalizedDispatchedAt = trimString(dispatchedAt);

  return waitingTasks.map((item) => {
    const taskId = trimString(item?.task_id);
    const refreshedWaitingTask = taskId ? refreshedWaitingTaskById.get(taskId) ?? null : null;
    const payloadWaitingTask = taskId ? payloadWaitingTaskById.get(taskId) ?? null : null;
    if (!refreshedWaitingTask && !payloadWaitingTask) {
      return item;
    }

    const mergedWaitingTask = mergeSessionDispatchPayloadWaitingTask(
      refreshedWaitingTask ? { ...item, ...refreshedWaitingTask } : item,
      payloadWaitingTask,
    );
    return normalizedDispatchedAt
      ? { ...mergedWaitingTask, dispatched_at: normalizedDispatchedAt }
      : mergedWaitingTask;
  });
}

export function describeSessionDispatchPayloadWaitingTask(waitingTask = {}) {
  const taskId = trimString(waitingTask?.task_id) ?? 'unknown-task';
  const taskName = trimString(waitingTask?.task_name) ?? 'Unnamed task';
  const workflowTemplateId = trimString(waitingTask?.workflow_template_id) ?? 'unknown-workflow';
  const governance = describeWaitingTaskGovernance(waitingTask);
  const reuseGuidanceView = buildWorkflowPreparationReuseGuidanceView(waitingTask);
  const governanceSelectionContext = describeGovernanceSelectionContext(
    waitingTask?.governance_selection_context ?? null,
  );
  const replanningHandoff = describeWaitingTaskReplanningHandoff(waitingTask);
  const parts = [`- ${taskId}: ${taskName} -> ${workflowTemplateId}`];

  if (governance !== 'none') {
    parts.push(`governance: ${governance}`);
  }
  if (trimString(waitingTask?.preferred_reuse)) {
    parts.push(`preferred_reuse: ${reuseGuidanceView.preferredReuse}`);
  }
  if (governanceSelectionContext !== 'none') {
    parts.push(`governance_selection_context: ${governanceSelectionContext}`);
  }
  if (reuseGuidanceView.reusableCandidatesWithNames !== 'none') {
    parts.push(`reusable_candidates: ${reuseGuidanceView.reusableCandidatesWithNames}`);
  }
  if (replanningHandoff !== 'none') {
    parts.push(`replanning_handoff: ${replanningHandoff}`);
  }

  return parts.join(' | ');
}

export function buildWaitingTaskRecord(waitingTask = {}) {
  const taskId = trimString(waitingTask?.task_id);
  const workflowTemplateId = trimString(waitingTask?.workflow_template_id);
  if (!taskId || !workflowTemplateId) {
    return null;
  }

  const canonicalTaskName = trimString(waitingTask?.canonical_task_name);
  const canonicalWorkflowName = trimString(waitingTask?.canonical_workflow_name);
  const canonicalSelectionContextWorkflowNames = normalizeCanonicalWorkflowNameMap(
    waitingTask?.canonical_selection_context_workflow_names,
  );
  const canonicalBlockedReuseWorkflowNames = normalizeCanonicalWorkflowNameMap(
    waitingTask?.canonical_governance_blocked_reuse_workflow_names,
  );
  const explicitWorkflowNameOverrides = normalizeCanonicalWorkflowNameMap(
    waitingTask?.canonical_workflow_name_overrides,
  );
  const labelCarrier = {
    ...waitingTask,
    task_id: taskId,
    workflow_template_id: workflowTemplateId,
    ...(canonicalTaskName ? { canonical_task_name: canonicalTaskName } : {}),
    ...(canonicalWorkflowName ? { canonical_workflow_name: canonicalWorkflowName } : {}),
    ...(Object.keys(canonicalSelectionContextWorkflowNames).length > 0
      ? { canonical_selection_context_workflow_names: canonicalSelectionContextWorkflowNames }
      : {}),
    ...(Object.keys(canonicalBlockedReuseWorkflowNames).length > 0
      ? { canonical_governance_blocked_reuse_workflow_names: canonicalBlockedReuseWorkflowNames }
      : {}),
    ...(Object.keys(explicitWorkflowNameOverrides).length > 0
      ? { canonical_workflow_name_overrides: explicitWorkflowNameOverrides }
      : {}),
  };
  const workflowNameOverrides = canonicalWorkflowNameOverrides(labelCarrier);
  const governanceSelectionContext = canonicalizeSelectionContextWorkflowLabels(
    normalizeGovernanceSelectionContext(waitingTask?.governance_selection_context),
    workflowNameOverrides,
  );
  const governanceBlockedReuse = canonicalizeWaitingTaskGovernanceBlockedReuse(labelCarrier);
  const reusableCandidates = canonicalizeWaitingTaskReusableCandidates(labelCarrier);
  const governanceReenableGuidance = describeWorkflowReuseGovernanceReenableGuidanceList(
    governanceBlockedReuse,
  );
  const replanningHandoff = waitingTaskReplanningHandoff(waitingTask);
  const preferredReuse = trimString(waitingTask?.preferred_reuse);
  const workflowName = selectionContextWorkflowDisplayName({
    workflow_template_id: workflowTemplateId,
    workflow_name: waitingTask?.workflow_name,
    canonical_workflow_name: canonicalWorkflowName,
    selection_context: governanceSelectionContext,
  }) || workflowTemplateId;

  return {
    task_id: taskId,
    task_name: canonicalTaskName || trimString(waitingTask?.task_name) || null,
    task_type: trimString(waitingTask?.task_type) || null,
    milestone_id: trimString(waitingTask?.milestone_id) || null,
    task_document_path: trimString(waitingTask?.task_document_path) || null,
    task_document_ready: waitingTask?.task_document_ready === true,
    prerequisites_ready: waitingTask?.prerequisites_ready === true,
    workflow_ready: waitingTask?.workflow_ready === true,
    workflow_template_id: workflowTemplateId,
    workflow_name: workflowName,
    workflow_source: trimString(waitingTask?.workflow_source) || null,
    registry_rank: Number.isInteger(waitingTask?.registry_rank) ? waitingTask.registry_rank : null,
    registry_mode: trimString(waitingTask?.registry_mode) || null,
    selection_note: trimString(waitingTask?.selection_note) || null,
    ...(preferredReuse ? { preferred_reuse: preferredReuse } : {}),
    ...(reusableCandidates.length > 0 ? { reusable_candidates: reusableCandidates } : {}),
    governance_selection_context: governanceSelectionContext
      ? structuredClone(governanceSelectionContext)
      : null,
    governance_blocked_reuse: governanceBlockedReuse,
    ...(governanceBlockedReuse.length > 0 || trimString(waitingTask?.governance_reenable_guidance)
      ? { governance_reenable_guidance: governanceReenableGuidance }
      : {}),
    ...(replanningHandoff ?? {}),
    ...(canonicalTaskName ? { canonical_task_name: canonicalTaskName } : {}),
    ...(canonicalWorkflowName ? { canonical_workflow_name: canonicalWorkflowName } : {}),
    ...(Object.keys(explicitWorkflowNameOverrides).length > 0
      ? { canonical_workflow_name_overrides: explicitWorkflowNameOverrides }
      : {}),
    ...(Object.keys(canonicalSelectionContextWorkflowNames).length > 0
      ? { canonical_selection_context_workflow_names: canonicalSelectionContextWorkflowNames }
      : {}),
    ...(Object.keys(canonicalBlockedReuseWorkflowNames).length > 0
      ? { canonical_governance_blocked_reuse_workflow_names: canonicalBlockedReuseWorkflowNames }
      : {}),
    ready_at: trimString(waitingTask?.ready_at) || null,
    dispatched_at: trimString(waitingTask?.dispatched_at) || null,
  };
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
    replanning_handoffs: sessionReplanningHandoffs(readyTasks),
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

function workflowAutomaticReusePolicy(automaticReusePolicyByTemplate, workflow) {
  const workflowId = trimString(workflow?.id);
  if (!workflowId) {
    return { constrained: false };
  }
  return automaticReusePolicyByTemplate.get(workflowId) ?? { constrained: false };
}

function workflowEffectiveForce(effectiveForceByTemplate, workflow) {
  const workflowId = trimString(workflow?.id);
  if (!workflowId) {
    return 0;
  }
  return effectiveForceByTemplate.get(workflowId) ?? 0;
}

function workflowRegistryRank(registryRanksByWorkflowId, workflow, fallback = null) {
  const workflowId = trimString(workflow?.id);
  if (!workflowId) {
    return fallback;
  }
  return registryRanksByWorkflowId.get(workflowId) ?? fallback;
}

function compareGovernedReusableCandidates(
  left,
  right,
  automaticReusePolicyByTemplate,
  effectiveForceByTemplate,
  registryRanksByWorkflowId,
) {
  const policyComparison = compareAutomaticReusePolicies(
    workflowAutomaticReusePolicy(automaticReusePolicyByTemplate, left),
    workflowAutomaticReusePolicy(automaticReusePolicyByTemplate, right),
  );
  if (policyComparison !== 0) {
    return policyComparison;
  }

  const leftEffectiveForce = workflowEffectiveForce(effectiveForceByTemplate, left);
  const rightEffectiveForce = workflowEffectiveForce(effectiveForceByTemplate, right);
  if (leftEffectiveForce !== rightEffectiveForce) {
    return rightEffectiveForce - leftEffectiveForce;
  }

  const leftRank = workflowRegistryRank(registryRanksByWorkflowId, left, Number.POSITIVE_INFINITY);
  const rightRank = workflowRegistryRank(registryRanksByWorkflowId, right, Number.POSITIVE_INFINITY);
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return trimString(left?.id).localeCompare(trimString(right?.id));
}

export function governedAutomaticReuseSelectionState({
  defaultWorkflow = null,
  defaultRank = null,
  reusableCandidates = [],
  automaticReusePolicyByTemplate = new Map(),
  effectiveForceByTemplate = new Map(),
  registryRanksByWorkflowId = new Map(),
} = {}) {
  if (!defaultWorkflow) {
    return {
      recommendedWorkflow: null,
      recommendedRank: null,
      recommendedMode: null,
      recommendedNote: null,
      recommendedSelectionContext: null,
    };
  }

  let recommendedWorkflow = defaultWorkflow;
  let recommendedRank = defaultRank ?? workflowRegistryRank(
    registryRanksByWorkflowId,
    defaultWorkflow,
    null,
  );
  let recommendedMode = null;
  let recommendedNote = null;
  let recommendedSelectionContext = null;

  const recommendedPolicy = workflowAutomaticReusePolicy(
    automaticReusePolicyByTemplate,
    defaultWorkflow,
  );
  const unconstrainedReusableCandidates = reusableCandidates
    .filter((workflow) => !workflowAutomaticReusePolicy(automaticReusePolicyByTemplate, workflow).constrained)
    .sort((left, right) => {
      const leftRank = workflowRegistryRank(registryRanksByWorkflowId, left, Number.POSITIVE_INFINITY);
      const rightRank = workflowRegistryRank(registryRanksByWorkflowId, right, Number.POSITIVE_INFINITY);
      return leftRank - rightRank;
    });
  const constrainedReusableCandidates = reusableCandidates
    .filter((workflow) => workflowAutomaticReusePolicy(automaticReusePolicyByTemplate, workflow).constrained)
    .sort((left, right) => compareGovernedReusableCandidates(
      left,
      right,
      automaticReusePolicyByTemplate,
      effectiveForceByTemplate,
      registryRanksByWorkflowId,
    ));

  if (recommendedPolicy.constrained && unconstrainedReusableCandidates.length > 0) {
    const preferredWorkflow = unconstrainedReusableCandidates[0];
    if (trimString(preferredWorkflow?.id) !== trimString(defaultWorkflow?.id)) {
      recommendedWorkflow = preferredWorkflow;
      recommendedRank = workflowRegistryRank(registryRanksByWorkflowId, preferredWorkflow, null);
      recommendedMode = 'governance_prefer_unconstrained';
      recommendedNote =
        `Automatic reuse preferred ${preferredWorkflow.id} before ${defaultWorkflow.id} `
        + `because ${defaultWorkflow.id} still carries ${describeAutomaticReusePolicy(recommendedPolicy)}.`;
    }

    return {
      recommendedWorkflow,
      recommendedRank,
      recommendedMode,
      recommendedNote,
      recommendedSelectionContext,
    };
  }

  if (recommendedPolicy.constrained && constrainedReusableCandidates.length > 0) {
    const preferredWorkflow = constrainedReusableCandidates[0];
    const preferredPolicy = workflowAutomaticReusePolicy(
      automaticReusePolicyByTemplate,
      preferredWorkflow,
    );
    const preferredEffectiveForce = workflowEffectiveForce(effectiveForceByTemplate, preferredWorkflow);
    const comparedWorkflow = trimString(preferredWorkflow?.id) === trimString(defaultWorkflow?.id)
      ? constrainedReusableCandidates.find((workflow) => trimString(workflow?.id) !== trimString(preferredWorkflow?.id)) ?? null
      : defaultWorkflow;

    if (comparedWorkflow) {
      const comparedPolicy = workflowAutomaticReusePolicy(
        automaticReusePolicyByTemplate,
        comparedWorkflow,
      );
      const comparedEffectiveForce = workflowEffectiveForce(effectiveForceByTemplate, comparedWorkflow);
      const policyComparison = compareAutomaticReusePolicies(preferredPolicy, comparedPolicy);
      const prefersLowerGovernanceCost = policyComparison < 0;
      const prefersEffectiveForce = policyComparison === 0
        && preferredEffectiveForce > comparedEffectiveForce;

      if (trimString(preferredWorkflow?.id) !== trimString(defaultWorkflow?.id)) {
        recommendedWorkflow = preferredWorkflow;
        recommendedRank = workflowRegistryRank(registryRanksByWorkflowId, preferredWorkflow, null);
      }

      if (prefersLowerGovernanceCost) {
        recommendedMode = 'governance_minimize_policy_carryover';
        recommendedSelectionContext = buildGovernanceSelectionContext(
          recommendedMode,
          preferredWorkflow,
          preferredPolicy,
          preferredEffectiveForce,
          comparedWorkflow,
          comparedPolicy,
          comparedEffectiveForce,
        );
        recommendedNote =
          `Automatic reuse preferred ${preferredWorkflow.id} before ${comparedWorkflow.id} because both reusable templates still carry inherited checkpoint policy, `
          + `and ${preferredWorkflow.id} has the lower governance cost (${describeAutomaticReusePolicy(preferredPolicy)}) compared with ${comparedWorkflow.id} (${describeAutomaticReusePolicy(comparedPolicy)}).`;
      } else if (prefersEffectiveForce) {
        recommendedMode = 'governance_prefer_effective_force';
        recommendedSelectionContext = buildGovernanceSelectionContext(
          recommendedMode,
          preferredWorkflow,
          preferredPolicy,
          preferredEffectiveForce,
          comparedWorkflow,
          comparedPolicy,
          comparedEffectiveForce,
        );
        recommendedNote =
          `Automatic reuse preferred ${preferredWorkflow.id} before ${comparedWorkflow.id} because both reusable templates carry equivalent inherited checkpoint policy, `
          + `and ${preferredWorkflow.id} retains stronger checkpoint effective force (${preferredEffectiveForce}) than ${comparedWorkflow.id} (${comparedEffectiveForce}).`;
      }
    }
  }

  return {
    recommendedWorkflow,
    recommendedRank,
    recommendedMode,
    recommendedNote,
    recommendedSelectionContext,
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
