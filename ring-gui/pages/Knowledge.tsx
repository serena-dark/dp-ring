import { useDeferredValue, useState } from "react";
import { distillations, getKnowledge, tasks, workflows } from "@ring-gui/api/client";
import { DataState } from "@ring-gui/components/DataState";
import { StatusBadge } from "@ring-gui/components/StatusBadge";
import { formatPercent, titleize } from "@ring-gui/lib/format";
import { useApi } from "@ring-gui/hooks/useApi";

export default function Knowledge() {
  const [selectedContext, setSelectedContext] = useState("");
  const [minConfidence, setMinConfidence] = useState("0.3");
  const [searchTerm, setSearchTerm] = useState("");

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

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h3>Knowledge</h3>
        </div>
        <div className="search-row">
          <select
            value={activeContext}
            onChange={(event) => setSelectedContext(event.target.value)}
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
            onChange={(event) => setMinConfidence(event.target.value)}
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
              <div key={`${item.distillation_id}-${index}`} className="panel">
                <div className="badge-list">
                  <StatusBadge value={item.kind} />
                  <StatusBadge
                    value={
                      item.confidence >= 0.8
                        ? "high"
                        : item.confidence >= 0.5
                          ? "medium"
                          : "low"
                    }
                    kind="priority"
                  />
                </div>
                <h3>{item.summary}</h3>
                <p className="subtle">{item.applicable_when}</p>
                <p>Confidence {formatPercent(item.confidence)}</p>
              </div>
            ))}
          </div>
        </DataState>
      </section>

        <section className="panel">
          <div className="panel-header">
          <h3>Distillations</h3>
          <div className="search-row">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
                      <div key={`${artifact.kind}-${index}`} className="panel">
                        <div className="badge-list">
                          <StatusBadge value={artifact.kind} />
                          <StatusBadge
                            value={
                              artifact.confidence >= 0.8
                                ? "high"
                                : artifact.confidence >= 0.5
                                  ? "medium"
                                  : "low"
                            }
                            kind="priority"
                          />
                        </div>
                        <h3>{artifact.summary}</h3>
                        <p className="subtle">{artifact.context}</p>
                        <p>{artifact.applicable_when}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </DataState>
      </section>
    </div>
  );
}
