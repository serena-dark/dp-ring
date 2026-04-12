import { useState } from "react";
import { getRankings, getLeaderboard, tasks, workflows } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import {
  formatDateTime,
  formatPercent,
  titleize,
} from "@ring-gui/lib/format";
import { AppLink } from "@ring-gui/lib/router";
import { useApi } from "@ring-gui/hooks/useApi";

export default function Leaderboard() {
  const [selectedTaskType, setSelectedTaskType] = useState("");

  const leaderboardState = useApi(() => getLeaderboard(), []);
  const tasksState = useApi(() => tasks.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);

  const knownTaskTypes = Array.from(
    new Set([
      ...Object.keys(leaderboardState.data?.rankings ?? {}),
      ...(tasksState.data ?? []).map((item) => item.data.task_type),
      ...(workflowsState.data ?? []).flatMap((item) => item.data.applicable_to),
    ]),
  ).sort();
  const activeTaskType = selectedTaskType || knownTaskTypes[0] || "";

  const rankingState = useApi(
    () => getRankings(activeTaskType),
    [activeTaskType],
    { enabled: Boolean(activeTaskType) },
  );

  const loading =
    leaderboardState.loading ||
    tasksState.loading ||
    workflowsState.loading ||
    rankingState.loading;
  const error =
    leaderboardState.error ??
    tasksState.error ??
    workflowsState.error ??
    rankingState.error;

  const workflowNameById = new Map(
    (workflowsState.data ?? []).map((item) => [item.id, item.data.name]),
  );
  const rankingItems = rankingState.data ?? [];

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h3>Leaderboard</h3>
          <div className="search-row">
            <select
              value={activeTaskType}
              onChange={(event) => setSelectedTaskType(event.target.value)}
            >
              {knownTaskTypes.length === 0 ? (
                <option value="">No task types yet</option>
              ) : null}
              {knownTaskTypes.map((item) => (
                <option key={item} value={item}>
                  {titleize(item)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataState
          loading={loading}
          error={error}
          empty={!activeTaskType || rankingItems.length === 0}
          emptyMessage={
            activeTaskType ? "No rankings." : "No task types."
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Workflow</th>
                  <th>Average score</th>
                  <th>Usage count</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {rankingItems.map((item, index) => (
                  <tr key={item.workflow_id}>
                    <td>#{index + 1}</td>
                    <td>
                      <AppLink
                        to={`/workflows/${item.workflow_id}`}
                        className="record-link"
                      >
                        {workflowNameById.get(item.workflow_id) ?? item.workflow_id}
                      </AppLink>
                    </td>
                    <td>{formatPercent(item.avg_score)}</td>
                    <td>{item.usage_count}</td>
                    <td>{formatDateTime(item.last_used)}</td>
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
