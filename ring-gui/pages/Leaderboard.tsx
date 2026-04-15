import { getRankings, getLeaderboard, tasks, workflows } from "@ring-gui/api/client";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { DataState } from "@ring-gui/components/DataState";
import { PageSection } from "@ring-gui/components/PageSection";
import { titleize } from "@ring-gui/lib/format";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { AppLink } from "@ring-gui/lib/router";
import { createLeaderboardTableFactory } from "@ring-gui/lib/tables/list-factories";
import { useApi } from "@ring-gui/hooks/useApi";

export default function Leaderboard() {
  const { values, setQuery } = usePageQuery();
  const selectedTaskType = values.task_type ?? "";

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
  const leaderboardTableFactory = createLeaderboardTableFactory({
    workflowNameById,
  });

  return (
    <div className="page">
      <PageSection id="filters" label="Ranking filters">
        <section className="panel">
          <div className="panel-header">
            <h3>Ranking</h3>
            <div className="panel-header-actions">
              <AppLink
                to={{ path: "/workflows", hash: "summary" }}
                className="button button-ghost button-small"
              >
                Workflows
              </AppLink>
              <div className="search-row">
                <select
                  value={activeTaskType}
                  onChange={(event) =>
                    setQuery({
                      task_type: event.target.value || null,
                    })
                  }
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
          </div>
        </section>
      </PageSection>

      <PageSection id="records" label="Rankings">
        <section className="panel">
          <DataState
            loading={loading}
            error={error}
            empty={!activeTaskType || rankingItems.length === 0}
            emptyMessage={
              activeTaskType ? "No rankings." : "No task types."
            }
          >
            <FactoryTable factory={leaderboardTableFactory} rows={rankingItems} />
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
