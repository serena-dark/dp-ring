import { FormEvent, useState } from "react";
import {
  milestones,
  requirements,
  sessions,
  tasks,
} from "@ring-gui/api/client";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { DataState } from "@ring-gui/components/DataState";
import { PageSection } from "@ring-gui/components/PageSection";
import { sortByUpdatedAt, titleize } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { useRouter } from "@ring-gui/lib/router";
import { createSessionListTableFactory } from "@ring-gui/lib/tables/list-factories";
import { sessionStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function SessionList() {
  const [name, setName] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { notify } = useNotifications();
  const { navigate } = useRouter();
  const { values, setQuery } = usePageQuery();
  const statusFilter = values.status ?? "";
  const composeOpen = values.compose === "1";

  const sessionsState = useApi(
    () => sessions.list(statusFilter || undefined),
    [statusFilter],
  );
  const requirementsState = useApi(() => requirements.list(), []);
  const milestonesState = useApi(() => milestones.list(), []);
  const tasksState = useApi(() => tasks.list(), []);

  const loading =
    sessionsState.loading ||
    requirementsState.loading ||
    milestonesState.loading ||
    tasksState.loading;
  const error =
    sessionsState.error ??
    requirementsState.error ??
    milestonesState.error ??
    tasksState.error;

  const requirementItems = requirementsState.data ?? [];
  const milestoneItems = milestonesState.data ?? [];
  const taskItems = tasksState.data ?? [];
  const visibleMilestones = milestoneItems.filter((item) =>
    requirementId ? item.data.requirement_id === requirementId : true,
  );
  const visibleTasks = taskItems.filter((item) =>
    milestoneId
      ? item.data.milestone_id === milestoneId
      : requirementId
        ? item.data.requirement_id === requirementId
        : true,
  );

  const requirementNameById = new Map(
    requirementItems.map((item) => [item.id, item.data.name]),
  );
  const milestoneNameById = new Map(
    milestoneItems.map((item) => [item.id, item.data.name]),
  );

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId)
        ? current.filter((item) => item !== taskId)
        : [...current, taskId],
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      notify("Session name is required.", "error");
      return;
    }
    if (!requirementId || !milestoneId || selectedTaskIds.length === 0) {
      notify("Requirement, milestone, and at least one task are required.", "error");
      return;
    }

    setSubmitting(true);
    const result = await sessions.create({
      name: name.trim(),
      status: "gate_pending",
      data: {
        requirement_id: requirementId,
        milestone_id: milestoneId,
        task_ids: selectedTaskIds,
        workflow_run_ids: [],
        execution_log: [],
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Created session ${result.data.id}.`, "success");
    setName("");
    setRequirementId("");
    setMilestoneId("");
    setSelectedTaskIds([]);
    await sessionsState.reload();
    navigate(`/sessions/${result.data.id}`);
  };

  const sessionItems = sortByUpdatedAt(sessionsState.data ?? []);
  const sessionTableFactory = createSessionListTableFactory({
    requirementNameById,
    milestoneNameById,
  });
  const activeSessions = sessionItems.filter(
    (item) => !["closed", "failed"].includes(item.status),
  ).length;
  const preparingSessions = sessionItems.filter((item) =>
    ["preparing", "executing", "reviewing"].includes(item.status),
  ).length;

  return (
    <div className="page">
      <PageSection id="summary" label="Session summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Total sessions</p>
            <strong>{sessionItems.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Active</p>
            <strong>{activeSessions}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Executing</p>
            <strong>{preparingSessions}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Visible tasks</p>
            <strong>{visibleTasks.length}</strong>
          </article>
        </div>
      </PageSection>

      <PageSection id="create" label="Create session">
        <details className="panel details-card" open={composeOpen || undefined}>
          <summary>
            <div className="panel-header">
              <h3>New session</h3>
            </div>
          </summary>
          <div className="details-body">
            <form onSubmit={handleSubmit} className="field-grid">
              <div className="field">
                <label htmlFor="session-name">Name</label>
                <input
                  id="session-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Frontend delivery loop"
                />
              </div>

              <div className="field">
                <label htmlFor="session-requirement">Requirement</label>
                <select
                  id="session-requirement"
                  value={requirementId}
                  onChange={(event) => {
                    setRequirementId(event.target.value);
                    setMilestoneId("");
                    setSelectedTaskIds([]);
                  }}
                >
                  <option value="">Select requirement</option>
                  {requirementItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} - {item.data.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="session-milestone">Milestone</label>
                <select
                  id="session-milestone"
                  value={milestoneId}
                  onChange={(event) => {
                    setMilestoneId(event.target.value);
                    setSelectedTaskIds([]);
                  }}
                >
                  <option value="">Select milestone</option>
                  {visibleMilestones.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} - {item.data.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Tasks</label>
                <div className="checkbox-list">
                  {visibleTasks.length > 0 ? (
                    visibleTasks.map((item) => (
                      <label key={item.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(item.id)}
                          onChange={() => toggleTask(item.id)}
                        />
                        <span>
                          <strong>{item.data.name}</strong>
                          <br />
                          <span className="subtle">
                            {item.id} / {titleize(item.status)}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <span className="empty-line">
                      No tasks.
                    </span>
                  )}
                </div>
              </div>

              <div className="button-row" style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </details>
      </PageSection>

      <PageSection id="records" label="Session records">
        <section className="panel">
          <div className="panel-header">
            <h3>Sessions</h3>
            <div className="search-row">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setQuery({
                    status: event.target.value || null,
                  })
                }
              >
                <option value="">All statuses</option>
                {sessionStatuses.map((status) => (
                  <option key={status} value={status}>
                    {titleize(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DataState
            loading={loading}
            error={error}
            empty={sessionItems.length === 0}
            emptyMessage="No sessions."
          >
            <FactoryTable factory={sessionTableFactory} rows={sessionItems} />
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
