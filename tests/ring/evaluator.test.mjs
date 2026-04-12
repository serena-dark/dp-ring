import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeComposite, computeEfficiency, buildEvaluation } from '../../ring/lib/evaluator.mjs';

describe('evaluator', () => {

  describe('computeComposite()', () => {
    it('computes weighted average correctly', () => {
      const scores = { correctness: 1.0, completeness: 0.8, efficiency: 0.6, adherence: 1.0, reusability: 0.4 };
      const weights = { correctness: 0.30, completeness: 0.25, efficiency: 0.20, adherence: 0.15, reusability: 0.10 };
      const result = computeComposite(scores, weights);
      // Expected: (1*0.3 + 0.8*0.25 + 0.6*0.2 + 1*0.15 + 0.4*0.1) / 1.0 = 0.3+0.2+0.12+0.15+0.04 = 0.81
      assert.ok(Math.abs(result - 0.81) < 0.001, `Expected ~0.81 but got ${result}`);
    });

    it('handles missing dimensions gracefully', () => {
      const scores = { correctness: 1.0 };
      const weights = { correctness: 0.30, completeness: 0.25 };
      const result = computeComposite(scores, weights);
      // Only correctness counts: 1.0 * 0.30 / 0.30 = 1.0
      assert.equal(result, 1.0);
    });

    it('returns 0 when no weights match', () => {
      const result = computeComposite({}, { foo: 0.5 });
      assert.equal(result, 0);
    });
  });

  describe('computeEfficiency()', () => {
    it('returns 1.0 for zero resource usage', () => {
      const result = computeEfficiency({
        totalTokens: 0, wallClockSeconds: 0, retryCount: 0, humanInterventions: 0,
      });
      assert.equal(result, 1.0);
    });

    it('returns 0.0 for maximum resource usage', () => {
      const result = computeEfficiency({
        totalTokens: 500000, wallClockSeconds: 14400, retryCount: 10, humanInterventions: 10,
      });
      assert.equal(result, 0.0);
    });

    it('returns intermediate value for moderate usage', () => {
      const result = computeEfficiency({
        totalTokens: 250000, wallClockSeconds: 7200, retryCount: 5, humanInterventions: 5,
      });
      assert.equal(result, 0.5);
    });
  });

  describe('buildEvaluation()', () => {
    it('creates a valid evaluation artifact structure', () => {
      const ev = buildEvaluation({
        id: 'eval-test', sessionId: 's1-test', outcome: 'success',
        scores: { correctness: 0.9, completeness: 0.8, efficiency: 0.7, adherence: 1.0, reusability: 0.5 },
        scoreWeights: { correctness: 0.3, completeness: 0.25, efficiency: 0.2, adherence: 0.15, reusability: 0.1 },
        evidence: { tests_passed: 10, build_status: 'success' },
        evaluator: 'automated',
        createdBy: 'test',
        notes: 'Test evaluation',
      });

      assert.equal(ev.id, 'eval-test');
      assert.equal(ev.type, 'evaluation');
      assert.equal(ev.status, 'draft');
      assert.equal(ev.data.outcome, 'success');
      assert.ok(ev.data.composite_score > 0);
      assert.ok(ev.data.composite_score <= 1);
    });
  });
});
