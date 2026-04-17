import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { cpSync } from 'node:fs';
import { createValidator } from '../../ring/lib/validator.mjs';
import { createStore } from '../../ring/lib/store.mjs';

describe('store', async () => {
  let tempDir;
  let ringDir;
  let store;

  before(async () => {
    // Copy .ring schemas + config to a temp directory for isolation
    tempDir = await mkdtemp(join(tmpdir(), 'ring-test-'));
    ringDir = join(tempDir, '.ring');
    cpSync(resolve(import.meta.dirname, '../../.ring/schemas'), join(ringDir, 'schemas'), { recursive: true });
    cpSync(resolve(import.meta.dirname, '../../.ring/config.json'), join(ringDir, 'config.json'));

    // Create artifact directories
    const config = JSON.parse(await readFile(join(ringDir, 'config.json'), 'utf-8'));
    for (const sub of Object.values(config.artifact_directories)) {
      await mkdir(join(ringDir, sub), { recursive: true });
    }

    const validator = await createValidator(ringDir);
    store = createStore(ringDir, validator, config);
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('create()', () => {
    it('creates a valid requirement and writes to disk', async () => {
      const result = await store.create('requirement', {
        id: 'r1-store-test',
        status: 'draft',
        created_by: 'test',
        data: { name: 'Store Test', description: 'Testing store', acceptance_criteria: [], priority: 'low' },
      });
      assert.equal(result.ok, true);
      assert.equal(result.artifact.id, 'r1-store-test');
      assert.equal(result.artifact.version, 1);

      // Verify file exists
      const raw = await readFile(join(ringDir, 'requirements', 'r1-store-test.json'), 'utf-8');
      const onDisk = JSON.parse(raw);
      assert.equal(onDisk.id, 'r1-store-test');
    });

    it('rejects invalid data', async () => {
      const result = await store.create('requirement', {
        id: 'r2-bad',
        status: 'draft',
        created_by: 'test',
        data: { description: 'Missing name', acceptance_criteria: [], priority: 'low' },
      });
      assert.equal(result.ok, false);
      assert.ok(result.errors.length > 0);
    });
  });

  describe('read()', () => {
    it('reads back a created artifact', async () => {
      await store.create('task', {
        id: 't1-read-test',
        status: 'pending',
        created_by: 'test',
        data: {
          name: 'Read Test', description: 'Test read', task_type: 'testing',
          requirement_id: 'r1', milestone_id: 'm1', acceptance_criteria: [],
        },
      });
      const task = await store.read('task', 't1-read-test');
      assert.equal(task.id, 't1-read-test');
      assert.equal(task.data.name, 'Read Test');
    });

    it('creates and reads a node artifact through the configured store mapping', async () => {
      const result = await store.create('node', {
        id: 'n1-store-test',
        status: 'active',
        created_by: 'test',
        data: {
          node_type: 'semantic-router',
          interface_version: 'node.interface.v1',
          input_schema: {
            kind: 'json_schema',
            schema: { type: 'object', properties: { prompt: { type: 'string' } } },
            description: null,
            notes: null,
          },
          output_schema: {
            kind: 'json_schema',
            schema: { type: 'object', properties: { decision: { type: 'string' } } },
            description: null,
            notes: null,
          },
          evidence_schema: {
            kind: 'json_schema',
            schema: { type: 'object', properties: { events: { type: 'array' } } },
            description: null,
            notes: null,
          },
          capability_summary: {
            purpose: 'Store-level node smoke test',
            responsibilities: ['Accept input'],
            limits: ['No internal leakage'],
          },
          governance_profile: {
            owner: 'test',
            decision_policy: 'manual',
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
            max_snapshots: 2,
          },
          runtime: {
            boundary_mode: 'contract_projection',
            tree_projection: 'external_contract_only',
            internals: {
              visibility: 'hidden',
              heterogeneous: true,
            },
            rag_profile: null,
          },
        },
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors));
      const node = await store.read('node', 'n1-store-test');
      assert.equal(node.type, 'node');
      assert.equal(node.data.node_type, 'semantic-router');
    });

    it('creates and reads a checkpoint artifact through the configured store mapping', async () => {
      const result = await store.create('checkpoint', {
        id: 'cp-store-test',
        status: 'candidate',
        created_by: 'test',
        data: {
          parent_checkpoint_id: null,
          branch_id: 'main',
          node_id: 'n1-store-test',
          scope_ref: { kind: 'task', id: 't1-read-test', path: null },
          policy_snapshot: {
            workflow_tightness: 'balanced',
            oversight_strength: 'normal',
            branch_budget: null,
            notes: null,
          },
          execution_cursor: {
            phase: 'dispatch',
            step_id: 'dispatch-1',
            ordinal: 0,
          },
          evidence_refs: [],
          adoption_status: 'candidate',
          replay_state: {
            status: 'idle',
            cursor: null,
            replayable: true,
            last_replayed_at: null,
          },
          synthesis_inputs: [],
        },
      });
      assert.equal(result.ok, true, JSON.stringify(result.errors));
      const checkpoint = await store.read('checkpoint', 'cp-store-test');
      assert.equal(checkpoint.type, 'checkpoint');
      assert.equal(checkpoint.data.branch_id, 'main');
    });
  });

  describe('update()', () => {
    it('updates status with state machine enforcement', async () => {
      await store.create('task', {
        id: 't2-update-test',
        status: 'pending',
        created_by: 'test',
        data: {
          name: 'Update Test', description: 'Test update', task_type: 'testing',
          requirement_id: 'r1', milestone_id: 'm1', acceptance_criteria: [],
        },
      });

      // Valid transition: pending → ready
      const result = await store.update('task', 't2-update-test', { status: 'ready' });
      assert.equal(result.ok, true);
      assert.equal(result.artifact.status, 'ready');
      assert.equal(result.artifact.version, 2);
    });

    it('rejects invalid state transition', async () => {
      await store.create('task', {
        id: 't3-bad-transition',
        status: 'pending',
        created_by: 'test',
        data: {
          name: 'Bad Transition', description: 'Test', task_type: 'testing',
          requirement_id: 'r1', milestone_id: 'm1', acceptance_criteria: [],
        },
      });

      // Invalid: pending → completed (must go through ready, in_progress first)
      const result = await store.update('task', 't3-bad-transition', { status: 'completed' });
      assert.equal(result.ok, false);
      assert.ok(result.errors[0].message.includes('not allowed'));
    });
  });

  describe('list() and listIds()', () => {
    it('lists all artifacts of a type', async () => {
      const tasks = await store.list('task');
      assert.ok(tasks.length >= 1);
    });

    it('listIds returns just id strings', async () => {
      const ids = await store.listIds('task');
      assert.ok(ids.length >= 1);
      assert.ok(typeof ids[0] === 'string');
    });
  });

  describe('query()', () => {
    it('filters by predicate', async () => {
      const pending = await store.query('task', t => t.status === 'pending');
      for (const t of pending) {
        assert.equal(t.status, 'pending');
      }
    });
  });
});
