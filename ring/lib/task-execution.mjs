import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { warmSemanticLineageState } from './governance-policy.mjs';

const execFileAsync = promisify(execFile);

const DEFAULT_EXECUTION_CONFIG = {
  task_judge_agent_id: 'task-judge',
  task_replanner_agent_id: 'task-replanner',
  task_summary_output_dir: 'docs/tasks/reviews',
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_EXECUTION_CONFIG,
    ...config,
  };
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizePath).filter(Boolean))].sort();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyExecution(task) {
  const cleanupPaths = task?.data?.execution?.cleanup_paths ?? [];
  const buildRequired = task?.data?.execution?.build_required ?? false;
  const buildCommand = task?.data?.execution?.build_command ?? null;
  return {
    judge_agent_id: null,
    review_status: 'pending',
    completion_commit_sha: null,
    changed_files: [],
    scope_match: null,
    build_required: buildRequired,
    build_command: buildCommand,
    build_status: buildRequired ? 'pending' : 'skipped',
    cleanup_paths: cleanupPaths,
    cleanup_status: cleanupPaths.length > 0 ? 'pending' : 'skipped',
    merge_status: 'blocked',
    summary_path: null,
    review_packet: null,
    failure_feedback_id: null,
    failure_distillation_id: null,
    completion_distillation_id: null,
    last_error: null,
    checked_at: null,
    reviewed_at: null,
    note: null,
  };
}

function taskExecution(task) {
  return {
    ...emptyExecution(task),
    ...(task.data.execution ?? {}),
  };
}

function emptyReplanning(task) {
  return {
    replanner_agent_id: null,
    status: 'pending',
    source_failure: null,
    packet: null,
    successor_task_id: null,
    parent_task_id: task?.data?.replanning?.parent_task_id ?? null,
    decision_note: null,
    reviewed_at: null,
  };
}

function taskReplanning(task) {
  return {
    ...emptyReplanning(task),
    ...(task.data.replanning ?? {}),
  };
}

function nonEmptyString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

async function semanticCheckpointGovernanceContext(ring, task, reasonCode) {
  const workflowRunId = nonEmptyString(task?.data?.workflow_run_id);
  if (reasonCode !== 'workflow_timeout' || !workflowRunId) {
    return {
      workflowRunId,
      checkpointCount: 0,
      replayStatus: 'idle',
      sawProgressReport: false,
      explicitWorkflowReuseRequired: false,
    };
  }

  const workflowRun = await ring.read('workflow-run', workflowRunId).catch(() => null);
  const governance = warmSemanticLineageState(workflowRun);

  return {
    workflowRunId,
    checkpointCount: governance.checkpointCount,
    replayStatus: governance.replayStatus,
    sawProgressReport: governance.sawProgressReport,
    explicitWorkflowReuseRequired: governance.hasWarmSemanticLineage,
  };
}

async function runGit(repoCwd, args) {
  const { stdout } = await execFileAsync('git', ['-C', repoCwd, ...args], {
    encoding: 'utf-8',
  });
  return stdout.trim();
}

async function runShell(command, cwd) {
  return execFileAsync('/bin/sh', ['-lc', command], {
    cwd,
    encoding: 'utf-8',
  });
}

function compareFileSets(expectedFiles, changedFiles) {
  const expected = uniqueSorted(expectedFiles);
  const changed = uniqueSorted(changedFiles);
  return {
    matches:
      expected.length === changed.length &&
      expected.every((value, index) => value === changed[index]),
    expected,
    changed,
  };
}

function buildReviewPacket(task, execution, summaryPath, config) {
  return {
    agent_id: execution.judge_agent_id ?? config.task_judge_agent_id,
    subject: `Judge task ${task.id} for completion`,
    body: [
      `Task ${task.id}: ${task.data.name}`,
      `Summary: ${summaryPath}`,
      `Commit: ${execution.completion_commit_sha ?? '--'}`,
      '',
      'Task success criteria:',
      '- Changed files exactly match the declared task file scope.',
      '- Required build has already passed when requested.',
      '- Temporary task cleanup has completed.',
      '- The output is good enough to merge.',
    ].join('\n'),
    dispatched_at: nowIso(),
  };
}

