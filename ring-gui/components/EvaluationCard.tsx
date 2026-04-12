import type { Evaluation, QualityScores } from "@ring-gui/types/api";
import { formatPercent, titleize } from "@ring-gui/lib/format";
import { StatusBadge } from "@ring-gui/components/StatusBadge";

export function EvaluationCard({
  evaluation,
}: {
  evaluation: Evaluation | null;
}) {
  if (!evaluation) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h3>Evaluation</h3>
        </div>
        <p className="subtle">No evaluation artifact is linked to this session.</p>
      </section>
    );
  }

  const scoreEntries = Object.entries(evaluation.data.scores) as Array<
    [keyof QualityScores, number]
  >;
  const evidenceEntries = Object.entries(evaluation.data.evidence).filter(
    ([, value]) => value != null && value !== "",
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Evaluation</p>
          <h3>{evaluation.id}</h3>
        </div>
        <StatusBadge value={evaluation.data.outcome} />
      </div>

      <div className="metric-hero">
        <div>
          <p className="eyebrow">Composite Score</p>
          <strong className="hero-number">
            {formatPercent(evaluation.data.composite_score)}
          </strong>
        </div>
        <p className="subtle">
          Evaluated by {titleize(evaluation.data.evaluator)}.
        </p>
      </div>

      <div className="score-stack">
        {scoreEntries.map(([dimension, score]) => (
          <div key={dimension} className="score-row">
            <div className="score-row-header">
              <span>{titleize(dimension)}</span>
              <strong>{formatPercent(score)}</strong>
            </div>
            <div className="meter">
              <span style={{ width: `${score * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="detail-grid">
        {evidenceEntries.length > 0 ? (
          evidenceEntries.map(([key, value]) => (
            <div key={key} className="detail-item">
              <dt>{titleize(key)}</dt>
              <dd>{Array.isArray(value) ? value.join(", ") : String(value)}</dd>
            </div>
          ))
        ) : (
          <p className="subtle">No evaluation evidence recorded.</p>
        )}
      </div>
    </section>
  );
}
