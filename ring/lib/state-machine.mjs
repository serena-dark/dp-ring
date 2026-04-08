/**
 * State machine enforcement.
 * Reads the x-state-machine extension from JSON Schemas and validates
 * that a status transition is allowed.
 */

/**
 * Extract the state machine definition from a schema.
 * @param {object} schema  A JSON Schema with optional x-state-machine.
 * @returns {{ field: string, transitions: Record<string, string[]> } | null}
 */
export function extractStateMachine(schema) {
  return schema?.['x-state-machine'] ?? null;
}

/**
 * Check whether a status transition is allowed.
 * @param {object} schema      The full JSON Schema for the artifact type.
 * @param {string} fromStatus  Current status value.
 * @param {string} toStatus    Desired next status value.
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function checkTransition(schema, fromStatus, toStatus) {
  const sm = extractStateMachine(schema);
  if (!sm) {
    // No state machine defined → all transitions allowed (template-like types)
    return { allowed: true, reason: null };
  }

  if (fromStatus === toStatus) {
    return { allowed: true, reason: null };
  }

  const allowed = sm.transitions[fromStatus];
  if (!allowed) {
    return {
      allowed: false,
      reason: `Unknown source status "${fromStatus}" in state machine for field "${sm.field}".`,
    };
  }

  if (!allowed.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Transition "${fromStatus}" → "${toStatus}" is not allowed. Valid targets: [${allowed.join(', ')}].`,
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Get all valid next statuses from a given status.
 * @param {object} schema      The full JSON Schema.
 * @param {string} fromStatus  Current status.
 * @returns {string[]}
 */
export function validNextStatuses(schema, fromStatus) {
  const sm = extractStateMachine(schema);
  if (!sm) return [];
  return sm.transitions[fromStatus] ?? [];
}