function buildReplanPacket(task, execution, replanning, config, governance = null) {
  const lineageGuidance = governance?.explicitWorkflowReuseRequired
    ? [
        '',
        `Governance note: workflow run ${governance.workflowRunId} already established semantic checkpoint lineage (${governance.checkpointCount} checkpoints, replay ${governance.replayStatus}), so any redispatch requires an explicit workflow reuse choice instead of silently inheriting the previous workflow template.`,
      ]
    : [];
  return {
    agent_id: replanning.replanner_agent_id ?? config.task_replanner_agent_id,
    subject: `Decide whether failed task ${task.id} should be redispatched`,
    body: [
      `Task ${task.id}: ${task.data.name}`,
      `Failure mode: ${replanning.source_failure ?? execution.review_status ?? '--'}`,
      `Summary: ${execution.summary_path ?? '--'}`,
      `Feedback: ${execution.failure_feedback_id ?? '--'}`,
      `Distillation: ${execution.failure_distillation_id ?? '--'}`,
      '',
      'Decision contract:',
      '- Choose "redispatch" if the failure can be converted into a new smallest executable task.',
      '- Choose "terminal" if the failure should stay as feedback only.',
      '- If redispatching, provide a revised task scope, exact file list, and optional workflow reuse choice.',
      ...lineageGuidance,
    ].join('\n'),
    dispatched_at: nowIso(),
  };
}

function buildTaskSummary(task, requirement, milestone, workflow, execution) {
  return `# ${task.data.name} Completion Summary

> Task: ${task.id}
> Requirement: ${requirement.id} ${requirement.data.name}
> Milestone: ${milestone.id} ${milestone.data.name}
> Workflow: ${workflow?.id ?? task.data.workflow_template_id ?? '--'}

## Scope Contract

- Target type: ${task.data.scope?.target_type ?? '--'}
- Target path: ${task.data.scope?.target_path ?? '--'}
- Git repo: ${task.data.scope?.repo_root ?? '--'}

### Declared files

${(task.data.scope?.file_paths ?? []).map((path) => `- ${path}`).join('\n') || '- none'}

## Commit Verification

- Commit SHA: ${execution.completion_commit_sha ?? '--'}
- Scope match: ${execution.scope_match ? 'yes' : 'no'}

### Observed changed files

${execution.changed_files.map((path) => `- ${path}`).join('\n') || '- none'}

## Build / Cleanup

- Build required: ${execution.build_required ? 'yes' : 'no'}
- Build command: ${execution.build_command ?? 'none'}
- Build status: ${execution.build_status}
- Cleanup paths: ${execution.cleanup_paths.length > 0 ? execution.cleanup_paths.join(', ') : 'none'}
- Cleanup status: ${execution.cleanup_status}

## Acceptance Criteria

${task.data.acceptance_criteria.map((item) => `- [${item.satisfied ? 'x' : ' '}] ${item.description}`).join('\n')}

## Ready To Merge

${execution.merge_status === 'ready' ? 'yes' : 'no'}

## Notes

${execution.note ?? 'No additional notes recorded.'}
`;
}

function buildFailureFeedbackDescription(task, reasonCode, detail) {
  if (reasonCode === 'scope_mismatch') {
    return `Task ${task.id} changed files outside its declared file scope. ${detail}`;
  }
  if (reasonCode === 'build_failed') {
    return `Task ${task.id} failed its required build step. ${detail}`;
  }
  if (reasonCode === 'cleanup_failed') {
    return `Task ${task.id} failed to clean task-local garbage artifacts. ${detail}`;
  }
  if (reasonCode === 'workflow_failed') {
    return `Task ${task.id} failed during workflow execution before completion verification. ${detail}`;
  }
  if (reasonCode === 'workflow_timeout') {
    return `Task ${task.id} stopped reporting progress and timed out during workflow execution. ${detail}`;
  }
  return `Task ${task.id} was rejected by the completion judge. ${detail}`;
}

function buildFailureDistillationArtifacts(task, reasonCode, detail) {
  return [
    {
      kind: 'anti-pattern',
      summary: `Task ${task.id} failed during ${reasonCode.replace(/_/g, ' ')}`,
      context: task.data.task_type,
      applicable_when: `Avoid repeating ${reasonCode} for scope ${task.data.scope?.target_path ?? task.id}. ${detail}`,
      confidence: 0.82,
      source_sessions: [task.session_id ?? task.id],
    },
  ];
}

