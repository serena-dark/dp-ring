import { useState } from "react";
import { workflows } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  formatPercent,
  sortByUpdatedAt,
  titleize,
} from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { workflowStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function WorkflowList() {
  const [statusFilter, setStatusFilter] = useState("");
  const workflowsState = useApi(
    () => workflows.list(statusFilter || undefined),
    [statusFilter],
  );

  const workflowItems = sortByUpdatedAt(workflowsState.data ?? []);

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h3>Workflows</h3>
          <div className="search-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {workflowStatuses.map((status) => (
                <option key={status} value={status}>
                  {titleize(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          loading={workflowsState.loading}
          error={workflowsState.error}
          empty={workflowItems.length === 0}
          emptyMessage="No workflows."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Applicable to</th>
                  <th>Usage</th>
                  <th>Avg score</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {workflowItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <AppLink
                        to={`/workflows/${item.id}`}
                        className="record-link"
                      >
                        {item.id}
                      </AppLink>
                    </td>
                    <td>{item.data.name}</td>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td>{item.data.applicable_to.join(", ")}</td>
                    <td>{item.data.quality_history?.usage_count ?? 0}</td>
                    <td>
                      {formatPercent(
                        item.data.quality_history?.avg_composite_score ?? null,
                      )}
                    </td>
                    <td>{formatDateTime(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>
    </div>
  );
}
