function trimString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
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

export function workflowRunRequiresExplicitWorkflowReuse(workflowRun) {
  return workflowRun?.status === 'failed' && warmSemanticLineageState(workflowRun).hasWarmSemanticLineage;
}
