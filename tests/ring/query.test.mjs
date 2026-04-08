import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterByField, filterByFieldIn, sortByField, relevantKnowledge, blockingFeedback } from '../../ring/lib/query.mjs';

describe('query utilities', () => {

  const artifacts = [
    { id: '1', status: 'open', data: { severity: 'critical', value: 10 } },
    { id: '2', status: 'closed', data: { severity: 'minor', value: 30 } },
    { id: '3', status: 'open', data: { severity: 'major', value: 20 } },
  ];

  describe('filterByField()', () => {
    it('filters by top-level field', () => {
      const result = filterByField(artifacts, 'status', 'open');
      assert.equal(result.length, 2);
    });

    it('filters by nested field', () => {
      const result = filterByField(artifacts, 'data.severity', 'critical');
      assert.equal(result.length, 1);
      assert.equal(result[0].id, '1');
    });
  });

  describe('filterByFieldIn()', () => {
    it('filters by multiple values', () => {
      const result = filterByFieldIn(artifacts, 'data.severity', ['critical', 'major']);
      assert.equal(result.length, 2);
    });
  });

  describe('sortByField()', () => {
    it('sorts ascending by nested numeric', () => {
      const sorted = sortByField(artifacts, 'data.value', 'asc');
      assert.equal(sorted[0].data.value, 10);
      assert.equal(sorted[2].data.value, 30);
    });

    it('sorts descending', () => {
      const sorted = sortByField(artifacts, 'data.value', 'desc');
      assert.equal(sorted[0].data.value, 30);
    });
  });

  describe('relevantKnowledge()', () => {
    const distillations = [
      {
        id: 'dist-1', status: 'published',
        data: { artifacts: [
          { kind: 'lesson', summary: 'Use strict mode', context: 'feature-implementation', applicable_when: 'Always', confidence: 0.9, source_sessions: ['s1'] },
          { kind: 'anti-pattern', summary: 'Avoid global state', context: 'feature-implementation', applicable_when: 'React apps', confidence: 0.5, source_sessions: ['s1'] },
          { kind: 'lesson', summary: 'Low confidence item', context: 'feature-implementation', applicable_when: 'Rarely', confidence: 0.1, source_sessions: ['s1'] },
        ] },
      },
      {
        id: 'dist-2', status: 'draft',  // Should be excluded
        data: { artifacts: [
          { kind: 'lesson', summary: 'Draft only', context: 'feature-implementation', applicable_when: 'Never', confidence: 1.0, source_sessions: ['s2'] },
        ] },
      },
      {
        id: 'dist-3', status: 'published',
        data: { artifacts: [
          { kind: 'pattern', summary: 'Wildcard match', context: '*', applicable_when: 'Everywhere', confidence: 0.8, source_sessions: ['s3'] },
        ] },
      },
    ];

    it('returns published items matching task type, sorted by confidence', () => {
      const result = relevantKnowledge(distillations, 'feature-implementation', 0.3);
      assert.equal(result.length, 3); // 0.9, 0.8 (wildcard), 0.5 — excludes 0.1 (below threshold) and draft
      assert.equal(result[0].confidence, 0.9);
      assert.equal(result[1].confidence, 0.8);
      assert.equal(result[2].confidence, 0.5);
    });

    it('excludes items below min confidence', () => {
      const result = relevantKnowledge(distillations, 'feature-implementation', 0.6);
      assert.equal(result.length, 2);
    });

    it('returns empty for unmatched task type', () => {
      const result = relevantKnowledge(distillations, 'infrastructure', 0.3);
      // Only wildcard matches
      assert.equal(result.length, 1);
      assert.equal(result[0].summary, 'Wildcard match');
    });
  });

  describe('blockingFeedback()', () => {
    const feedback = [
      { id: 'fb-1', status: 'open', data: { severity: 'critical', target: { type: 'requirement', id: 'r1' } } },
      { id: 'fb-2', status: 'acknowledged', data: { severity: 'major', target: { type: 'requirement', id: 'r1' } } },
      { id: 'fb-3', status: 'open', data: { severity: 'major', target: { type: 'requirement', id: 'r2' } } },
      { id: 'fb-4', status: 'resolved', data: { severity: 'critical', target: { type: 'requirement', id: 'r1' } } },
    ];

    it('finds critical and major blocking feedback for a requirement', () => {
      const result = blockingFeedback(feedback, 'r1');
      assert.equal(result.critical.length, 1);
      assert.equal(result.major.length, 1); // acknowledged major counts
    });

    it('excludes resolved items', () => {
      const result = blockingFeedback(feedback, 'r1');
      // fb-4 is resolved, should not appear
      assert.ok(!result.critical.find(f => f.id === 'fb-4'));
    });
  });
});
