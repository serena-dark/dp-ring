/**
 * Programmatic gate evaluation.
 * Checks whether all prerequisites in a milestone are satisfied,
 * and whether blocking feedback exists.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/**
 * Evaluate a single prerequisite.
 * @param {object} prereq      A prerequisite object from milestone.data.prerequisites.
 * @param {object} store       The ring store (for reference checks).
 * @returns {Promise<{id: string, satisfied: boolean, detail: string}>}
 */
export async function evaluatePrerequisite(prereq, store) {
  switch (prereq.check_type) {
    case 'automated':
      return evaluateAutomated(prereq);
    case 'reference':
      return evaluateReference(prereq, store);
    case 'human':
      // Human prerequisites are checked via their stored status (manually set).
      return {
        id: prereq.id,
        satisfied: prereq.status === 'satisfied',
        detail: prereq.status === 'satisfied'
          ? 'Human approval granted.'
          : 'Awaiting human approval.',
      };
    default:
      return { id: prereq.id, satisfied: false, detail: `Unknown check_type: "${prereq.check_type}"` };
  }
}

/**
 * Run an automated command check.
 * @param {object} prereq
 * @returns {Promise<{id: string, satisfied: boolean, detail: string}>}
 */
async function evaluateAutomated(prereq) {
  const { command, expect_exit_code } = prereq.check ?? {};
  if (!command) {
    return { id: prereq.id, satisfied: false, detail: 'No command specified.' };
  }

  try {
    const parts = command.split(/\s+/);
    const result = await exec(parts[0], parts.slice(1), { timeout: 120_000 });
    return {
      id: prereq.id,
      satisfied: true,
      detail: `Command succeeded (exit 0). stdout: ${(result.stdout ?? '').slice(0, 200)}`,
    };
  } catch (err) {
    const exitCode = err.code ?? err.status ?? 1;
    const expected = expect_exit_code ?? 0;
    return {
      id: prereq.id,
      satisfied: exitCode === expected,
      detail: `Command exited with ${exitCode}. Expected ${expected}. stderr: ${(err.stderr ?? '').slice(0, 200)}`,
    };
  }
}

/**
 * Check a reference to another artifact's field value.
 * @param {object} prereq
 * @param {object} store
 * @returns {Promise<{id: string, satisfied: boolean, detail: string}>}
 */
async function evaluateReference(prereq, store) {
  const { artifact_type, artifact_id, field, equals } = prereq.check ?? {};
  if (!artifact_type || !artifact_id || !field) {
    return { id: prereq.id, satisfied: false, detail: 'Incomplete reference check definition.' };
  }

  try {
    const target = await store.read(artifact_type, artifact_id);
    const actual = field.split('.').reduce((o, k) => o?.[k], target);
    const satisfied = actual === equals;
    return {
      id: prereq.id,
      satisfied,
      detail: satisfied
        ? `${artifact_type}/${artifact_id}.${field} === "${equals}".`
        : `${artifact_type}/${artifact_id}.${field} is "${actual}", expected "${equals}".`,
    };
  } catch (err) {
    return { id: prereq.id, satisfied: false, detail: `Failed to read artifact: ${err.message}` };
  }
}

/**
 * Evaluate all prerequisites in a milestone and return a gate verdict.
 *
 * @param {object} milestone    A milestone artifact.
 * @param {object} store        The ring store.
 * @param {object[]} feedbackItems  All feedback artifacts (for blocking check).
 * @param {object} config       Parsed .ring/config.json
 * @returns {Promise<{passed: boolean, results: Array, blocking_feedback: object}>}
 */
export async function evaluateGate(milestone, store, feedbackItems, config) {
  const prereqs = milestone.data.prerequisites ?? [];
  const results = await Promise.all(
    prereqs.map(p => evaluatePrerequisite(p, store))
  );

  const allSatisfied = results.every(r => r.satisfied);

  // Check blocking feedback
  const open = feedbackItems.filter(f =>
    f.status !== 'resolved' && f.status !== 'wont_fix' &&
    f.data.target.id === milestone.data.requirement_id
  );
  const criticals = open.filter(f => f.data.severity === 'critical');
  const majorsUnacked = open.filter(f =>
    f.data.severity === 'major' && f.status === 'open'
  );

  const blockedByFeedback =
    (config.gate_control?.block_on_critical_feedback && criticals.length > 0) ||
    (config.gate_control?.require_ack_on_major_feedback && majorsUnacked.length > 0);

  return {
    passed: allSatisfied && !blockedByFeedback,
    results,
    blocking_feedback: {
      critical: criticals,
      major_unacknowledged: majorsUnacked,
    },
  };
}
