import { useState } from "react";
import { workflows } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StateActions } from "@ring-gui/components/StateActions";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  formatPercent,
  titleize,
} from "@ring-gui/lib/format";
import { useNotifications } from "@ring-gui/lib/notifications";
import { useApi } from "@ring-gui/hooks/useApi";

export default function WorkflowDetail({ id }: { id: string }) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const { notify } = useNotifications();

  const workflowState = useApi(() => workflows.read(id), [id]);
  const workflow = workflowState.data;

  const handleTransition = async (nextStatus: string) => {
    setPendingStatus(nextStatus);
    const result = await workflows.update(id, { status: nextStatus });
    setPendingStatus(null);

    if (!result.ok) {
      notify(result.error, "error");
      return;
    }

    notify(`Workflow moved to ${titleize(nextStatus)}.`, "success");
    await workflowState.reload();
  };

  return (
    <DataState
      loading={workflowState.loading}
      error={workflowState.error}
      empty={!workflow}
      emptyMessage={`Workflow ${id} was not found.`}
    >
      {workflow ? (
        <div className="page">
          <section className="page-hero">
            <div>
              <p className="eyebrow">Workflow</p>
              <h3>{workflow.data.name}</h3>
              <div className="badge-list">
                <StatusBadge value={workflow.status} />
                {workflow.data.applicable_to.map((item) => (
                  <StatusBadge key={item} value={item} />
                ))}
              </div>
            </div>
            <StateActions
              type="workflow"
              status={workflow.status}
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
                    <h3>Template purpose</h3>
                  </div>
                </div>
                <p>{workflow.data.description}</p>
                <div className="divider" />
                <div className="detail-grid">
                  <div className="detail-item">
                    <dt>Created</dt>
                    <dd>{formatDateTime(workflow.created_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Updated</dt>
                    <dd>{formatDateTime(workflow.updated_at)}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Usage count</dt>
                    <dd>{workflow.data.quality_history?.usage_count ?? 0}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Average score</dt>
                    <dd>
                      {formatPercent(
                        workflow.data.quality_history?.avg_composite_score ??
                          null,
                      )}
                    </dd>
                  </div>
                </div>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Steps</p>
                    <h3>Workflow definition</h3>
                  </div>
                </div>
                <div className="panel-grid">
                  {workflow.data.steps.map((step) => (
                    <div key={step.id} className="panel">
                      <strong>{step.name}</strong>
                      <p className="subtle">{step.id}</p>
                      <p>{step.description}</p>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <dt>Inputs</dt>
                          <dd>
                            {step.inputs?.length ? step.inputs.join(", ") : "--"}
                          </dd>
                        </div>
                        <div className="detail-item">
                          <dt>Outputs</dt>
                          <dd>
                            {step.outputs?.length ? step.outputs.join(", ") : "--"}
                          </dd>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <aside className="page">
              <article className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Quality history</p>
                    <h3>Recent scores</h3>
                  </div>
                </div>
                {workflow.data.quality_history?.recent_scores?.length ? (
                  <div className="score-stack">
                    {workflow.data.quality_history.recent_scores.map((entry) => (
                      <div key={entry.session_id} className="score-row">
                        <div className="score-row-header">
                          <span>{entry.session_id}</span>
                          <strong>{formatPercent(entry.composite_score)}</strong>
                        </div>
                        <div className="meter">
                          <span
                            style={{ width: `${entry.composite_score * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="empty-line">No scores.</p>
              )}
              </article>
            </aside>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
