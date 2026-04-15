import { workflows } from "@ring-gui/api/client";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { DataState } from "@ring-gui/components/DataState";
import { PageSection } from "@ring-gui/components/PageSection";
import { sortByUpdatedAt, titleize } from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { createWorkflowListTableFactory } from "@ring-gui/lib/tables/list-factories";
import { workflowStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function WorkflowList() {
  const { values, setQuery } = usePageQuery();
  const statusFilter = values.status ?? "";
  const workflowsState = useApi(
    () => workflows.list(statusFilter || undefined),
    [statusFilter],
  );

  const workflowItems = sortByUpdatedAt(workflowsState.data ?? []);
  const workflowTableFactory = createWorkflowListTableFactory();
  const statusCounts = workflowStatuses.map((status) => ({
    status,
    count: workflowItems.filter((item) => item.status === status).length,
  }));
  const usageTotal = workflowItems.reduce(
    (total, item) => total + (item.data.quality_history?.usage_count ?? 0),
    0,
  );
  const averageScoreItems = workflowItems.filter(
    (item) => item.data.quality_history?.avg_composite_score != null,
  );
  const averageScore =
    averageScoreItems.length > 0
      ? averageScoreItems.reduce(
          (total, item) =>
            total + (item.data.quality_history?.avg_composite_score ?? 0),
          0,
        ) / averageScoreItems.length
      : null;
  const topWorkflow = workflowItems
    .filter((item) => item.data.quality_history?.avg_composite_score != null)
    .sort(
      (left, right) =>
        (right.data.quality_history?.avg_composite_score ?? 0) -
        (left.data.quality_history?.avg_composite_score ?? 0),
    )[0];

  return (
    <div className="page">
      <PageSection id="summary" label="Workflow summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Total workflows</p>
            <strong>{workflowItems.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Active</p>
            <strong>{statusCounts.find((item) => item.status === "active")?.count ?? 0}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Usage total</p>
            <strong>{usageTotal}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Average quality</p>
            <strong>
              {averageScore == null ? "--" : `${Math.round(averageScore * 100)}%`}
            </strong>
          </article>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h3>Workflow summary table</h3>
            <p className="subtle">
              {topWorkflow
                ? `Top workflow: ${topWorkflow.data.name}`
                : "No scored workflows"}
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {statusCounts.map((item) => (
                  <tr key={item.status}>
                    <td>{titleize(item.status)}</td>
                    <td>{item.count}</td>
                    <td>
                      {workflowItems.length === 0
                        ? "--"
                        : `${Math.round((item.count / workflowItems.length) * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageSection>

      <PageSection id="filters" label="Workflow filters">
        <section className="panel">
          <div className="panel-header">
            <h3>Filters</h3>
            <AppLink
              to={{ path: "/workflows/rankings", hash: "records" }}
              className="button button-ghost button-small"
            >
              Ranking
            </AppLink>
          </div>

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
              {workflowStatuses.map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </select>
          </div>
        </section>
      </PageSection>

      <PageSection id="records" label="Workflow records">
        <section className="panel">
          <div className="panel-header">
            <h3>Workflows</h3>
            <p className="subtle">
              {statusFilter ? `${titleize(statusFilter)} only` : "All records"}
            </p>
          </div>

          <DataState
            loading={workflowsState.loading}
            error={workflowsState.error}
            empty={workflowItems.length === 0}
            emptyMessage="No workflows."
          >
            <FactoryTable factory={workflowTableFactory} rows={workflowItems} />
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
