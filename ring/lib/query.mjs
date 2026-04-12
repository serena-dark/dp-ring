/**
 * Query utilities for filtering and searching artifacts.
 */

/**
 * Filter artifacts by field value.
 * @param {object[]} artifacts
 * @param {string} field      Dot-path field (e.g. "status", "data.task_type", "data.severity").
 * @param {*} value           Value to match.
 * @returns {object[]}
 */
export function filterByField(artifacts, field, value) {
  return artifacts.filter(a => getNestedValue(a, field) === value);
}

/**
 * Filter artifacts where a field is one of the given values.
 * @param {object[]} artifacts
 * @param {string} field
 * @param {Array} values
 * @returns {object[]}
 */
export function filterByFieldIn(artifacts, field, values) {
  const set = new Set(values);
  return artifacts.filter(a => set.has(getNestedValue(a, field)));
}

/**
 * Sort artifacts by a field.
 * @param {object[]} artifacts
 * @param {string} field        Dot-path field.
 * @param {"asc"|"desc"} order
 * @returns {object[]}
 */
export function sortByField(artifacts, field, order = 'asc') {
  const sorted = [...artifacts].sort((a, b) => {
    const va = getNestedValue(a, field);
    const vb = getNestedValue(b, field);
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Get relevant distillations for a task type.
 * Returns published distillation artifacts whose items match the context,
 * sorted by confidence descending.
 *
 * @param {object[]} distillations  All distillation artifacts.
 * @param {string} taskType         The current task type.
 * @param {number} [minConfidence]  Minimum confidence threshold.
 * @returns {Array<{distillation_id: string, kind: string, summary: string, confidence: number, applicable_when: string}>}
 */
export function relevantKnowledge(distillations, taskType, minConfidence = 0.3) {
  const results = [];

  for (const dist of distillations) {
    if (dist.status !== 'published') continue;

    for (const item of dist.data.artifacts ?? []) {
      if (item.confidence < minConfidence) continue;
      // Match on context: exact match or wildcard "*"
      if (item.context !== taskType && item.context !== '*') continue;

      results.push({
        distillation_id: dist.id,
        kind:            item.kind,
        summary:         item.summary,
        confidence:      item.confidence,
        applicable_when: item.applicable_when,
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

/**
 * Get unresolved feedback blocking gate passage.
 * @param {object[]} feedbackItems  All feedback artifacts.
 * @param {string} [requirementId]  Optional: filter by target requirement.
 * @returns {{ critical: object[], major: object[] }}
 */
export function blockingFeedback(feedbackItems, requirementId) {
  const open = feedbackItems.filter(f =>
    f.status !== 'resolved' && f.status !== 'wont_fix'
  );

  const filtered = requirementId
    ? open.filter(f => f.data.target.id === requirementId)
    : open;

  return {
    critical: filtered.filter(f => f.data.severity === 'critical'),
    major:    filtered.filter(f => f.data.severity === 'major'),
  };
}

/** Resolve a dot-separated path on an object. */
function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}
