import { useState } from "react";
import { checkGate, milestones, requirements, tasks } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatDateTime, titleize } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";
import type { ApiResponse, GateResult } from "@ring-gui/types/api";

export default function RequirementDetail({ id }: { id: string }) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [gatePendingId, setGatePendingId] = useState<string | null>(null);
  const [gateResults, setGateResults] = useState<
    Record<string, ApiResponse<GateResult>>
  >({});

  const { notify } = useNotifications();

  const requirementState = useApi(() => requirements.read(id), [id]);
  const milestonesState = useApi(() => milestones.list(), []);
  const tasksState = useApi(() => tasks.list(), []);

  const loading =
    requirementState.loading || milestonesState.loading || tasksState.loading;
  const error =
    requirementState.error ?? milestonesState.error ?? tasksState.error;

  const requirement = requirementState.data;
  const linkedMilestones = (milestonesState.data ?? []).filter(
    (item) => item.data.requirement_id === requirement?.id,
  );
  const linkedTasks = (tasksState.data ?? []).filter(
    (item) => item.data.requirement_id === requirement?.id,
  );

  const handleTransition = async (nextStatus: string) => {
    setPendingStatus(nextStatus);
    const result = await requirements.update(id, { status: nextStatus });
    setPendingStatus(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Requirement moved to ${titleize(nextStatus)}.`, "success");
    await requirementState.reload();
  };

  const runGateCheck = async (milestoneId: string) => {
    setGatePendingId(milestoneId);
    const result = await checkGate(milestoneId);
    setGateResults((current) => ({ ...current, [milestoneId]: result }));
    setGatePendingId(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(
      `Gate ${result.data.passed ? "passed" : "failed"} for ${milestoneId}.`,
      result.data.passed ? "success" : "info",
    );
  };

  return (
    <DataState
      loading={loading}
      error={error}
      empty={!requirement}
      emptyMessage={`Requirement ${id} was not found.`}
    >
      {requirement ? (
        <div className="page">
          <section className="page-hero">
            <div>
              <p className="eyebrow">Requirement</p>
              <h3>{requirement.data.name}</h3>
              <div className="badge-list">
                <StatusBadge value={requirement.status} />
                <StatusBadge value={requirement.data.priority} kind="priority" />
              </div>
            </div>
            <StateActions
              type="requirement"
              status={requirement.status}
              pendingStatus={pendingStatus}
              onTransition={handleTransition}
            />
          </section>

          <section className="split-grid">
            <div className="page">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Description</p>
                    <h3>Scope and intent</h3>
                  </div>
                </div>
                <p>{requirement.data.description}</p>
                <div className="divider" />
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Created</dt>
                    <dd>{formatDateTime(requirement.created_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(requirement.updated_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Milestones</dt>
                    <dd>{linkedMilestones.length}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Tasks</dt>
                    <dd>{linkedTasks.length}</dd>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Acceptance</p>
                    <h3>Criteria</h3>
                  </div>
                </div>
                <div className="panel-grid">
                  {requirement.data.acceptance_criteria.map((criterion) => (
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
                  <div>
                    <p className="eyebrow">Milestones</p>
                    <h3>Gate-driven delivery</h3>
                  </div>
                </div>
                <div className="panel-grid">
                  {linkedMilestones.length > 0 ? (
                    linkedMilestones.map((milestone) => {
                      const gateResult = gateResults[milestone.id];
                      return (
                        <div key={milestone.id} className="panel">
                          <div className="panel-header">
                            <div>
                              <h3>{milestone.data.name}</h3>
                              <p className="subtle">{milestone.id}</p>
                            </div>
                            <StatusBadge value={milestone.status} />
                          </div>

                          <p>{milestone.data.description}</p>
                          <div className="divider" />

                          <div className="detail-grid">
                            <div className="detail-item">
                              <dt>Acceptance checks</dt>
                              <dd>
                                {milestone.data.acceptance_checks?.length ?? 0}
                              </dd>
                            </div>
                            <div className="detail-item">
                              <dt>Prerequisites</dt>
                              <dd>{milestone.data.prerequisites.length}</dd>
                            </div>
                          </div>

                          <div className="divider" />

                          <p className="eyebrow">Prerequisites</p>
                          <div className="panel-grid">
                            {milestone.data.prerequisites.map((prerequisite) => (
                              <div key={prerequisite.id} className="panel">
                                <div className="badge-list">
                                  <StatusBadge value={prerequisite.status} />
                                </div>
                                <strong>{prerequisite.description}</strong>
                                <p className="subtle">
                                  {titleize(prerequisite.check_type)} / last
                                  checked {formatDateTime(prerequisite.last_checked)}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="button-row" style={{ marginTop: "1rem" }}>
                            <button
                              type="button"
                              className="button button-secondary button-small"
                              disabled={gatePendingId === milestone.id}
                              onClick={() => runGateCheck(milestone.id)}
                            >
                              {gatePendingId === milestone.id
                                ? "Checking..."
                                : "Check Gate"}
                            </button>
                          </div>

                          {gateResult ? (
                            <div style={{ marginTop: "1rem" }}>
                              {gateResult.ok ? (
                                <div className="panel">
                                  <div className="badge-list">
                                    <StatusBadge
                                      value={
                                        gateResult.data.passed
                                          ? "completed"
                                          : "failed"
                                      }
                                    />
                                  </div>
                                  <p className="subtle">
                                    Critical feedback:{" "}
                                    {gateResult.data.blocking_feedback.critical.length}
                                    {" / "}
                                    Major unacknowledged:{" "}
                                    {
                                      gateResult.data.blocking_feedback
                                        .major_unacknowledged.length
                                    }
                                  </p>
                                  {gateResult.data.results.map((result) => (
                                    <div key={result.id} className="detail-item">
                                      <dt>{result.id}</dt>
                                      <dd>
                                        {result.satisfied ? "Pass" : "Fail"} -{" "}
                                        {result.detail}
                                      </dd>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="subtle" style={{ color: "var(--danger)" }}>
                                  {gateResult.error}
                                </p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-line">No milestones.</p>
                  )}
                </div>
              </article>
            </div>

            <aside className="page">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Tasks</p>
                    <h3>Execution units</h3>
                  </div>
                </div>
                {linkedTasks.length > 0 ? (
                  <div className="panel-grid">
                    {linkedTasks.map((task) => (
                      <div key={task.id} className="panel">
                        <AppLink to={`/tasks/${task.id}`} className="record-link">
                          {task.data.name}
                        </AppLink>
                        <p className="subtle">
                          {task.id} / {task.data.task_type}
                        </p>
                        <div className="badge-list">
                          <StatusBadge value={task.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-line">No tasks.</p>
                )}
              </article>
            </aside>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
