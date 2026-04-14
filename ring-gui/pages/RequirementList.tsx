import { milestones, requirements } from "@ring-gui/api/client";
import { FactoryTable } from "@ring-gui/components/FactoryTable";
import { PageSection } from "@ring-gui/components/PageSection";
import RequirementComposerCard from "@ring-gui/components/RequirementComposerCard";
import { DataState } from "@ring-gui/components/DataState";
import { sortByUpdatedAt, titleize } from "@ring-gui/lib/format";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { createRequirementListTableFactory } from "@ring-gui/lib/tables/list-factories";
import { requirementStatuses } from "@ring-gui/lib/state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function RequirementList() {
  const { values, setQuery } = usePageQuery();
  const statusFilter = values.status ?? "";

  const requirementsState = useApi(
    () => requirements.list(statusFilter || undefined),
    [statusFilter],
  );
  const milestonesState = useApi(() => milestones.list(), []);

  const loading = requirementsState.loading || milestonesState.loading;
  const error = requirementsState.error ?? milestonesState.error;

  const milestoneItems = milestonesState.data ?? [];
  const requirementItems = sortByUpdatedAt(requirementsState.data ?? []);
  const milestoneCountByRequirementId = new Map<string, number>();

  for (const item of milestoneItems) {
    const count = milestoneCountByRequirementId.get(item.data.requirement_id) ?? 0;
    milestoneCountByRequirementId.set(item.data.requirement_id, count + 1);
  }

  const requirementTableFactory = createRequirementListTableFactory({
    milestoneCountByRequirementId,
  });
  const readyCount = requirementItems.filter((item) => item.status === "ready").length;
  const inProgressCount = requirementItems.filter(
    (item) => item.status === "in_progress",
  ).length;
  const totalMilestones = milestoneItems.length;

  return (
    <div className="page">
      <PageSection id="summary" label="Requirement summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Total requirements</p>
            <strong>{requirementItems.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Ready</p>
            <strong>{readyCount}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">In progress</p>
            <strong>{inProgressCount}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Milestones</p>
            <strong>{totalMilestones}</strong>
          </article>
        </div>
      </PageSection>

      <PageSection id="create" label="Create requirement">
        <RequirementComposerCard />
      </PageSection>

      <PageSection id="records" label="Requirement records">
        <section className="panel">
          <div className="panel-header">
            <h3>Requirements</h3>
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
            <FactoryTable factory={requirementTableFactory} rows={requirementItems} />
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
