import { FormEvent, useMemo, useState } from "react";
import { feedback } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  sortByUpdatedAt,
  titleize,
} from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { AppLink } from "@ring-gui/lib/router";
import {
  feedbackCategories,
  feedbackSeverities,
  feedbackStatuses,
} from "@ring-gui/lib/state";
import { artifactPath } from "@ring-gui/lib/routes";
import { useApi } from "@ring-gui/hooks/useApi";
import type { ArtifactType } from "@ring-gui/types/api";

const targetTypes: ArtifactType[] = [
  "requirement",
  "milestone",
  "task",
  "workflow",
  "session",
  "evaluation",
  "feedback",
  "distillation",
];

export default function FeedbackList() {
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [severity, setSeverity] =
    useState<(typeof feedbackSeverities)[number]>("major");
  const [category, setCategory] =
    useState<(typeof feedbackCategories)[number]>("implementation_bug");
  const [targetType, setTargetType] = useState<ArtifactType>("task");
  const [targetId, setTargetId] = useState("");
  const [targetField, setTargetField] = useState("");
  const [description, setDescription] = useState("");
  const [proposedAction, setProposedAction] = useState("");
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  const { notify } = useNotifications();

  const feedbackState = useApi(
    () => feedback.list(statusFilter || undefined),
    [statusFilter],
  );

  const feedbackItems = useMemo(
    () =>
      sortByUpdatedAt(feedbackState.data ?? []).filter((item) =>
        severityFilter ? item.data.severity === severityFilter : true,
      ),
    [feedbackState.data, severityFilter],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!targetId.trim() || !description.trim()) {
      notify("Target id and description are required.", "error");
      return;
    }

    setSubmitting(true);
    const result = await feedback.create({
      name: `${severity}-${category}-${targetId}`,
      status: "open",
      data: {
        source_session_id: sourceSessionId.trim() || null,
        severity,
        category,
        target: {
          type: targetType,
          id: targetId.trim(),
          field: targetField.trim() || null,
        },
        description: description.trim(),
        proposed_action: proposedAction.trim() || null,
        resolution_session_id: null,
      },
    });
    setSubmitting(false);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Created feedback ${result.data.id}.`, "success");
    setTargetId("");
    setTargetField("");
    setDescription("");
    setProposedAction("");
    setSourceSessionId("");
    await feedbackState.reload();
  };

  const handleTransition = async (feedbackId: string, nextStatus: string) => {
    setTransitioningId(feedbackId);
    const result = await feedback.update(feedbackId, { status: nextStatus });
    setTransitioningId(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Feedback ${feedbackId} moved to ${titleize(nextStatus)}.`, "success");
    await feedbackState.reload();
  };

  return (
    <div className="page">
      <details className="panel details-card">
        <summary>
          <div className="panel-header">
            <h3>New feedback</h3>
          </div>
        </summary>
        <div className="details-body">
          <form onSubmit={handleSubmit} className="field-grid">
            <div className="field">
              <label htmlFor="feedback-severity">Severity</label>
              <select
                id="feedback-severity"
                value={severity}
                onChange={(event) =>
                  setSeverity(
                    event.target.value as (typeof feedbackSeverities)[number],
                  )
                }
              >
                {feedbackSeverities.map((item) => (
                  <option key={item} value={item}>
                    {titleize(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-category">Category</label>
              <select
                id="feedback-category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value as (typeof feedbackCategories)[number],
                  )
                }
              >
                {feedbackCategories.map((item) => (
                  <option key={item} value={item}>
                    {titleize(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-target-type">Target type</label>
              <select
                id="feedback-target-type"
                value={targetType}
                onChange={(event) =>
                  setTargetType(event.target.value as ArtifactType)
                }
              >
                {targetTypes.map((item) => (
                  <option key={item} value={item}>
                    {titleize(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="feedback-target-id">Target id</label>
              <input
                id="feedback-target-id"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                placeholder="t1-frontend-shell"
              />
            </div>

            <div className="field">
              <label htmlFor="feedback-target-field">Target field</label>
              <input
                id="feedback-target-field"
                value={targetField}
                onChange={(event) => setTargetField(event.target.value)}
                placeholder="data.acceptance_criteria"
              />
            </div>

            <div className="field">
              <label htmlFor="feedback-source-session">Source session</label>
              <input
                id="feedback-source-session"
                value={sourceSessionId}
                onChange={(event) => setSourceSessionId(event.target.value)}
                placeholder="s1-step1-baseline"
              />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="feedback-description">Description</label>
              <textarea
                id="feedback-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the issue and its impact."
              />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="feedback-action">Proposed action</label>
              <textarea
                id="feedback-action"
                value={proposedAction}
                onChange={(event) => setProposedAction(event.target.value)}
                placeholder="Optional mitigation or follow-up."
              />
            </div>

            <div className="button-row" style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Creating..." : "Create Feedback"}
              </button>
            </div>
          </form>
        </div>
      </details>

      <section className="panel">
        <div className="panel-header">
          <h3>Feedback</h3>
          <div className="search-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {feedbackStatuses.map((item) => (
                <option key={item} value={item}>
                  {titleize(item)}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
            >
              <option value="">All severities</option>
              {feedbackSeverities.map((item) => (
                <option key={item} value={item}>
                  {titleize(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          loading={feedbackState.loading}
          error={feedbackState.error}
          empty={feedbackItems.length === 0}
          emptyMessage="No feedback."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Target</th>
                  <th>Description</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {feedbackItems.map((item) => {
                  const path = artifactPath(item.data.target.type, item.data.target.id);
                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <StatusBadge value={item.data.severity} kind="severity" />
                      </td>
                      <td>
                        <StatusBadge value={item.status} />
                      </td>
                      <td>{titleize(item.data.category)}</td>
                      <td>
                        {path ? (
                          <AppLink to={path} className="record-link">
                            {item.data.target.type}:{item.data.target.id}
                          </AppLink>
                        ) : (
                          `${item.data.target.type}:${item.data.target.id}`
                        )}
                        {item.data.target.field ? (
                          <p className="subtle">{item.data.target.field}</p>
                        ) : null}
                      </td>
                      <td>
                        <strong>{item.data.description}</strong>
                        {item.data.proposed_action ? (
                          <p className="subtle">
                            Proposed: {item.data.proposed_action}
                          </p>
                        ) : null}
                      </td>
                      <td>{formatDateTime(item.updated_at)}</td>
                      <td>
                        <StateActions
                          type="feedback"
                          status={item.status}
                          pendingStatus={
                            transitioningId === item.id ? item.status : null
                          }
                          onTransition={(nextStatus) =>
                            handleTransition(item.id, nextStatus)
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>
    </div>
  );
}
