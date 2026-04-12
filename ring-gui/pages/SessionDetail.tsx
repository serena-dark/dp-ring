import { useState } from "react";
import {
  distillations,
  evaluations,
  milestones,
  requirements,
  sessions,
  tasks,
  workflows,
  workflowRuns,
} from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { EvaluationCard } from "@ring-gui/components/EvaluationCard";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { TimelineLog } from "@ring-gui/components/TimelineLog";
import {
  formatDateTime,
  safeJson,
  titleize,
} from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";

export default function SessionDetail({ id }: { id: string }) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextJson, setContextJson] = useState<string | null>(null);

  const { notify } = useNotifications();

  const sessionState = useApi(() => sessions.read(id), [id]);
  const requirementsState = useApi(() => requirements.list(), []);
  const milestonesState = useApi(() => milestones.list(), []);
  const tasksState = useApi(() => tasks.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);
  const workflowRunsState = useApi(() => workflowRuns.list(), []);

  const session = sessionState.data;
  const evaluationId = session?.data.evaluation_id ?? null;
  const distillationId = session?.data.distillation_id ?? null;

  const evaluationState = useApi(
    () => evaluations.read(evaluationId!),
    [evaluationId],
    { enabled: Boolean(evaluationId) },
  );
  const distillationState = useApi(
    () => distillations.read(distillationId!),
    [distillationId],
    { enabled: Boolean(distillationId) },
  );

  const loading =
    sessionState.loading ||
    requirementsState.loading ||
    milestonesState.loading ||
    tasksState.loading ||
    workflowsState.loading ||
    workflowRunsState.loading ||
    evaluationState.loading ||
    distillationState.loading;
  const error =
    sessionState.error ??
    requirementsState.error ??
    milestonesState.error ??
    tasksState.error ??
    workflowsState.error ??
    workflowRunsState.error ??
    evaluationState.error ??
    distillationState.error;

  const requirement = (requirementsState.data ?? []).find(
    (item) => item.id === session?.data.requirement_id,
  );
  const milestoneIds = session?.data.milestone_ids?.length
    ? session.data.milestone_ids
    : session
      ? [session.data.milestone_id]
      : [];
  const linkedMilestones = (milestonesState.data ?? []).filter((item) =>
    milestoneIds.includes(item.id),
  );
  const linkedTasks = (tasksState.data ?? []).filter((item) =>
    session ? session.data.task_ids.includes(item.id) : false,
  );
  const linkedWorkflowRuns = (workflowRunsState.data ?? []).filter((item) =>
    session ? session.data.workflow_run_ids.includes(item.id) : false,
  );
  const workflowTemplate = (workflowsState.data ?? []).find(
    (item) =>
      item.id === session?.data.context_injected?.workflow_template,
  );

  const handleTransition = async (nextStatus: string) => {
    setPendingStatus(nextStatus);
    const result = await sessions.update(id, { status: nextStatus });
    setPendingStatus(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Session moved to ${titleize(nextStatus)}.`, "success");
    await sessionState.reload();
  };

  const loadContext = async () => {
    setContextLoading(true);
    setContextError(null);
    setContextJson(null);
    const result = await sessions.context(id);
    setContextLoading(false);

    if (!result.ok) {
      setContextError(result.error);
      notify(result.error, "error");
      return;
    }

    setContextJson(safeJson(result.data));
    notify("Fetched session context bundle.", "success");
  };

  return (
    <DataState
      loading={loading}
      error={error}
      empty={!session}
      emptyMessage={`Session ${id} was not found.`}
    >
      {session ? (
        <div className="page">
          <section className="page-hero">
            <div>
              <p className="eyebrow">Session</p>
              <h3>{session.id}</h3>
              <div className="badge-list">
                <StatusBadge value={session.status} />
              </div>
            </div>
            <StateActions
              type="session"
              status={session.status}
              pendingStatus={pendingStatus}
              onTransition={handleTransition}
            />
          </section>

          <section className="split-grid">
            <div className="page">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Overview</p>
                    <h3>Execution summary</h3>
                  </div>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Created</dt>
                    <dd>{formatDateTime(session.created_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(session.updated_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Requirement</dt>
                    <dd>
                      {requirement ? (
                        <AppLink
                          to={`/requirements/${requirement.id}`}
                          className="record-link"
                        >
                          {requirement.data.name}
                        </AppLink>
                      ) : (
                        session.data.requirement_id
                      )}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Milestones</dt>
                    <dd>
                      {linkedMilestones.length > 0
                        ? linkedMilestones.map((item) => item.data.name).join(", ")
                        : milestoneIds.join(", ")}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Tasks</dt>
                    <dd>{session.data.task_ids.length}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Workflow runs</dt>
                    <dd>{session.data.workflow_run_ids.length}</dd>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Timeline</p>
                    <h3>Execution log</h3>
                  </div>
                </div>
                <TimelineLog entries={session.data.execution_log} />
              </article>

              <EvaluationCard evaluation={evaluationState.data} />

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Distillation</p>
                    <h3>Knowledge extracted</h3>
                  </div>
                </div>
                {distillationState.data ? (
                  <div className="panel-grid">
                    {distillationState.data.data.artifacts.map((artifact, index) => (
                      <div key={`${artifact.kind}-${index}`} className="panel">
                        <div className="badge-list">
                          <StatusBadge value={artifact.kind} />
                          <StatusBadge
                            value={
                              artifact.confidence >= 0.8
                                ? "high"
                                : artifact.confidence >= 0.5
                                  ? "medium"
                                  : "low"
                            }
                            kind="priority"
                          />
                        </div>
                        <h3>{artifact.summary}</h3>
                        <p className="subtle">{artifact.context}</p>
                        <p>{artifact.applicable_when}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="subtle">
                    No distillation artifact is linked to this session.
                  </p>
                )}
              </article>
            </div>

            <aside className="page">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Context injected</p>
                    <h3>Selection inputs</h3>
                  </div>
                </div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Workflow template</dt>
                    <dd>
                      {workflowTemplate ? (
                        <AppLink
                          to={`/workflows/${workflowTemplate.id}`}
                          className="record-link"
                        >
                          {workflowTemplate.data.name}
                        </AppLink>
                      ) : (
                        session.data.context_injected?.workflow_template ?? "--"
                      )}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Distillations applied</dt>
                    <dd>
                      {session.data.context_injected?.distillations_applied
                        .length
                        ? session.data.context_injected?.distillations_applied.join(
                            ", ",
                          )
                        : "--"}
                    </dd>
                  </div>
                  <div className="detail-item">
                    <dt>Registry rank at selection</dt>
                    <dd>
                      {session.data.context_injected?.registry_rank_at_selection ??
                        "--"}
                    </dd>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Links</p>
                    <h3>Related records</h3>
                  </div>
                </div>
                <div className="panel-grid">
                  <div className="panel">
                    <p className="eyebrow">Tasks</p>
                    {linkedTasks.length > 0 ? (
                      <div className="inline-list">
                        {linkedTasks.map((task) => (
                          <AppLink
                            key={task.id}
                            to={`/tasks/${task.id}`}
                            className="record-link"
                          >
                            {task.data.name}
                          </AppLink>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-line">No linked tasks.</p>
                    )}
                  </div>

                  <div className="panel">
                    <p className="eyebrow">Workflow runs</p>
                    {linkedWorkflowRuns.length > 0 ? (
                      linkedWorkflowRuns.map((run) => (
                        <div key={run.id}>
                          <strong>{run.id}</strong>
                          <p className="subtle">
                            Step {run.data.current_step_index + 1} of{" "}
                            {run.data.steps.length}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="empty-line">No workflow runs attached.</p>
                    )}
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Agent startup</p>
                    <h3>Context bundle</h3>
                  </div>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={loadContext}
                    disabled={contextLoading}
                  >
                    {contextLoading ? "Loading..." : "Get Agent Context"}
                  </button>
                </div>
                {contextError ? (
                  <p className="subtle" style={{ color: "var(--danger)" }}>
                    {contextError}
                  </p>
                ) : null}
                {contextJson ? (
                  <pre className="code-block">{contextJson}</pre>
                ) : (
                  <p className="subtle">
                    Fetches the full startup bundle including tasks, workflow
                    templates, knowledge items, and blocking feedback.
                  </p>
                )}
              </article>

              {linkedWorkflowRuns.length > 0 ? (
                <article className="panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Workflow run detail</p>
                      <h3>Step progress</h3>
                    </div>
                  </div>
                  <div className="panel-grid">
                    {linkedWorkflowRuns.map((run) => (
                      <div key={run.id} className="panel">
                        <strong>{run.id}</strong>
                        <div className="divider" />
                        {run.data.steps.map((step) => (
                          <div key={step.step_id} className="detail-item">
                            <dt>{step.step_id}</dt>
                            <dd>
                              <StatusBadge value={step.status} />{" "}
                              {step.notes ?? ""}
                            </dd>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </aside>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
