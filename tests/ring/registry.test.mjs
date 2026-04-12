import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRegistry } from '../../ring/lib/registry.mjs';

describe('registry', async () => {
  let tempDir;
  let config;
  let registry;

  before(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-registry-test-'));
    const ringDir = join(tempDir, '.ring');
    await mkdir(join(ringDir, 'registry'), { recursive: true });

    // Write initial empty leaderboard
    const board = { updated_at: '2026-04-08T00:00:00Z', rankings: {} };
    await writeFile(join(ringDir, 'registry', 'leaderboard.json'), JSON.stringify(board));

    config = { evolution: { explore_ratio: 0.15 } };
    registry = createRegistry(ringDir, config);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('recordScore() and rank()', () => {
    it('records a score and makes it retrievable', async () => {
      await registry.recordScore('feature-implementation', 'wf-tdd-first', 0.85);
      const ranked = await registry.rank('feature-implementation');
      assert.equal(ranked.length, 1);
      assert.equal(ranked[0].workflow_id, 'wf-tdd-first');
      assert.equal(ranked[0].avg_score, 0.85);
      assert.equal(ranked[0].usage_count, 1);
    });

    it('computes incremental average correctly', async () => {
      await registry.recordScore('feature-implementation', 'wf-tdd-first', 0.75);
      const ranked = await registry.rank('feature-implementation');
      const entry = ranked.find(r => r.workflow_id === 'wf-tdd-first');
      assert.equal(entry.usage_count, 2);
      assert.equal(entry.avg_score, 0.8); // (0.85 + 0.75) / 2
    });

    it('ranks multiple workflows by avg_score descending', async () => {
      await registry.recordScore('feature-implementation', 'wf-spike', 0.90);
      const ranked = await registry.rank('feature-implementation');
      assert.equal(ranked[0].workflow_id, 'wf-spike');  // 0.90 > 0.80
      assert.equal(ranked[1].workflow_id, 'wf-tdd-first');
    });
  });

  describe('select()', () => {
    it('returns top-ranked in exploit mode (most of the time)', async () => {
      // Run select many times; the majority should be exploit
      let exploitCount = 0;
      for (let i = 0; i < 50; i++) {
        const pick = await registry.select('feature-implementation');
        if (pick.mode === 'exploit') exploitCount++;
      }
      // With 15% explore, expect ~85% exploit → at least 30 out of 50
      assert.ok(exploitCount >= 25, `Expected mostly exploit but got ${exploitCount}/50`);
    });

    it('returns null for empty task type', async () => {
      const pick = await registry.select('nonexistent-type');
      assert.equal(pick, null);
    });
  });

  describe('getAll()', () => {
    it('returns the full leaderboard', async () => {
      const board = await registry.getAll();
      assert.ok(board.rankings);
      assert.ok(board.updated_at);
    });
  });
});
