import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';

export const NODE_INTERFACE_VERSION = 'node.interface.v1';
export const NODE_BOUNDARY_MODE = 'contract_projection';

const NODE_SCHEMA_URL = new URL('../../.ring/schemas/node.schema.json', import.meta.url);
export const NODE_SCHEMA = JSON.parse(readFileSync(NODE_SCHEMA_URL, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
addFormats(ajv);
const validateSchema = ajv.compile(NODE_SCHEMA);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeChoice(value, fallback) {
  if (value == null) return fallback;
  const normalized = typeof value === 'string' ? value.trim() : value;
  return normalized === '' ? fallback : normalized;
}

const SCHEMA_DESCRIPTOR_FIELDS = new Set(['kind', 'schema', 'description', 'notes']);

function buildSchemaDescriptor(schema, metadata = {}) {
  return {
    kind: 'json_schema',
    schema,
    description: metadata.description ?? null,
    notes: metadata.notes ?? null,
  };
}

function stripSchemaDescriptorFields(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !SCHEMA_DESCRIPTOR_FIELDS.has(key)),
  );
}

function normalizeSchemaDescriptor(value) {
  if (!isObject(value)) return value;
  if ('schema' in value) {
    return buildSchemaDescriptor(value.schema, value);
  }
  if ('kind' in value) {
    return buildSchemaDescriptor(stripSchemaDescriptorFields(value), value);
  }

  return buildSchemaDescriptor(value);
}

function normalizeRagProfile(value) {
  if (!isObject(value)) return value;
  return {
    ...value,
    mode: normalizeChoice(value.mode, 'advisory'),
    retrieval_boundary: normalizeChoice(value.retrieval_boundary, 'metadata_only'),
    citation_policy: normalizeChoice(value.citation_policy, 'optional'),
    freshness_policy: normalizeString(value.freshness_policy, 'best_effort'),
    index_ref: value.index_ref ?? null,
  };
}

function normalizeRuntime(value) {
  const runtime = isObject(value) ? value : {};
  const internals = isObject(runtime.internals) ? runtime.internals : {};

  return {
    ...runtime,
    boundary_mode: normalizeChoice(runtime.boundary_mode, NODE_BOUNDARY_MODE),
    tree_projection: normalizeChoice(runtime.tree_projection, 'external_contract_only'),
    internals: {
      ...internals,
      visibility: normalizeChoice(internals.visibility, 'hidden'),
      heterogeneous:
        typeof internals.heterogeneous === 'boolean' ? internals.heterogeneous : internals.heterogeneous ?? true,
    },
    rag_profile: runtime.rag_profile == null ? null : normalizeRagProfile(runtime.rag_profile),
  };
}

export function normalizeNodeContract(value = {}) {
  const input = isObject(value) ? value : {};
  const data = isObject(input.data) ? input.data : {};

  return {
    ...input,
    type: 'node',
    version: input.version == null ? 1 : input.version,
    status: normalizeString(input.status, 'draft'),
    session_id: input.session_id ?? null,
    data: {
      ...data,
      interface_version: normalizeString(data.interface_version, NODE_INTERFACE_VERSION),
      input_schema:
        data.input_schema == null ? data.input_schema : normalizeSchemaDescriptor(data.input_schema),
      output_schema:
        data.output_schema == null ? data.output_schema : normalizeSchemaDescriptor(data.output_schema),
      evidence_schema:
        data.evidence_schema == null ? data.evidence_schema : normalizeSchemaDescriptor(data.evidence_schema),
      runtime: normalizeRuntime(data.runtime),
    },
  };
}

export function validateNodeContract(value, options = {}) {
  const candidate = options.normalize === false ? value : normalizeNodeContract(value);
  const valid = validateSchema(candidate);
  const errors = valid ? null : (validateSchema.errors ?? []).map((error) => cloneValidationError(error));
  return {
    valid,
    errors,
    issues: errors?.map((error) => createValidationIssue(error)) ?? [],
    contract: candidate,
  };
}

function cloneValidationError(error) {
  return {
    ...error,
    params: isObject(error.params) ? { ...error.params } : error.params,
  };
}

function propertyFocusForValidationError(error) {
  return error.propertyName ?? error.params?.missingProperty ?? error.params?.additionalProperty ?? null;
}

function createValidationIssue(error) {
  return {
    keyword: error.keyword,
    instancePath: error.instancePath ?? '',
    schemaPath: error.schemaPath ?? null,
    instanceLocation: error.instancePath || '/',
    keywordLocation: error.schemaPath ?? '#',
    params: isObject(error.params) ? { ...error.params } : {},
    propertyName: error.propertyName ?? null,
    propertyFocus: propertyFocusForValidationError(error),
    message: error.message ?? null,
  };
}

function formatValidationError(error) {
  const path = error.instancePath || '/';
  if (error.keyword === 'required' && error.params?.missingProperty) {
    return `${path} missing ${error.params.missingProperty}`;
  }
  if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
    return `${path} unexpected property ${error.params.additionalProperty}`;
  }
  return `${path} ${error.message}`;
}

export function assertNodeContract(value, options = {}) {
  const result = validateNodeContract(value, options);
  if (result.valid) return result.contract;

  const detail = result.errors.map((error) => formatValidationError(error)).join('; ');
  const failure = new Error(`Node contract validation failed: ${detail}`);
  failure.validation = result;
  throw failure;
}
