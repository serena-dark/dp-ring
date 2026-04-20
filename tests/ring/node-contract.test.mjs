import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import {
  NODE_BOUNDARY_MODE,
  NODE_INTERFACE_VERSION,
  assertNodeContract,
  normalizeNodeContract,
  validateNodeContract,
} from '../../ring/lib/node-contract.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

function contractSchema(schema, description, options = {}) {
  const descriptor = {
    kind: 'json_schema',
    description,
    notes: options.notes ?? null,
  };

  return options.inline ? { ...schema, ...descriptor } : { ...descriptor, schema };
}

function createValidNodeContract() {
  return {
    id: 'n1-semantic-router',
    type: 'node',
    version: 1,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    created_by: 'test-agent',
    session_id: null,
    status: 'active',
    data: {
      node_type: 'semantic-router',
      interface_version: NODE_INTERFACE_VERSION,
      input_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
          },
        },
        'Tree-facing request payload.',
      ),
      output_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['decision'],
          properties: {
            decision: { type: 'string' },
            target_node_id: { type: ['string', 'null'] },
          },
        },
        'Stable response envelope returned to the tree.',
      ),
      evidence_schema: contractSchema(
        {
          type: 'object',
          additionalProperties: false,
          required: ['events'],
          properties: {
            events: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        'Evidence emitted at the node boundary.',
      ),
      capability_summary: {
        purpose: 'Route execution capsules through a stable node-facing interface.',
        responsibilities: [
          'Accept tree-facing input through the published contract.',
          'Emit output and evidence without exposing local implementation details.',
        ],
        limits: [
          'Does not expose internal subgraph state to the global tree.',
        ],
      },
      governance_profile: {
        owner: 'governance-kernel',
        decision_policy: 'contract-review',
        escalation_policy: 'manual',
        change_control: {
          requires_review: true,
          allows_internal_heterogeneity: true,
        },
      },
      checkpoint_policy: {
        strategy: 'on_decision',
        retention: 'rolling',
        evidence_binding: 'required',
        max_snapshots: 5,
      },
      runtime: {
        boundary_mode: 'contract_projection',
        tree_projection: 'contract_plus_summary',
        internals: {
          visibility: 'summarized',
          heterogeneous: true,
        },
        rag_profile: null,
      },
    },
  };
}

