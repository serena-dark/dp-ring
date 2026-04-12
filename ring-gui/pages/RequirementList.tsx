import { useState } from "react";
import { milestones, requirements } from "@ring-gui/api/client";
import RequirementComposerCard from "@ring-gui/components/RequirementComposerCard";
import { DataState } from "@ring-gui/components/DataState";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import {
  formatDateTime,
  sortByUpdatedAt,
  titleize,
} from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { requirementStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function RequirementList() {
  const [statusFilter, setStatusFilter] = useState("");

  const requirementsState = useApi(
    () => requirements.list(statusFilter || undefined),
    [statusFilter],
  );
  const milestonesState = useApi(() => milestones.list(), []);

  const loading = requirementsState.loading || milestonesState.loading;
  const error = requirementsState.error ?? milestonesState.error;

  const milestoneItems = milestonesState.data ?? [];
  const requirementItems = sortByUpdatedAt(requirementsState.data ?? []);

  return (
    <div className="page">
      <RequirementComposerCard />

      <section className="panel">
        <div className="panel-header">
          <h3>Requirements</h3>
          <div className="search-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {requirementStatuses.map((status) => (
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
          empty={requirementItems.length === 0}
          emptyMessage="No requirements."
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Milestones</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {requirementItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <AppLink
                        to={`/requirements/${item.id}`}
                        className="record-link"
                      >
                        {item.id}
                      </AppLink>
                    </td>
                    <td>{item.data.name}</td>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td>
                      <StatusBadge value={item.data.priority} kind="priority" />
                    </td>
                    <td>
                      {
                        milestoneItems.filter(
                          (milestone) =>
                            milestone.data.requirement_id === item.id,
                        ).length
                      }
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
