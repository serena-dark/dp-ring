/**
 * Schema validation using Ajv.
 * Loads all schemas from .ring/schemas/, compiles them, and exposes
 * a validate(type, data) function that returns {valid, errors}.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Build a Validator bound to a .ring root directory.
 * @param {string} ringDir  Absolute path to .ring/
 * @returns {Promise<{validate: Function, getSchema: Function}>}
 */
export async function createValidator(ringDir) {
  const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
  addFormats(ajv);

  const schemaDir = join(ringDir, 'schemas');
  const files = await readdir(schemaDir);
  const schemaMap = new Map();

  for (const file of files) {
    if (!file.endsWith('.schema.json')) continue;
    const raw = await readFile(join(schemaDir, file), 'utf-8');
    const schema = JSON.parse(raw);

    // Derive type name from filename: "workflow-run.schema.json" → "workflow-run"
    const typeName = file.replace('.schema.json', '');
    if (!typeName) continue;

    ajv.addSchema(schema, schema.$id);
    schemaMap.set(typeName, schema.$id);
  }

  /**
   * Validate a document against its type schema.
   * @param {string} type  Artifact type (e.g. "session", "task", "workflow-run")
   * @param {object} data  The full artifact document.
   * @returns {{ valid: boolean, errors: Array|null }}
   */
  function validate(type, data) {
    const normalised = type.toLowerCase().replace(/\s+/g, '-');
    let schemaId = schemaMap.get(normalised);
    if (!schemaId) {
      return { valid: false, errors: [{ message: `Unknown artifact type: "${type}"` }] };
    }

    const check = ajv.getSchema(schemaId);
    if (!check) {
      return { valid: false, errors: [{ message: `Schema not compiled for type: "${type}"` }] };
    }

    const valid = check(data);
    return { valid, errors: valid ? null : [...check.errors] };
  }

  /**
   * Get the raw schema for a type.
   * @param {string} type
   * @returns {object|null}
   */
  function getSchema(type) {
    const normalised = type.toLowerCase().replace(/\s+/g, '-');
    let schemaId = schemaMap.get(normalised);
    if (!schemaId) return null;
    const fn = ajv.getSchema(schemaId);
    return fn?.schema ?? null;
  }

  return { validate, getSchema };
}
