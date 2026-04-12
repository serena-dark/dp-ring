/**
 * File-based artifact store.
 * Each artifact is a JSON file in .ring/<directory>/<id>.json.
 * Provides create, read, update, list, and query operations with
 * schema validation and state machine enforcement on every write.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { checkTransition } from './state-machine.mjs';

/**
 * Create a Store instance.
 * @param {string} ringDir        Absolute path to .ring/
 * @param {object} validator      Validator from createValidator()
 * @param {object} config         Parsed .ring/config.json
 * @returns {object}
 */
export function createStore(ringDir, validator, config) {
  /**
   * Resolve the directory path for an artifact type.
   * @param {string} type
   * @returns {string}
   */
  function dirFor(type) {
    const sub = config.artifact_directories[type];
    if (!sub) throw new Error(`No directory mapping for artifact type: "${type}"`);
    return join(ringDir, sub);
  }

  /**
   * Read a single artifact by type and id.
   * @param {string} type
   * @param {string} id
   * @returns {Promise<object>}
   */
  async function read(type, id) {
    const filePath = join(dirFor(type), `${id}.json`);
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  /**
   * List all artifacts of a type.
   * @param {string} type
   * @returns {Promise<object[]>}
   */
  async function list(type) {
    const dir = dirFor(type);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }
    const results = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await readFile(join(dir, f), 'utf-8');
      results.push(JSON.parse(raw));
    }
    return results;
  }

  /**
   * List just the IDs of all artifacts of a type.
   * @param {string} type
   * @returns {Promise<string[]>}
   */
  async function listIds(type) {
    const dir = dirFor(type);
    let files;
    try {
      files = await readdir(dir);
    } catch {
      return [];
    }
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  }

  /**
   * Query artifacts by a filter function.
   * @param {string} type
   * @param {(artifact: object) => boolean} filterFn
   * @returns {Promise<object[]>}
   */
  async function query(type, filterFn) {
    const all = await list(type);
    return all.filter(filterFn);
  }

  /**
   * Write an artifact (create or update).
   * Validates against schema and enforces state machine transitions.
   *
   * @param {string} type
   * @param {object} artifact       Full artifact document.
   * @param {object} [opts]
   * @param {string} [opts.previousStatus]  If updating, the previous status for state machine check.
   * @returns {Promise<{ok: boolean, errors: Array|null}>}
   */
  async function write(type, artifact, opts = {}) {
    // 1. Schema validation
    const { valid, errors } = validator.validate(type, artifact);
    if (!valid) {
      return { ok: false, errors };
    }

    // 2. State machine check (if updating)
    if (opts.previousStatus != null && artifact.status !== opts.previousStatus) {
      const schema = validator.getSchema(type);
      if (schema) {
        const transition = checkTransition(schema, opts.previousStatus, artifact.status);
        if (!transition.allowed) {
          return { ok: false, errors: [{ message: transition.reason }] };
        }
      }
    }

    // 3. Write to file
    const dir = dirFor(type);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${artifact.id}.json`);
    await writeFile(filePath, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
    return { ok: true, errors: null };
  }

  /**
   * Create a new artifact. Convenience wrapper: sets version=1, timestamps, validates, writes.
   *
   * @param {string} type
   * @param {object} fields  { id, status, data, created_by, session_id? }
   * @returns {Promise<{ok: boolean, artifact: object|null, errors: Array|null}>}
   */
  async function create(type, fields) {
    const now = new Date().toISOString();
    const artifact = {
      id:         fields.id,
      type,
      version:    1,
      created_at: now,
      updated_at: now,
      created_by: fields.created_by ?? 'unknown',
      session_id: fields.session_id ?? null,
      status:     fields.status,
      data:       fields.data,
    };

    const result = await write(type, artifact);
    return result.ok
      ? { ok: true, artifact, errors: null }
      : { ok: false, artifact: null, errors: result.errors };
  }

  /**
   * Update an existing artifact. Bumps version, updates timestamp,
   * validates schema and state machine.
   *
   * @param {string} type
   * @param {string} id
   * @param {object} patch   Fields to merge into the artifact. Can include status and/or data changes.
   * @returns {Promise<{ok: boolean, artifact: object|null, errors: Array|null}>}
   */
  async function update(type, id, patch) {
    const existing = await read(type, id);
    const previousStatus = existing.status;

    const updated = {
      ...existing,
      ...patch,
      version:    existing.version + 1,
      updated_at: new Date().toISOString(),
    };

    // Deep-merge data if patch.data is provided
    if (patch.data) {
      updated.data = { ...existing.data, ...patch.data };
    }

    if (
      type === 'task' &&
      patch.status === 'completed' &&
      updated.data?.execution &&
      updated.data.execution.review_status !== 'approved'
    ) {
      return {
        ok: false,
        artifact: null,
        errors: [
          {
            message:
              'Tasks with an execution contract can only complete after the judge agent approves them.',
          },
        ],
      };
    }

    const result = await write(type, updated, { previousStatus });
    return result.ok
      ? { ok: true, artifact: updated, errors: null }
      : { ok: false, artifact: null, errors: result.errors };
  }

  return { read, list, listIds, query, write, create, update, dirFor };
}