function buildSuccessDistillationArtifacts(task, execution) {
  return [
    {
      kind: 'pattern',
      summary: `Task ${task.id} completed with a clean file-scope match`,
      context: task.data.task_type,
      applicable_when: `Use when work is isolated to ${task.data.scope?.target_type ?? 'task'} scope ${task.data.scope?.target_path ?? '--'} and the commit exactly matches the task file contract.`,
      confidence: 0.88,
      source_sessions: [task.session_id ?? task.id],
    },
    {
      kind: 'lesson',
      summary: `Task ${task.id} was ready to merge after build=${execution.build_status}`,
      context: task.data.task_type,
      applicable_when: `Apply when summarizing a successful task handoff for ${task.data.scope?.repo_root ?? '.'}.`,
      confidence: 0.7,
      source_sessions: [task.session_id ?? task.id],
    },
  ];
}

function buildRedispatchedTaskMarkdown(taskId, sourceTask, payload, taskName) {
  return `# ${taskName}

> Redispatched from failed task ${sourceTask.id}
> Original target: ${sourceTask.data.scope?.target_path ?? '--'}

## Why this exists

${payload.note ?? 'This task was created by the task replanner after a failed execution loop.'}

## Revised Scope

- Target type: ${payload.target_type}
- Target path: ${payload.target_path}
- Git repo: ${payload.repo_root}

## File Contract

${payload.file_paths.map((path) => `- ${path}`).join('\n')}

## Build / Cleanup

- Build command: ${payload.build_command ?? 'none'}
- Cleanup paths: ${payload.cleanup_paths.length > 0 ? payload.cleanup_paths.join(', ') : 'none'}

## Acceptance Criteria

${payload.acceptance_criteria.map((item) => `- ${item.description}`).join('\n')}
`;
}