describe('node contract groundwork', async () => {
  const validator = await createValidator(ringDir);

  it('accepts a valid node contract', () => {
    const doc = createValidNodeContract();
    const schemaResult = validator.validate('node', doc);
    assert.equal(schemaResult.valid, true, JSON.stringify(schemaResult.errors));

    const helperResult = validateNodeContract(doc, { normalize: false });
    assert.equal(helperResult.valid, true, JSON.stringify(helperResult.errors));
    assert.deepEqual(assertNodeContract(doc, { normalize: false }), doc);
  });

  it('rejects missing critical fields', () => {
    const doc = createValidNodeContract();
    delete doc.data.node_type;

    const schemaResult = validator.validate('node', doc);
    assert.equal(schemaResult.valid, false);
    assert.ok(
      schemaResult.errors.some(
        (error) => error.keyword === 'required' && error.params?.missingProperty === 'node_type',
      ),
      JSON.stringify(schemaResult.errors),
    );

    assert.throws(
      () => assertNodeContract(doc, { normalize: false }),
      /node_type/,
    );
  });

  it('reports unexpected property names in assertion failures', () => {
    const doc = createValidNodeContract();
    doc.data.runtime.extra_debug = true;

    const helperResult = validateNodeContract(doc, { normalize: false });
    assert.equal(helperResult.valid, false);
    assert.ok(
      helperResult.errors.some(
        (error) =>
          error.keyword === 'additionalProperties' &&
          error.instancePath === '/data/runtime' &&
          error.params?.additionalProperty === 'extra_debug',
      ),
      JSON.stringify(helperResult.errors),
    );

    assert.throws(
      () => assertNodeContract(doc, { normalize: false }),
      /\/data\/runtime unexpected property extra_debug/,
    );
  });

  it('returns projection-friendly validation issues alongside raw Ajv errors', () => {
    const doc = createValidNodeContract();
    delete doc.data.node_type;

    const helperResult = validateNodeContract(doc, { normalize: false });
    assert.equal(helperResult.valid, false);
    assert.equal(Array.isArray(helperResult.issues), true);

    const issue = helperResult.issues.find((candidate) => candidate.keyword === 'required');
    assert.deepEqual(issue, {
      keyword: 'required',
      instancePath: '/data',
      schemaPath: '#/properties/data/required',
      instanceLocation: '/data',
      keywordLocation: '#/properties/data/required',
      params: { missingProperty: 'node_type' },
      propertyName: null,
      propertyFocus: 'node_type',
      message: "must have required property 'node_type'",
    });
  });

  it('attaches normalized validation context to assertion failures', () => {
    const doc = createValidNodeContract();
    delete doc.type;
    delete doc.version;
    delete doc.status;
    delete doc.session_id;
    delete doc.data.interface_version;
    doc.data.runtime = { extra_debug: true };

    assert.throws(
      () => assertNodeContract(doc),
      (error) => {
        assert.match(error.message, /\/data\/runtime unexpected property extra_debug/);
        assert.equal(error.validation?.valid, false);
        assert.equal(error.validation?.contract.type, 'node');
        assert.equal(error.validation?.contract.version, 1);
        assert.equal(error.validation?.contract.status, 'draft');
        assert.equal(error.validation?.contract.session_id, null);
        assert.equal(error.validation?.contract.data.interface_version, NODE_INTERFACE_VERSION);
        assert.equal(error.validation?.contract.data.runtime.boundary_mode, NODE_BOUNDARY_MODE);
        assert.equal(error.validation?.contract.data.runtime.tree_projection, 'external_contract_only');
        assert.equal(error.validation?.contract.data.runtime.internals.visibility, 'hidden');
        assert.equal(error.validation?.contract.data.runtime.internals.heterogeneous, true);
        assert.equal(error.validation?.contract.data.runtime.extra_debug, true);

        assert.deepEqual(error.validation?.issues, [
          {
            keyword: 'additionalProperties',
            instancePath: '/data/runtime',
            schemaPath: '#/properties/data/properties/runtime/additionalProperties',
            instanceLocation: '/data/runtime',
            keywordLocation: '#/properties/data/properties/runtime/additionalProperties',
            params: { additionalProperty: 'extra_debug' },
            propertyName: null,
            propertyFocus: 'extra_debug',
            message: 'must NOT have additional properties',
          },
        ]);
        return true;
      },
    );
  });

  it('normalizes compact input and applies runtime defaults', () => {
    const doc = createValidNodeContract();
    delete doc.type;
    delete doc.version;
    delete doc.status;
    delete doc.session_id;
    delete doc.data.interface_version;
    delete doc.data.runtime;
    doc.data.input_schema = doc.data.input_schema.schema;
    doc.data.output_schema = doc.data.output_schema.schema;
    doc.data.evidence_schema = doc.data.evidence_schema.schema;

    const normalized = normalizeNodeContract(doc);
    assert.equal(normalized.type, 'node');
    assert.equal(normalized.version, 1);
    assert.equal(normalized.status, 'draft');
    assert.equal(normalized.session_id, null);
    assert.equal(normalized.data.interface_version, NODE_INTERFACE_VERSION);
    assert.equal(normalized.data.runtime.boundary_mode, NODE_BOUNDARY_MODE);
    assert.equal(normalized.data.runtime.tree_projection, 'external_contract_only');
    assert.equal(normalized.data.runtime.internals.visibility, 'hidden');
    assert.equal(normalized.data.runtime.internals.heterogeneous, true);
    assert.equal(normalized.data.input_schema.kind, 'json_schema');
    assert.equal(normalized.data.output_schema.kind, 'json_schema');
    assert.equal(normalized.data.evidence_schema.kind, 'json_schema');

    const helperResult = validateNodeContract(doc);
    assert.equal(helperResult.valid, true, JSON.stringify(helperResult.errors));

    const schemaResult = validator.validate('node', normalized);
    assert.equal(schemaResult.valid, true, JSON.stringify(schemaResult.errors));
  });

  it('canonicalizes legacy inline schema descriptors during normalization', () => {
    const doc = createValidNodeContract();
    const inputSchema = doc.data.input_schema.schema;
    const outputSchema = doc.data.output_schema.schema;
    doc.data.input_schema = contractSchema(inputSchema, 'Tree-facing request payload.', { inline: true });
    doc.data.output_schema = {
      ...contractSchema(outputSchema, 'Stable response envelope returned to the tree.'),
      legacy_descriptor_version: 'v1-inline',
    };

    const normalized = normalizeNodeContract(doc);
    assert.deepEqual(normalized.data.input_schema, contractSchema(inputSchema, 'Tree-facing request payload.'));
    assert.deepEqual(
      normalized.data.output_schema,
      contractSchema(outputSchema, 'Stable response envelope returned to the tree.'),
    );

    const helperResult = validateNodeContract(doc);
    assert.equal(helperResult.valid, true, JSON.stringify(helperResult.errors));
    assert.deepEqual(helperResult.contract.data.input_schema, contractSchema(inputSchema, 'Tree-facing request payload.'));
    assert.deepEqual(
      helperResult.contract.data.output_schema,
      contractSchema(outputSchema, 'Stable response envelope returned to the tree.'),
    );
  });

  it('accepts RAG boundary metadata without adding retrieval behavior', () => {
    const doc = createValidNodeContract();
    doc.data.node_type = 'rag-query';
    doc.data.runtime.rag_profile = {
      mode: 'advisory',
      knowledge_scope: 'kb://product-specs',
      retrieval_boundary: 'metadata_only',
      citation_policy: 'required',
      freshness_policy: 'best_effort',
      index_ref: 'rag://product-specs',
    };

    const schemaResult = validator.validate('node', doc);
    assert.equal(schemaResult.valid, true, JSON.stringify(schemaResult.errors));

    const helperResult = validateNodeContract(doc, { normalize: false });
    assert.equal(helperResult.valid, true, JSON.stringify(helperResult.errors));
    assert.equal(helperResult.contract.data.runtime.rag_profile.retrieval_boundary, 'metadata_only');
  });
});
