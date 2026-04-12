/**
 * Registry / Leaderboard management.
 * Reads .ring/registry/leaderboard.json, provides ranking queries and updates.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Create a Registry instance.
 * @param {string} ringDir  Absolute path to .ring/
 * @param {object} config   Parsed .ring/config.json
 * @returns {object}
 */
export function createRegistry(ringDir, config) {
  const filePath = join(ringDir, 'registry', 'leaderboard.json');

  /** Read the leaderboard file. */
  async function load() {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  /** Write the leaderboard file. */
  async function save(board) {
    board.updated_at = new Date().toISOString();
    await writeFile(filePath, JSON.stringify(board, null, 2) + '\n', 'utf-8');
  }

  /**
   * Get ranked workflows for a task type.
   * @param {string} taskType
   * @returns {Promise<Array<{workflow_id: string, avg_score: number, usage_count: number, last_used: string}>>}
   */
  async function rank(taskType) {
    const board = await load();
    return board.rankings[taskType] ?? [];
  }

  /**
   * Select the best workflow for a task type, with explore-exploit.
   * @param {string} taskType
   * @returns {Promise<{workflow_id: string, rank: number, mode: "exploit"|"explore"}|null>}
   */
  async function select(taskType) {
    const ranked = await rank(taskType);
    if (ranked.length === 0) return null;

    const exploreRatio = config.evolution?.explore_ratio ?? 0.15;
    const shouldExplore = Math.random() < exploreRatio && ranked.length > 1;

    if (shouldExplore) {
      // Pick a random non-top entry
      const idx = 1 + Math.floor(Math.random() * (ranked.length - 1));
      return { workflow_id: ranked[idx].workflow_id, rank: idx + 1, mode: 'explore' };
    }

    return { workflow_id: ranked[0].workflow_id, rank: 1, mode: 'exploit' };
  }

  /**
   * Record a score for a workflow under a task type and re-rank.
   *
   * @param {string} taskType
   * @param {string} workflowId
   * @param {number} compositeScore   [0, 1]
   * @returns {Promise<void>}
   */
  async function recordScore(taskType, workflowId, compositeScore) {
    const board = await load();

    if (!board.rankings[taskType]) {
      board.rankings[taskType] = [];
    }

    const rankings = board.rankings[taskType];
    let entry = rankings.find(e => e.workflow_id === workflowId);

    if (!entry) {
      entry = { workflow_id: workflowId, avg_score: 0, usage_count: 0, last_used: '' };
      rankings.push(entry);
    }

    // Incremental average
    const total = entry.avg_score * entry.usage_count + compositeScore;
    entry.usage_count += 1;
    entry.avg_score = total / entry.usage_count;
    entry.last_used = new Date().toISOString();

    // Sort descending by avg_score
    board.rankings[taskType] = rankings.sort((a, b) => b.avg_score - a.avg_score);

    await save(board);
  }

  /**
   * Get the full leaderboard object.
   * @returns {Promise<object>}
   */
  async function getAll() {
    return load();
  }

  return { rank, select, recordScore, getAll };
}
