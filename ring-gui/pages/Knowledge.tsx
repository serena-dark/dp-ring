import { useDeferredValue } from "react";
import { distillations, getKnowledge, tasks, workflows } from "@ring-gui/api/client";
import {
  ArtifactCard,
  ArtifactConfidenceLine,
} from "@ring-gui/components/ArtifactCard";
import { DataState } from "@ring-gui/components/DataState";
import { PageSection } from "@ring-gui/components/PageSection";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { titleize } from "@ring-gui/lib/format";
import { usePageQuery } from "@ring-gui/lib/page-state";
import { useApi } from "@ring-gui/hooks/useApi";

export default function Knowledge() {
  const { values, setQuery } = usePageQuery();
  const selectedContext = values.context ?? "";
  const minConfidence = values.min_confidence ?? "0.3";
  const searchTerm = values.search ?? "";

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const distillationsState = useApi(() => distillations.list("published"), []);
  const tasksState = useApi(() => tasks.list(), []);
  const workflowsState = useApi(() => workflows.list(), []);

  const knownContexts = Array.from(
    new Set([
      ...(distillationsState.data ?? []).flatMap((item) =>
        item.data.artifacts.map((artifact) => artifact.context),
      ),
      ...(tasksState.data ?? []).map((item) => item.data.task_type),
      ...(workflowsState.data ?? []).flatMap((item) => item.data.applicable_to),
    ]),
  ).sort();
  const activeContext = selectedContext || knownContexts[0] || "";

  const numericMinConfidence = Number(minConfidence);
  const knowledgeState = useApi(
    () =>
      getKnowledge(
        activeContext,
        Number.isFinite(numericMinConfidence) ? numericMinConfidence : undefined,
      ),
    [activeContext, numericMinConfidence],
    { enabled: Boolean(activeContext) },
  );

  const loading =
    distillationsState.loading ||
    tasksState.loading ||
    workflowsState.loading ||
    knowledgeState.loading;
  const error =
    distillationsState.error ??
    tasksState.error ??
    workflowsState.error ??
    knowledgeState.error;

  const query = deferredSearchTerm.trim().toLowerCase();
  const filteredDistillations = (distillationsState.data ?? []).filter((item) =>
    query
      ? item.data.artifacts.some((artifact) =>
          [artifact.kind, artifact.summary, artifact.context, artifact.applicable_when]
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : true,
  );
  const knowledgeCount = (knowledgeState.data ?? []).length;

  return (
    <div className="page">
      <PageSection id="summary" label="Knowledge summary">
        <div className="stats-grid">
          <article className="panel stat-card">
            <p className="eyebrow">Contexts</p>
            <strong>{knownContexts.length}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Active context</p>
            <strong>{activeContext ? titleize(activeContext) : "--"}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Knowledge items</p>
            <strong>{knowledgeCount}</strong>
          </article>
          <article className="panel stat-card">
            <p className="eyebrow">Distillations</p>
            <strong>{filteredDistillations.length}</strong>
          </article>
        </div>
      </PageSection>

      <PageSection id="records" label="Knowledge records">
        <section className="panel">
          <div className="panel-header">
            <h3>Knowledge</h3>
          </div>
          <div className="search-row">
            <select
              value={activeContext}
              onChange={(event) =>
                setQuery({
                  context: event.target.value || null,
                })
              }
            >
              {knownContexts.length === 0 ? (
                <option value="">No contexts</option>
              ) : null}
              {knownContexts.map((item) => (
                <option key={item} value={item}>
                  {titleize(item)}
                </option>
              ))}
            </select>
            <input
              value={minConfidence}
              onChange={(event) =>
                setQuery({
                  min_confidence: event.target.value || null,
                })
              }
              placeholder="0.3"
            />
          </div>

          <DataState
            loading={loading}
            error={error}
            empty={!activeContext || (knowledgeState.data ?? []).length === 0}
            emptyMessage={
              activeContext ? "No knowledge." : "No contexts."
            }
          >
            <div className="panel-grid">
              {(knowledgeState.data ?? []).map((item, index) => (
                <ArtifactCard
                  key={`${item.distillation_id}-${index}`}
                  kind={item.kind}
                  confidence={item.confidence}
                  summary={item.summary}
                  applicableWhen={item.applicable_when}
                  applicableWhenTone="subtle"
                  footer={<ArtifactConfidenceLine confidence={item.confidence} />}
                />
              ))}
            </div>
          </DataState>
        </section>
      </PageSection>

      <PageSection id="related" label="Distillations">
        <section className="panel">
          <div className="panel-header">
            <h3>Distillations</h3>
            <div className="search-row">
              <input
                value={searchTerm}
                onChange={(event) =>
                  setQuery({
                    search: event.target.value || null,
                  })
                }
                placeholder="Search summary, context, or applicable_when"
              />
            </div>
          </div>

          <DataState
            loading={distillationsState.loading}
            error={distillationsState.error}
            empty={filteredDistillations.length === 0}
            emptyMessage="No distillations."
          >
            <div className="panel-grid">
              {filteredDistillations.map((distillation) => (
                <details key={distillation.id} className="panel details-card" open>
                  <summary>
                    <div className="panel-header">
                      <div>
                        <p className="eyebrow">{distillation.id}</p>
                        <h3>{distillation.data.source_session_id}</h3>
                      </div>
                      <StatusBadge value={distillation.status} />
                    </div>
                  </summary>
                  <div className="details-body">
                    <div className="panel-grid">
                      {distillation.data.artifacts.map((artifact, index) => (
                        <ArtifactCard
                          key={`${artifact.kind}-${index}`}
                          kind={artifact.kind}
                          confidence={artifact.confidence}
                          summary={artifact.summary}
                          context={artifact.context}
                          applicableWhen={artifact.applicable_when}
                        />
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </DataState>
        </section>
      </PageSection>
    </div>
  );
}
