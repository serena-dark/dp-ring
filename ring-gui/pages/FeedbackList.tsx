import { FormEvent, useMemo, useState } from "react";
import { feedback } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { PageSection } from "@ring-gui/components/PageSection";
import { TextField } from "@ring-gui/components/TextField";
import { sortByUpdatedAt, titleize } from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { usePageQuery } from "@ring-gui/lib/page-state";
import {
  feedbackCategories,
  feedbackSeverities,
  feedbackStatuses,
} from "@ring-gui/lib/state";
import { createFeedbackListTableFactory } from "@ring-gui/lib/tables/list-factories";
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
  const { values, setQuery } = usePageQuery();
  const statusFilter = values.status ?? "";
  const severityFilter = values.severity ?? "";
  const composeOpen = values.compose === "1";

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

  const feedbackTableFactory = createFeedbackListTableFactory({
    transitioningId,
    onTransition: handleTransition,
  });
  const openCount = feedbackItems.filter((item) => item.status === "open").length;
  const criticalCount = feedbackItems.filter(
    (item) => item.data.severity === "critical",
  ).length;
  const majorCount = feedbackItems.filter(
    (item) => item.data.severity === "major",
  ).length;

  return (
    <div className="page">
      <PageSection id="summary" label="Feedback summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Visible feedback</p>
            <strong>{feedbackItems.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Open</p>
            <strong>{openCount}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Critical</p>
            <strong>{criticalCount}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Major</p>
            <strong>{majorCount}</strong>
          </article>
        </div>
      </PageSection>

      <PageSection id="create" label="Create feedback">
        <details className="panel details-card" open={composeOpen || undefined}>
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

              <TextField
                id="feedback-target-id"
                label="Target id"
                value={targetId}
                onValueChange={setTargetId}
                placeholder="t1-frontend-shell"
              />

              <TextField
                id="feedback-target-field"
                label="Target field"
                value={targetField}
                onValueChange={setTargetField}
                placeholder="data.acceptance_criteria"
              />

              <TextField
                id="feedback-source-session"
                label="Source session"
                value={sourceSessionId}
                onValueChange={setSourceSessionId}
                placeholder="s1-step1-baseline"
              />

              <TextField
                id="feedback-description"
                label="Description"
                multiline
                value={description}
                onValueChange={setDescription}
                placeholder="Describe the issue and its impact."
                containerStyle={{ gridColumn: "1 / -1" }}
              />

              <TextField
                id="feedback-action"
                label="Proposed action"
                multiline
                value={proposedAction}
                onValueChange={setProposedAction}
                placeholder="Optional mitigation or follow-up."
                containerStyle={{ gridColumn: "1 / -1" }}
              />

              <div className="button-row" style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className="button" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Feedback"}
                </button>
              </div>
            </form>
          </div>
        </details>
      </PageSection>

      <PageSection id="records" label="Feedback records">
        <section className="panel">
          <div className="panel-header">
            <h3>Feedback</h3>
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
                {feedbackStatuses.map((item) => (
                  <option key={item} value={item}>
                    {titleize(item)}
                  </option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(event) =>
                  setQuery({
                    severity: event.target.value || null,
                  })
                }
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
            <FactoryTable factory={feedbackTableFactory} rows={feedbackItems} />
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
