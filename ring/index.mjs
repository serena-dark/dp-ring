/**
 * Ring — Protocol library for dp-ring's Adaptive Flywheel.
 *
 * Provides schema-validated, state-machine-enforced CRUD for all artifact
 * types, plus registry/leaderboard, evaluation helpers, gate control, and
 * knowledge queries.
 *
 * Usage:
 *   import { createRing } from './ring/index.mjs';
 *   const ring = await createRing('/absolute/path/to/repo');
 *
 *   // Create a task
 *   await ring.create('task', { id: 't2-new-feature', status: 'pending', data: {...}, created_by: 'agent-x' });
 *
 *   // Query distillations relevant to a task type
 *   const knowledge = await ring.knowledge('feature-implementation');
 *
 *   // Select the best workflow from the registry
 *   const pick = await ring.registry.select('feature-implementation');
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createValidator } from './lib/validator.mjs';
import { createStore } from './lib/store.mjs';
import { createRegistry } from './lib/registry.mjs';
import { createOrchestrator } from './lib/orchestrator.mjs';
import { createSessionRunner } from './lib/session-runner.mjs';
import { createTaskExecution } from './lib/task-execution.mjs';
import { createLoopbackRuntime } from './lib/loopback-runtime.mjs';
import { createUiConfig } from './lib/ui-config.mjs';
import { checkTransition, validNextStatuses, extractStateMachine } from './lib/state-machine.mjs';
import { computeComposite, buildEvaluation, computeEfficiency } from './lib/evaluator.mjs';
import { generateId } from './lib/id.mjs';
import { filterByField, filterByFieldIn, sortByField, relevantKnowledge, blockingFeedback } from './lib/query.mjs';
import { evaluateGate } from './lib/gate.mjs';

/**
 * Initialise a Ring instance rooted at a repository directory.
 *
 * @param {string} repoRoot   Absolute path to the repository root (parent of .ring/).
 * @returns {Promise<object>}  The Ring API object.
 */
export async function createRing(repoRoot) {
  const root = resolve(repoRoot);
  const ringDir = join(root, '.ring');

  // Load config
  const configRaw = await readFile(join(ringDir, 'config.json'), 'utf-8');
  const config = JSON.parse(configRaw);

  // Initialise sub-systems
  const validator = await createValidator(ringDir);
  const store     = createStore(ringDir, validator, config);
  const registry  = createRegistry(ringDir, config);
  const ui = await createUiConfig(root);

  // --- Public API ---

  /** Shorthand for store.create(). */
  async function create(type, fields) {
    return store.create(type, fields);
  }

  /** Shorthand for store.read(). */
  async function read(type, id) {
    return store.read(type, id);
  }

  /** Shorthand for store.update(). */
  async function update(type, id, patch) {
    return store.update(type, id, patch);
  }

  /** Shorthand for store.list(). */
  async function list(type) {
    return store.list(type);
  }

  /** Shorthand for store.query(). */
  async function query(type, filterFn) {
    return store.query(type, filterFn);
  }

  /**
   * Get relevant knowledge for a task type from published distillations.
   * @param {string} taskType
   * @param {number} [minConfidence]
   */
  async function knowledge(taskType, minConfidence) {
    const all = await store.list('distillation');
    return relevantKnowledge(all, taskType, minConfidence ?? config.evolution?.min_confidence_threshold);
  }

  /**
   * Evaluate gate for a milestone.
   * @param {string} milestoneId
   */
  async function checkGate(milestoneId) {
    const milestone = await store.read('milestone', milestoneId);
    const feedback = await store.list('feedback');
    return evaluateGate(milestone, store, feedback, config);
  }

  /**
   * Generate a new ID for an artifact type.
   * @param {string} type
   * @param {object} opts  { name, parentId?, index? }
   */
  async function newId(type, opts) {
    const existingIds = await store.listIds(type);
    return generateId(type, { ...opts, existingIds });
  }

  /**
   * Get the full session startup context that an agent needs.
   * Reads session → task → workflow template → distillations → feedback.
   *
   * @param {string} sessionId
   * @returns {Promise<object>}
   */
  async function sessionContext(sessionId) {
    const session = await store.read('session', sessionId);
    const tasks = await Promise.all(
      session.data.task_ids.map(id => store.read('task', id))
    );
    const workflowRuns = await Promise.all(
      session.data.workflow_run_ids.map(id => store.read('workflow-run', id))
    );

    // Load workflow templates used by runs
    const templateIds = [...new Set(workflowRuns.map(r => r.data.workflow_template_id))];
    const templates = await Promise.all(
      templateIds.map(id => store.read('workflow', id))
    );

    // Relevant knowledge
    const taskTypes = [...new Set(tasks.map(t => t.data.task_type))];
    const knowledgeItems = [];
    for (const tt of taskTypes) {
      knowledgeItems.push(...await knowledge(tt));
    }

    // Relevant feedback
    const requirementId = session.data.requirement_id;
    const allFeedback = await store.list('feedback');
    const blocking = blockingFeedback(allFeedback, requirementId);

    return {
      session,
      tasks,
      workflow_runs: workflowRuns,
      workflow_templates: templates,
      knowledge: knowledgeItems,
      blocking_feedback: blocking,
    };
  }

  const orchestrator = await createOrchestrator(root, {
    create,
    read,
    update,
    list,
    query,
    store,
    registry,
    newId,
    config,
    repoRoot: root,
    ringDir,
  });
  const taskExecution = createTaskExecution(
    root,
    {
      create,
      read,
      update,
      list,
      query,
      store,
      registry,
      newId,
    },
    () => orchestrator.getConfig(),
  );
  const sessionRunner = createSessionRunner(
    root,
    {
      create,
      read,
      update,
      list,
      query,
      store,
      registry,
      newId,
    },
    {
      orchestrator,
      taskExecution,
    },
  );
  const loopbackRuntime = createLoopbackRuntime(
    root,
    {
      create,
      read,
      update,
      list,
      query,
      store,
      registry,
      newId,
    },
    {
      orchestrator,
      sessionRunner,
      taskExecution,
    },
  );
  orchestrator.registerTickHook(() => sessionRunner.tick());
  orchestrator.registerTickHook(() => loopbackRuntime.tick());

  return {
    // Core CRUD
    create,
    read,
    update,
    list,
    query,

    // Direct store access
    store,

    // Registry / Leaderboard
    registry,
    ui,

    // Evaluation helpers
    evaluate: { computeComposite, buildEvaluation, computeEfficiency },

    // Gate control
    checkGate,

    // Knowledge
    knowledge,

    // Session context (agent startup)
    sessionContext,

    // Dispatch center / scheduler
    orchestrator,

    // Task-level completion / judgement
    taskExecution,

    // Session execution runner
    sessionRunner,

    // Local automation / loopback runtime
    loopbackRuntime,

    // ID generation
    newId,

    // Validation
    validator,

    // State machine
    stateMachine: { checkTransition, validNextStatuses, extractStateMachine },

    // Query utilities
    query_utils: { filterByField, filterByFieldIn, sortByField, relevantKnowledge, blockingFeedback },

    // Config
    config,
    ringDir,
    repoRoot: root,
  };
}