export function createTaskExecution(repoRoot, ring, getConfig) {
  async function readTask(taskId) {
    return ring.read('task', taskId);
  }

  async function writeTask(task, patch, nextStatus) {
    const mergedExecution = {
      ...taskExecution(task),
      ...(patch.data?.execution ?? {}),
    };
    const mergedReplanning = {
      ...taskReplanning(task),
      ...(patch.data?.replanning ?? {}),
    };
    const nextData = {
      ...task.data,
      ...(patch.data ?? {}),
      execution: mergedExecution,
      replanning: mergedReplanning,
    };
    const nextPatch = {
      ...patch,
      data: nextData,
    };
    if (nextStatus) {
      nextPatch.status = nextStatus;
    }
    const result = await ring.update('task', task.id, nextPatch);
    if (!result.ok) {
      throw new Error(`Task update failed for ${task.id}: ${JSON.stringify(result.errors)}`);
    }
    return result.artifact;
  }

  async function createFailureArtifacts(task, reasonCode, detail) {
    const feedbackId = await ring.newId('feedback', {
      name: `${task.data.name} ${reasonCode}`,
    });
    const distillationId = await ring.newId('distillation', {
      name: `${task.data.name} ${reasonCode}`,
    });

    const feedbackResult = await ring.create('feedback', {
      id: feedbackId,
      status: 'open',
      created_by: 'task-verifier',
      data: {
        source_session_id: task.session_id ?? task.id,
        severity: reasonCode === 'scope_mismatch' ? 'critical' : 'major',
        category: 'process_issue',
        target: {
          type: 'task',
          id: task.id,
          field: 'data.execution',
        },
        description: buildFailureFeedbackDescription(task, reasonCode, detail),
        proposed_action: 'Route the task output back through distillation and dispatch another clean execution loop.',
        resolution_session_id: null,
      },
    });
    if (!feedbackResult.ok) {
      throw new Error(`Feedback creation failed: ${JSON.stringify(feedbackResult.errors)}`);
    }

    const distillationResult = await ring.create('distillation', {
      id: distillationId,
      status: 'published',
      created_by: 'task-verifier',
      session_id: task.session_id ?? task.id,
      data: {
        source_session_id: task.session_id ?? task.id,
        artifacts: buildFailureDistillationArtifacts(task, reasonCode, detail),
      },
    });
    if (!distillationResult.ok) {
      throw new Error(`Distillation creation failed: ${JSON.stringify(distillationResult.errors)}`);
    }

    return {
      feedback_id: feedbackId,
      distillation_id: distillationId,
    };
  }

  async function createSuccessDistillation(task, execution) {
    const distillationId = await ring.newId('distillation', {
      name: `${task.data.name} completion`,
    });
    const distillationResult = await ring.create('distillation', {
      id: distillationId,
      status: 'published',
      created_by: execution.judge_agent_id ?? 'task-judge',
      session_id: task.session_id ?? task.id,
      data: {
        source_session_id: task.session_id ?? task.id,
        artifacts: buildSuccessDistillationArtifacts(task, execution),
      },
    });
    if (!distillationResult.ok) {
      throw new Error(`Distillation creation failed: ${JSON.stringify(distillationResult.errors)}`);
    }
    return distillationId;
  }

  async function markTaskFailedAndQueueReplan(task, execution, reasonCode, detail, config) {
    const failureArtifacts = await createFailureArtifacts(task, reasonCode, detail);
    const replanning = {
      ...taskReplanning(task),
      replanner_agent_id: config.task_replanner_agent_id,
      status: 'awaiting_replan',
      source_failure: reasonCode,
      successor_task_id: null,
      decision_note: null,
      reviewed_at: null,
    };
    execution.failure_feedback_id = failureArtifacts.feedback_id;
    execution.failure_distillation_id = failureArtifacts.distillation_id;
    execution.last_error = detail;
    const governance = await semanticCheckpointGovernanceContext(ring, task, reasonCode);
    replanning.packet = buildReplanPacket(
      task,
      execution,
      replanning,
      config,
      governance,
    );

    const nextTask = await writeTask(
      task,
      {
        data: {
          execution,
          replanning,
        },
      },
      'failed',
    );
    return nextTask;
  }

  async function finalize(taskId, payload = {}) {
    const config = normalizeConfig(await getConfig());
    const task = await readTask(taskId);
    if (task.status !== 'in_progress') {
      throw new Error(`Task ${taskId} must be in_progress before finalization.`);
    }
    if (!task.data.scope?.file_paths?.length) {
      throw new Error(`Task ${taskId} does not declare a file scope.`);
    }
    if (!payload.commit_sha?.trim()) {
      throw new Error('commit_sha is required.');
    }

    let execution = {
      ...taskExecution(task),
      judge_agent_id: payload.judge_agent_id?.trim() || config.task_judge_agent_id,
      review_status: 'verifying_scope',
      completion_commit_sha: payload.commit_sha.trim(),
      changed_files: [],
      scope_match: null,
      merge_status: 'blocked',
      review_packet: null,
      last_error: null,
      checked_at: nowIso(),
      note: payload.note ?? null,
    };

    const repoCwd = resolve(repoRoot, task.data.scope.repo_root ?? '.');
    const changedFilesRaw = await runGit(repoCwd, [
      'show',
      '--pretty=format:',
      '--name-only',
      execution.completion_commit_sha,
    ]);
    const changedFiles = uniqueSorted(
      changedFilesRaw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
    execution.changed_files = changedFiles;

    const scopeComparison = compareFileSets(task.data.scope.file_paths, changedFiles);
    execution.scope_match = scopeComparison.matches;

    if (!scopeComparison.matches) {
      const detail = `Expected ${scopeComparison.expected.join(', ') || 'nothing'}, observed ${scopeComparison.changed.join(', ') || 'nothing'}.`;
      execution.review_status = 'scope_failed';
      return markTaskFailedAndQueueReplan(task, execution, 'scope_mismatch', detail, config);
    }

    if (execution.build_required && execution.build_command) {
      try {
        await runShell(execution.build_command, repoCwd);
        execution.build_status = 'passed';
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        execution.review_status = 'build_failed';
        execution.build_status = 'failed';
        return markTaskFailedAndQueueReplan(task, execution, 'build_failed', detail, config);
      }
    } else {
      execution.build_status = 'skipped';
    }

    if (execution.cleanup_paths.length > 0) {
      try {
        for (const cleanupPath of execution.cleanup_paths) {
          await rm(resolve(repoRoot, cleanupPath), { recursive: true, force: true });
        }
        execution.cleanup_status = 'completed';
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        execution.review_status = 'cleanup_failed';
        execution.cleanup_status = 'failed';
        return markTaskFailedAndQueueReplan(task, execution, 'cleanup_failed', detail, config);
      }
    } else {
      execution.cleanup_status = 'skipped';
    }

    const requirement = await ring.read('requirement', task.data.requirement_id);
    const milestone = await ring.read('milestone', task.data.milestone_id);
    const workflow = task.data.workflow_template_id
      ? await ring.read('workflow', task.data.workflow_template_id)
      : null;

    const summaryAbsolutePath = join(repoRoot, config.task_summary_output_dir, `${task.id}.md`);
    await mkdir(dirname(summaryAbsolutePath), { recursive: true });
    execution.summary_path = relative(repoRoot, summaryAbsolutePath);
    execution.review_status = 'awaiting_judgement';
    execution.review_packet = buildReviewPacket(task, execution, execution.summary_path, config);
    await writeFile(
      summaryAbsolutePath,
      buildTaskSummary(
        {
          ...task,
          data: {
            ...task.data,
            execution,
          },
        },
        requirement,
        milestone,
        workflow,
        execution,
      ),
      'utf-8',
    );

    return writeTask(task, {
      data: {
        execution,
      },
    });
  }

  async function fail(taskId, payload = {}) {
    const config = normalizeConfig(await getConfig());
    const task = await readTask(taskId);
    if (task.status !== 'in_progress') {
      throw new Error(`Task ${taskId} must be in_progress before failure handoff.`);
    }

    const reasonCode = String(payload.reason_code ?? 'workflow_failed').trim();
    if (!['workflow_failed', 'workflow_timeout'].includes(reasonCode)) {
      throw new Error('reason_code must be "workflow_failed" or "workflow_timeout".');
    }

    const execution = {
      ...taskExecution(task),
      judge_agent_id: payload.judge_agent_id?.trim() || config.task_judge_agent_id,
      review_status: reasonCode === 'workflow_timeout' ? 'workflow_timeout' : 'workflow_failed',
      merge_status: 'blocked',
      checked_at: nowIso(),
      last_error: payload.note?.trim() || `Task ${taskId} failed during workflow execution.`,
      note: payload.note?.trim() || null,
    };

    return markTaskFailedAndQueueReplan(
      task,
      execution,
      reasonCode,
      execution.last_error,
      config,
    );
  }

  async function judge(taskId, payload = {}) {
    const config = normalizeConfig(await getConfig());
    const task = await readTask(taskId);
    const execution = taskExecution(task);
    if (task.status !== 'in_progress' || execution.review_status !== 'awaiting_judgement') {
      throw new Error(`Task ${taskId} is not waiting for judgement.`);
    }
    if (!['approved', 'rejected'].includes(payload.verdict)) {
      throw new Error('verdict must be "approved" or "rejected".');
    }

    execution.judge_agent_id = payload.judge_agent_id?.trim() || execution.judge_agent_id;
    execution.reviewed_at = nowIso();
    execution.note = payload.note ?? execution.note ?? null;

    if (payload.verdict === 'approved') {
      execution.review_status = 'approved';
      execution.merge_status = 'ready';
      execution.last_error = null;
      const distillationId = await createSuccessDistillation(task, execution);
      execution.completion_distillation_id = distillationId;
      const acceptanceCriteria = clone(task.data.acceptance_criteria).map((item) => ({
        ...item,
        satisfied: true,
      }));
      return writeTask(task, {
        data: {
          acceptance_criteria: acceptanceCriteria,
          execution,
        },
      }, 'completed');
    }

    const detail = payload.note?.trim() || 'Task judge rejected the task output.';
    execution.review_status = 'rejected';
    execution.merge_status = 'blocked';
    return markTaskFailedAndQueueReplan(task, execution, 'review_rejected', detail, config);
  }

  async function replan(taskId, payload = {}) {
    const config = normalizeConfig(await getConfig());
    const task = await readTask(taskId);
    const replanning = taskReplanning(task);
    if (task.status !== 'failed' || replanning.status !== 'awaiting_replan') {
      throw new Error(`Task ${taskId} is not waiting for replanning.`);
    }
    if (!['redispatch', 'terminal'].includes(payload.verdict)) {
      throw new Error('verdict must be "redispatch" or "terminal".');
    }
    const governance = await semanticCheckpointGovernanceContext(ring, task, replanning.source_failure);
    const decisionNote = payload.note?.trim() || null;
    if (!decisionNote) {
      if (payload.verdict === 'terminal') {
        throw new Error('Terminal replanning decisions require a non-empty note.');
      }
      throw new Error('Redispatch replanning decisions require a non-empty note.');
    }

    const nextReplanning = {
      ...replanning,
      replanner_agent_id: payload.replanner_agent_id?.trim() || config.task_replanner_agent_id,
      decision_note: decisionNote,
      reviewed_at: nowIso(),
      packet: replanning.packet,
    };

    if (payload.verdict === 'terminal') {
      nextReplanning.status = 'terminal';
      return writeTask(task, {
        data: {
          replanning: nextReplanning,
        },
      });
    }

    const revision = payload.task ?? {};
    const taskName =
      revision.name?.trim() ||
      `${task.data.name} Retry`;
    const description =
      revision.description?.trim() ||
      `${task.data.description}\n\nReplanned after failure: ${replanning.source_failure ?? 'unknown failure'}.`;
    const targetType = revision.target_type ?? task.data.scope?.target_type ?? 'file';
    const targetPath = revision.target_path?.trim() || task.data.scope?.target_path;
    const taskRepoRoot = revision.repo_root?.trim() || task.data.scope?.repo_root || '.';
    const filePaths = uniqueSorted(
      revision.file_paths?.length ? revision.file_paths : task.data.scope?.file_paths ?? [],
    );
    if (!targetPath || filePaths.length === 0) {
      throw new Error('Redispatched tasks need a target_path and exact file_paths.');
    }

    const buildCommand =
      revision.build_command === undefined
        ? task.data.execution?.build_command ?? null
        : revision.build_command?.trim() || null;
    const cleanupPaths = uniqueSorted(
      revision.cleanup_paths?.length
        ? revision.cleanup_paths
        : task.data.execution?.cleanup_paths ?? [],
    );
    const workflowTemplateId =
      revision.workflow_template_id === undefined
        ? governance.explicitWorkflowReuseRequired
          ? null
          : task.data.workflow_template_id ?? null
        : revision.workflow_template_id;
    const executionMode =
      revision.execution_mode ?? task.data.execution_mode ?? null;
    const acceptanceCriteria =
      revision.acceptance_criteria?.length
        ? revision.acceptance_criteria.map((item, index) => ({
            id: item.id ?? `ac${index + 1}`,
            description: item.description,
            satisfied: false,
          }))
        : clone(task.data.acceptance_criteria).map((item) => ({
            ...item,
            satisfied: false,
          }));

    const successorTaskId = await ring.newId('task', { name: taskName });
    const createResult = await ring.create('task', {
      id: successorTaskId,
      status: workflowTemplateId ? 'ready' : 'pending',
      created_by: nextReplanning.replanner_agent_id,
      session_id: null,
      data: {
        name: taskName,
        description,
        task_type: task.data.task_type,
        requirement_id: task.data.requirement_id,
        milestone_id: task.data.milestone_id,
        workflow_template_id: workflowTemplateId,
        workflow_run_id: null,
        execution_mode: executionMode,
        scope: {
            target_type: targetType,
            target_path: targetPath,
            repo_root: taskRepoRoot,
            file_paths: filePaths,
          },
        execution: {
          ...emptyExecution({
            data: {
              execution: {
                build_required: buildCommand != null,
                build_command: buildCommand,
                cleanup_paths: cleanupPaths,
              },
            },
          }),
          build_required: buildCommand != null,
          build_command: buildCommand,
          build_status: buildCommand != null ? 'pending' : 'skipped',
          cleanup_paths: cleanupPaths,
          cleanup_status: cleanupPaths.length > 0 ? 'pending' : 'skipped',
        },
        replanning: {
          ...emptyReplanning(),
          parent_task_id: task.id,
          status: 'pending',
        },
        acceptance_criteria: acceptanceCriteria,
      },
    });
    if (!createResult.ok) {
      throw new Error(`Failed to create redispatched task: ${JSON.stringify(createResult.errors)}`);
    }

    const taskDir = join(repoRoot, 'docs', 'tasks', successorTaskId);
    await mkdir(join(taskDir, 'references'), { recursive: true });
    await writeFile(
      join(taskDir, `${successorTaskId}.md`),
      buildRedispatchedTaskMarkdown(successorTaskId, task, {
        target_type: targetType,
        target_path: targetPath,
        repo_root: taskRepoRoot,
        file_paths: filePaths,
        build_command: buildCommand,
        cleanup_paths: cleanupPaths,
        acceptance_criteria: acceptanceCriteria,
        note: nextReplanning.decision_note,
      }, taskName),
      'utf-8',
    );

    nextReplanning.status = 'redispatched';
    nextReplanning.successor_task_id = successorTaskId;
    return writeTask(task, {
      data: {
        replanning: nextReplanning,
      },
    });
  }

  return {
    fail,
    finalize,
    judge,
    replan,
  };
}
