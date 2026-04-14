import { useState } from "react";
import { workflows } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { DetailGrid } from "@ring-gui/components/DetailGrid";
import { PageSection } from "@ring-gui/components/PageSection";
import { PageHero } from "@ring-gui/components/PageHero";
import { PanelSection } from "@ring-gui/components/PanelSection";
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
      emptyMessage="Not found."
    >
      {workflow ? (
        <div className="page">
          <PageSection id="summary" label="Workflow summary">
            <PageHero
              title={workflow.data.name}
              badges={[
                <StatusBadge key="status" value={workflow.status} />,
                ...workflow.data.applicable_to.map((item) => (
                  <StatusBadge key={item} value={item} />
                )),
              ]}
              actions={
                <StateActions
                  type="workflow"
                  status={workflow.status}
                  pendingStatus={pendingStatus}
                  onTransition={handleTransition}
                />
              }
            />
          </PageSection>

          <section className="split-grid">
            <PageSection id="records" label="Workflow records" className="page">
              <PanelSection title="Summary">
                <p>{workflow.data.description}</p>
                <div className="divider" />
                <DetailGrid
                  items={[
                    {
                      key: "created",
                      label: "Created",
                      value: formatDateTime(workflow.created_at),
                    },
                    {
                      key: "updated",
                      label: "Updated",
                      value: formatDateTime(workflow.updated_at),
                    },
                    {
                      key: "usage-count",
                      label: "Usage count",
                      value: workflow.data.quality_history?.usage_count ?? 0,
                    },
                    {
                      key: "average-score",
                      label: "Average score",
                      value: formatPercent(
                        workflow.data.quality_history?.avg_composite_score ?? null,
                      ),
                    },
                  ]}
                />
              </PanelSection>

              <PanelSection title="Steps">
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
              </PanelSection>
            </PageSection>

            <PageSection id="related" label="Workflow scores" className="page">
              <PanelSection title="Scores">
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
              </PanelSection>
            </PageSection>
          </section>
        </div>
      ) : null}
    </DataState>
  );
}
