import { useState } from "react";
import {
  milestones,
  requirements,
  sessions,
  tasks,
  workflows,
  workflowRuns,
} from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatDateTime, titleize } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";

function parseLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TaskDetail({ id }: { id: string }) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [taskAction, setTaskAction] = useState<string | null>(null);
  const [commitSha, setCommitSha] = useState("");
  const [judgeAgentId, setJudgeAgentId] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [replannerAgentId, setReplannerAgentId] = useState("");
  const [replanNote, setReplanNote] = useState("");
  const [replanTaskName, setReplanTaskName] = useState("");
  const [replanTargetPath, setReplanTargetPath] = useState("");
  const [replanRepoRoot, setReplanRepoRoot] = useState("");
  const [replanFilePaths, setReplanFilePaths] = useState("");
  const { notify } = useNotifications();

  const taskState = useApi(() => tasks.read(id), [id]);
  const requirementsState = useApi(() => requirements.list(), []);
  const milestonesState = useApi(() => milestones.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);
  const workflowRunsState = useApi(() => workflowRuns.list(), []);
  const sessionsState = useApi(() => sessions.list(), []);

  const loading =
    taskState.loading ||
    requirementsState.loading ||
    milestonesState.loading ||
    workflowsState.loading ||
    workflowRunsState.loading ||
    sessionsState.loading;
  const error =
    taskState.error ??
    requirementsState.error ??
    milestonesState.error ??
    workflowsState.error ??
    workflowRunsState.error ??
    sessionsState.error;

  const task = taskState.data;
  const requirement = (requirementsState.data ?? []).find(
    (item) => item.id === task?.data.requirement_id,
  );
  const milestone = (milestonesState.data ?? []).find(
    (item) => item.id === task?.data.milestone_id,
  );
  const workflow = (workflowsState.data ?? []).find(
    (item) => item.id === task?.data.workflow_template_id,
  );
  const workflowRun = (workflowRunsState.data ?? []).find(
    (item) => item.id === task?.data.workflow_run_id,
  );
  const session = (sessionsState.data ?? []).find(
    (item) => item.id === task?.session_id,
  );
  const execution = task?.data.execution;
  const replanning = task?.data.replanning;
  const scope = task?.data.scope;
  const compatibleWorkflows = (workflowsState.data ?? []).filter((item) =>
    task ? item.data.applicable_to.includes(task.data.task_type) : false,
  );

  const handleTransition = async (nextStatus: string) => {
    setPendingStatus(nextStatus);
    const result = await tasks.update(id, { status: nextStatus });
    setPendingStatus(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Task moved to ${titleize(nextStatus)}.`, "success");
    await taskState.reload();
  };

  const finalizeTask = async () => {
    if (!commitSha.trim()) {
      notify("Commit SHA is required.", "error");
      return;
    }

    setTaskAction("finalize");
    const result = await tasks.finalize(id, {
      commit_sha: commitSha.trim(),
      judge_agent_id: judgeAgentId.trim() || undefined,
      note: taskNote.trim() || undefined,
    });
    setTaskAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify("Task verification pipeline executed.", "success");
    await taskState.reload();
  };

  const judgeTask = async (verdict: "approved" | "rejected") => {
    setTaskAction(verdict);
    const result = await tasks.judge(id, {
      verdict,
      judge_agent_id: judgeAgentId.trim() || undefined,
      note: taskNote.trim() || undefined,
    });
    setTaskAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(
      verdict === "approved" ? "Task approved for merge." : "Task rejected.",
      "success",
    );
    await taskState.reload();
  };

  const replanTask = async (verdict: "redispatch" | "terminal") => {
    setTaskAction(verdict);
    const result = await tasks.replan(id, {
      verdict,
      replanner_agent_id: replannerAgentId.trim() || undefined,
      note: replanNote.trim() || undefined,
      task:
        verdict === "redispatch"
          ? {
              name: replanTaskName.trim() || undefined,
              target_path: replanTargetPath.trim() || undefined,
              repo_root: replanRepoRoot.trim() || undefined,
              file_paths: parseLines(replanFilePaths),
            }
          : undefined,
    });
    setTaskAction(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(
      verdict === "redispatch"
        ? "Task replanned into a new successor task."
        : "Failed task marked as terminal.",
      "success",
    );
    await taskState.reload();
  };

  return (
    <DataState
      loading={loading}
      error={error}
      empty={!task}
      emptyMessage="Not found."
    >
      {task ? (
        <div className="page">
          <section className="page-hero">
            <div>
              <h3>{task.data.name}</h3>
              <div className="badge-list">
                <StatusBadge value={task.status} />
                <StatusBadge value={task.data.execution_mode ?? "--"} />
              </div>
            </div>
            <StateActions
              type="task"
              status={task.status}
              pendingStatus={pendingStatus}
              onTransition={handleTransition}
            />
          </section>

          <section className="split-grid">
            <div className="page">
              <article className="panel">
                <div className="panel-header">
                  <h3>Summary</h3>
                </div>
                <p>{task.data.description}</p>
                <div className="divider" />
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Created</dt>
                    <dd>{formatDateTime(task.created_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(task.updated_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Task type</dt>
                    <dd>{task.data.task_type}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Session</dt>
                    <dd>
                      {session ? (
                        <AppLink
                          to={`/sessions/${session.id}`}
                          className="record-link"
                        >
                          {session.id}
                        </AppLink>
                      ) : (
                        task.session_id ?? "--"
                      )}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Target</dt>
                    <dd>
                      {scope
                        ? `${titleize(scope.target_type)} · ${scope.target_path}`
                        : "--"}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Git repo</dt>
                    <dd>{scope?.repo_root ?? "--"}</dd>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Execution</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Review status</dt>
                    <dd>
                      <StatusBadge value={execution?.review_status ?? "--"} />
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Judge agent</dt>
                    <dd>{execution?.judge_agent_id ?? "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Commit</dt>
                    <dd>{execution?.completion_commit_sha ?? "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Scope match</dt>
                    <dd>
                      {execution?.scope_match == null
                        ? "--"
                        : execution.scope_match
                          ? "Exact match"
                          : "Mismatch"}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Build</dt>
                    <dd>
                      {execution
                        ? `${execution.build_required ? "Required" : "Skipped"} · ${titleize(execution.build_status)}`
                        : "--"}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Cleanup</dt>
                    <dd>{execution ? titleize(execution.cleanup_status) : "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Merge</dt>
                    <dd>{execution ? titleize(execution.merge_status) : "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Summary</dt>
                    <dd>{execution?.summary_path ?? "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Replanning</dt>
                    <dd>
                      <StatusBadge value={replanning?.status ?? "pending"} />
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Replanner</dt>
                    <dd>{replanning?.replanner_agent_id ?? "--"}</dd>
                  </div>
                </div>
                {scope ? (
                  <>
                    <div className="divider" />
                    <strong>Files</strong>
                    <div className="panel-grid">
                      {scope.file_paths.map((path) => (
                        <div key={path} className="panel">
                          <code>{path}</code>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="empty-line">No scope.</p>
                )}
                {execution?.changed_files?.length ? (
                  <>
                    <div className="divider" />
                    <strong>Changed files</strong>
                    <div className="panel-grid">
                      {execution.changed_files.map((path) => (
                        <div key={path} className="panel">
                          <code>{path}</code>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {execution?.last_error ? (
                  <>
                    <div className="divider" />
                    <p className="machine-history-note">{execution.last_error}</p>
                  </>
                ) : null}
                {replanning?.decision_note ? (
                  <>
                    <div className="divider" />
                    <p className="machine-history-note">{replanning.decision_note}</p>
                  </>
                ) : null}
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Acceptance</h3>
                </div>
                <div className="panel-grid">
                  {task.data.acceptance_criteria.map((criterion) => (
                    <div key={criterion.id} className="panel">
                      <div className="badge-list">
                        <StatusBadge
                          value={criterion.satisfied ? "completed" : "pending"}
                        />
                      </div>
                      <strong>{criterion.id}</strong>
                      <p>{criterion.description}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Workflow</h3>
                </div>
                {workflowRun ? (
                  <div className="panel-grid">
                    {workflowRun.data.steps.map((step) => (
                      <div key={step.step_id} className="panel">
                        <div className="badge-list">
                          <StatusBadge value={step.status} />
                        </div>
                        <strong>{step.step_id}</strong>
                        <p className="subtle">
                          {formatDateTime(step.started_at)} to{" "}
                          {formatDateTime(step.ended_at)}
                        </p>
                        <p>{step.notes ?? "No notes."}</p>
                      </div>
                    ))}
                  </div>
                ) : workflow ? (
                  <div className="panel-grid">
                    {workflow.data.steps.map((step) => (
                      <div key={step.id} className="panel">
                        <strong>{step.name}</strong>
                        <p className="subtle">{step.id}</p>
                        <p>{step.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-line">No workflow.</p>
                )}
              </article>
            </div>

            <aside className="page">
              <article className="panel">
                <div className="panel-header">
                  <h3>Finalize</h3>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="task-commit-sha">Commit SHA</label>
                    <input
                      id="task-commit-sha"
                      value={commitSha}
                      onChange={(event) => setCommitSha(event.target.value)}
                      placeholder="abc1234"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-judge-agent">Judge agent</label>
                    <input
                      id="task-judge-agent"
                      value={judgeAgentId}
                      onChange={(event) => setJudgeAgentId(event.target.value)}
                      placeholder={execution?.judge_agent_id ?? "task-judge"}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="task-note">Note</label>
                    <textarea
                      id="task-note"
                      value={taskNote}
                      onChange={(event) => setTaskNote(event.target.value)}
                      placeholder="Optional note for verification or judgement."
                    />
                  </div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button"
                    disabled={task.status !== "in_progress" || taskAction === "finalize"}
                    onClick={() => {
                      void finalizeTask();
                    }}
                  >
                    {taskAction === "finalize" ? "Verifying..." : "Finalize"}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={
                      execution?.review_status !== "awaiting_judgement" ||
                      taskAction === "approved"
                    }
                    onClick={() => {
                      void judgeTask("approved");
                    }}
                  >
                    {taskAction === "approved" ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={
                      execution?.review_status !== "awaiting_judgement" ||
                      taskAction === "rejected"
                    }
                    onClick={() => {
                      void judgeTask("rejected");
                    }}
                  >
                    {taskAction === "rejected" ? "Rejecting..." : "Reject"}
                  </button>
                </div>
                {execution?.review_packet ? (
                  <>
                    <div className="divider" />
                    <strong>Judge packet</strong>
                    <strong>{execution.review_packet.subject}</strong>
                    <p className="subtle">
                      Sent {formatDateTime(execution.review_packet.dispatched_at)} to{" "}
                      {execution.review_packet.agent_id}
                    </p>
                    <pre className="code-block">{execution.review_packet.body}</pre>
                  </>
                ) : null}
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Replan</h3>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Replanning status</dt>
                    <dd>
                      <StatusBadge value={replanning?.status ?? "pending"} />
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Failure source</dt>
                    <dd>{replanning?.source_failure ?? "--"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Parent task</dt>
                    <dd>
                      {replanning?.parent_task_id ? (
                        <AppLink
                          to={`/tasks/${replanning.parent_task_id}`}
                          className="record-link"
                        >
                          {replanning.parent_task_id}
                        </AppLink>
                      ) : (
                        "--"
                      )}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Successor task</dt>
                    <dd>
                      {replanning?.successor_task_id ? (
                        <AppLink
                          to={`/tasks/${replanning.successor_task_id}`}
                          className="record-link"
                        >
                          {replanning.successor_task_id}
                        </AppLink>
                      ) : (
                        "--"
                      )}
                    </dd>
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="task-replanner-agent">Replanner agent</label>
                    <input
                      id="task-replanner-agent"
                      value={replannerAgentId}
                      onChange={(event) => setReplannerAgentId(event.target.value)}
                      placeholder={replanning?.replanner_agent_id ?? "task-replanner"}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-replan-name">Successor task name</label>
                    <input
                      id="task-replan-name"
                      value={replanTaskName}
                      onChange={(event) => setReplanTaskName(event.target.value)}
                      placeholder={`${task.data.name} Retry`}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-replan-target-path">Retry target path</label>
                    <input
                      id="task-replan-target-path"
                      value={replanTargetPath}
                      onChange={(event) => setReplanTargetPath(event.target.value)}
                      placeholder={scope?.target_path ?? "src/example.ts"}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="task-replan-repo-root">Retry repo root</label>
                    <input
                      id="task-replan-repo-root"
                      value={replanRepoRoot}
                      onChange={(event) => setReplanRepoRoot(event.target.value)}
                      placeholder={scope?.repo_root ?? "."}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="task-replan-file-paths">Retry file list</label>
                    <textarea
                      id="task-replan-file-paths"
                      value={replanFilePaths}
                      onChange={(event) => setReplanFilePaths(event.target.value)}
                      placeholder={(scope?.file_paths ?? []).join("\n") || "src/example.ts"}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="task-replan-note">Decision note</label>
                    <textarea
                      id="task-replan-note"
                      value={replanNote}
                      onChange={(event) => setReplanNote(event.target.value)}
                      placeholder="Explain why this failed task should be redispatched or terminated."
                    />
                  </div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button"
                    disabled={
                      task.status !== "failed" ||
                      replanning?.status !== "awaiting_replan" ||
                      taskAction === "redispatch"
                    }
                    onClick={() => {
                      void replanTask("redispatch");
                    }}
                  >
                    {taskAction === "redispatch" ? "Redispatching..." : "Redispatch"}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    disabled={
                      task.status !== "failed" ||
                      replanning?.status !== "awaiting_replan" ||
                      taskAction === "terminal"
                    }
                    onClick={() => {
                      void replanTask("terminal");
                    }}
                  >
                    {taskAction === "terminal" ? "Marking..." : "Terminal"}
                  </button>
                </div>
                {replanning?.packet ? (
                  <>
                    <div className="divider" />
                    <strong>Replanner packet</strong>
                    <strong>{replanning.packet.subject}</strong>
                    <p className="subtle">
                      Sent {formatDateTime(replanning.packet.dispatched_at)} to{" "}
                      {replanning.packet.agent_id}
                    </p>
                    <pre className="code-block">{replanning.packet.body}</pre>
                  </>
                ) : null}
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Links</h3>
                </div>
                <div className="panel-grid">
                  <div className="panel">
                    <strong>Requirement</strong>
                    {requirement ? (
                      <AppLink
                        to={`/requirements/${requirement.id}`}
                        className="record-link"
                      >
                        {requirement.data.name}
                      </AppLink>
                    ) : (
                      <p className="empty-line">{task.data.requirement_id}</p>
                    )}
                  </div>
                  <div className="panel">
                    <strong>Milestone</strong>
                    <p>{milestone?.data.name ?? task.data.milestone_id}</p>
                    <p className="subtle">{milestone?.id ?? ""}</p>
                  </div>
                  <div className="panel">
                    <strong>Workflow template</strong>
                    {workflow ? (
                      <AppLink
                        to={`/workflows/${workflow.id}`}
                        className="record-link"
                      >
                        {workflow.data.name}
                      </AppLink>
                    ) : (
                      <p className="empty-line">None.</p>
                    )}
                  </div>
                  <div className="panel">
                    <strong>Failure feedback</strong>
                    <p>{execution?.failure_feedback_id ?? "--"}</p>
                    <p className="subtle">{execution?.failure_distillation_id ?? ""}</p>
                  </div>
                  <div className="panel">
                    <strong>Replanning chain</strong>
                    <p>{replanning?.parent_task_id ?? "--"}</p>
                    <p className="subtle">{replanning?.successor_task_id ?? ""}</p>
                  </div>
                  <div className="panel">
                    <strong>Success distillation</strong>
                    <p>{execution?.completion_distillation_id ?? "--"}</p>
                    <p className="subtle">{execution?.summary_path ?? ""}</p>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>Templates</h3>
                </div>
                {compatibleWorkflows.length > 0 ? (
                  <div className="panel-grid">
                    {compatibleWorkflows.map((item) => (
                      <div key={item.id} className="panel">
                        <AppLink to={`/workflows/${item.id}`} className="record-link">
                          {item.data.name}
                        </AppLink>
                        <p className="subtle">
                          Usage {item.data.quality_history?.usage_count ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-line">No templates.</p>
                )}
              </article>
            </aside>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
