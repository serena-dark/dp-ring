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
import { ArtifactCard } from "@ring-gui/components/ArtifactCard";
import { DataState } from "@ring-gui/components/DataState";
import { DetailGrid } from "@ring-gui/components/DetailGrid";
import { EvaluationCard } from "@ring-gui/components/EvaluationCard";
import { PageSection } from "@ring-gui/components/PageSection";
import { PageHero } from "@ring-gui/components/PageHero";
import { PanelSection } from "@ring-gui/components/PanelSection";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { TimelineLog } from "@ring-gui/components/TimelineLog";
import {
  safeJson,
  titleize,
} from "@ring-gui/lib/format";
import { formatDateTime } from "@ring-gui/lib/format";
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

  const milestoneNames = linkedMilestones.map((item) => item.data.name);

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
      emptyMessage="Not found."
    >
      {session ? (
        <div className="page">
          <PageSection id="summary" label="Session summary">
            <PageHero
              title={session.id}
              badges={[<StatusBadge key="status" value={session.status} />]}
              actions={
                <StateActions
                  type="session"
                  status={session.status}
                  pendingStatus={pendingStatus}
                  onTransition={handleTransition}
                />
              }
            />
          </PageSection>

          <section className="split-grid">
            <PageSection id="execution" label="Session execution" className="page">
              <PanelSection title="Summary">
                <DetailGrid
                  items={[
                    {
                      key: "created",
                      label: "Created",
                      value: formatDateTime(session.created_at),
                    },
                    {
                      key: "updated",
                      label: "Updated",
                      value: formatDateTime(session.updated_at),
                    },
                    {
                      key: "requirement",
                      label: "Requirement",
                      value: requirement ? (
                        <AppLink
                          to={`/requirements/${requirement.id}`}
                          className="record-link"
                        >
                          {requirement.data.name}
                        </AppLink>
                      ) : (
                        session.data.requirement_id
                      ),
                    },
                    {
                      key: "milestones",
                      label: "Milestones",
                      value:
                        milestoneNames.length > 0
                          ? milestoneNames.join(", ")
                          : milestoneIds.join(", "),
                    },
                    {
                      key: "tasks",
                      label: "Tasks",
                      value: session.data.task_ids.length,
                    },
                    {
                      key: "workflow-runs",
                      label: "Workflow runs",
                      value: session.data.workflow_run_ids.length,
                    },
                  ]}
                />
              </PanelSection>

              <PanelSection title="Timeline">
                <TimelineLog entries={session.data.execution_log} />
              </PanelSection>

              <EvaluationCard evaluation={evaluationState.data} />

              <PanelSection title="Distillation">
                {distillationState.data ? (
                  <div className="panel-grid">
                    {distillationState.data.data.artifacts.map((artifact, index) => (
                      <ArtifactCard
                        key={`${artifact.kind}-${index}`}
                        kind={artifact.kind}
                        confidence={artifact.confidence}
                        summary={artifact.summary}
                        context={artifact.context}
                        applicableWhen={artifact.applicable_when}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="subtle">No distillation.</p>
                )}
              </PanelSection>
            </PageSection>

            <PageSection id="related" label="Session related records" className="page">
              <PanelSection title="Context">
                <DetailGrid
                  items={[
                    {
                      key: "workflow-template",
                      label: "Workflow template",
                      value: workflowTemplate ? (
                        <AppLink
                          to={`/workflows/${workflowTemplate.id}`}
                          className="record-link"
                        >
                          {workflowTemplate.data.name}
                        </AppLink>
                      ) : (
                        session.data.context_injected?.workflow_template ?? "--"
                      ),
                    },
                    {
                      key: "distillations-applied",
                      label: "Distillations applied",
                      value: session.data.context_injected?.distillations_applied.length
                        ? session.data.context_injected?.distillations_applied.join(", ")
                        : "--",
                    },
                    {
                      key: "registry-rank",
                      label: "Registry rank at selection",
                      value:
                        session.data.context_injected?.registry_rank_at_selection ??
                        "--",
                    },
                  ]}
                />
              </PanelSection>

              <PanelSection title="Links">
                <div className="panel-grid">
                  <div className="panel">
                    <strong>Tasks</strong>
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
                      <p className="empty-line">No tasks.</p>
                    )}
                  </div>

                  <div className="panel">
                    <strong>Workflow runs</strong>
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
                      <p className="empty-line">No runs.</p>
                    )}
                  </div>
                </div>
              </PanelSection>

              <PanelSection
                title="Bundle"
                actions={
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={loadContext}
                    disabled={contextLoading}
                  >
                    {contextLoading ? "Loading..." : "Load"}
                  </button>
                }
              >
                {contextError ? (
                  <p className="subtle" style={{ color: "var(--danger)" }}>
                    {contextError}
                  </p>
                ) : null}
                {contextJson ? (
                  <pre className="code-block">{contextJson}</pre>
                ) : (
                  <p className="subtle">No bundle.</p>
                )}
              </PanelSection>

              {linkedWorkflowRuns.length > 0 ? (
                <PanelSection title="Run detail">
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
                </PanelSection>
              ) : null}
            </PageSection>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
