/**
 * Evaluation helpers.
 * Computes composite scores from dimension scores + weights,
 * and provides helpers for building evaluation records.
 */

/**
 * Compute a weighted composite score.
 * @param {Record<string, number>} scores      Dimension scores, each [0, 1].
 * @param {Record<string, number>} weights     Dimension weights, each [0, 1], should sum to ~1.
 * @returns {number}  Composite score [0, 1].
 */
export function computeComposite(scores, weights) {
  const dimensions = Object.keys(weights);
  let total = 0;
  let weightSum = 0;

  for (const dim of dimensions) {
    const s = scores[dim];
    const w = weights[dim];
    if (s == null || w == null) continue;
    total += s * w;
    weightSum += w;
  }

  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * Build a draft evaluation record skeleton.
 * Human or automated evaluator fills in the scores.
 *
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} opts.sessionId
 * @param {"success"|"failure"|"partial"} opts.outcome
 * @param {Record<string, number>} opts.scores        Dimension scores.
 * @param {Record<string, number>} opts.scoreWeights  From config.
 * @param {object} opts.evidence                      Evidence data.
 * @param {"automated"|"human"|"hybrid"} opts.evaluator
 * @param {string} opts.createdBy
 * @param {string} [opts.notes]
 * @returns {object}  A full evaluation artifact ready for store.create().
 */
export function buildEvaluation(opts) {
  const composite = computeComposite(opts.scores, opts.scoreWeights);
  const now = new Date().toISOString();

  return {
    id:         opts.id,
    type:       'evaluation',
    version:    1,
    created_at: now,
    updated_at: now,
    created_by: opts.createdBy,
    session_id: opts.sessionId,
    status:     'draft',
    data: {
      session_id:    opts.sessionId,
      outcome:       opts.outcome,
      scores:        opts.scores,
      composite_score: composite,
      score_weights: opts.scoreWeights,
      evidence:      opts.evidence,
      evaluator:     opts.evaluator,
      notes:         opts.notes ?? null,
    },
  };
}

/**
 * Compute efficiency score from raw metrics.
 * Lower resource usage = higher efficiency.
 *
 * @param {object} metrics
 * @param {number} metrics.totalTokens
 * @param {number} metrics.wallClockSeconds
 * @param {number} metrics.retryCount
 * @param {number} metrics.humanInterventions
 * @param {object} [baselines]  Expected maximums for normalization.
 * @returns {number}  Efficiency score [0, 1].
 */
export function computeEfficiency(metrics, baselines = {}) {
  const maxTokens     = baselines.maxTokens        ?? 500000;
  const maxTime       = baselines.maxWallClock      ?? 14400; // 4 hours
  const maxRetries    = baselines.maxRetries        ?? 10;
  const maxHuman      = baselines.maxHumanInterventions ?? 10;

  const tokenScore   = 1 - Math.min(metrics.totalTokens / maxTokens, 1);
  const timeScore    = 1 - Math.min(metrics.wallClockSeconds / maxTime, 1);
  const retryScore   = 1 - Math.min(metrics.retryCount / maxRetries, 1);
  const humanScore   = 1 - Math.min(metrics.humanInterventions / maxHuman, 1);

  // Equal weight across sub-dimensions
  return (tokenScore + timeScore + retryScore + humanScore) / 4;
}
