import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createValidator } from '../../ring/lib/validator.mjs';
import { createEmptyCapsuleState } from '../../ring/lib/node-capsule.mjs';
import { createBranchCommitStatement, createGovernanceStatement } from '../../ring/lib/governance-statement.mjs';

const ringDir = resolve(import.meta.dirname, '../../.ring');

function buildPublicationRootDoc() {
  return {
    _type: 'https://dp-ring.dev/schemas/publication-root/v1',
    id: 'pr-1-test',
    conforms_to: 'https://dp-ring.dev/publication-root/v1',
    status: 'published',
    about: {
      name: 'checkpoint-publication/cp-root',
      mediaType: 'application/vnd.dp-ring.governance-statement+json',
      digest: `sha256:${'a'.repeat(64)}`,
      size: 256,
      locator: { kind: 'checkpoint', id: 'cp-root' },
    },
    member_descriptors: [
      {
        name: 'member/checkpoint-publication',
        mediaType: 'application/vnd.dp-ring.governance-statement+json',
        digest: `sha256:${'b'.repeat(64)}`,
        size: 512,
        locator: { kind: 'governance-statement', id: 'gs-1-test' },
        artifact_type: 'governance-statement',
      },
    ],
    membership_digest: `sha256:${'c'.repeat(64)}`,
  };
}

function buildValidationResultDoc() {
  return {
    id: 'vres-1-test',
    type: 'validation-result',
    version: 1,
    created_at: '2026-04-20T00:00:00Z',
    updated_at: '2026-04-20T00:00:00Z',
    created_by: 'validator-test',
    session_id: 's1-test',
    status: 'recorded',
    data: {
      report_id: 'vrpt-1-test',
      subject_ref: {
        type: 'checkpoint',
        id: 'cp-root',
      },
      subject_location: '/data/publication_statements/0',
      rule_id: 'checkpoint-publication-shape',
      rule_location: '#/properties/data/required/6',
      severity: 'violation',
      message: 'publication_statements entry is missing a required field.',
      detail_result_ids: [],
    },
  };
}

function buildValidationReportDoc() {
  return {
    id: 'vrpt-1-test',
    type: 'validation-report',
    version: 1,
    created_at: '2026-04-20T00:00:01Z',
    updated_at: '2026-04-20T00:00:01Z',
    created_by: 'validator-test',
    session_id: 's1-test',
    status: 'recorded',
    data: {
      subject_ref: {
        type: 'checkpoint',
        id: 'cp-root',
      },
      profile_id: 'checkpoint-publication-profile-v1',
      report_level: 'basic',
      conforms: false,
      outcome: 'blocking',
      result_ids: ['vres-1-test'],
      summary: {
        info: 0,
        warning: 0,
        violation: 1,
      },
    },
  };
}

function buildTaskReplanPacket() {
  return {
    agent_id: 'task-replanner',
    subject: 'Replan task',
    body: 'Decide whether this task should be redispatched.',
    dispatched_at: '2026-04-08T00:00:00Z',
  };
}

function buildTaskDoc() {
  return {
    id: 't1-test',
    type: 'task',
    version: 1,
    created_at: '2026-04-08T00:00:00Z',
    updated_at: '2026-04-08T00:00:00Z',
    created_by: 'test',
    session_id: null,
    status: 'pending',
    data: {
      name: 'Test Task',
      description: 'A test',
      task_type: 'feature-implementation',
      requirement_id: 'r1-test',
      milestone_id: 'r1m1-test',
      scope: {
        target_type: 'module',
        target_path: 'ring-gui/components',
        repo_root: '.',
        file_paths: ['ring-gui/components/Layout.tsx'],
      },
      execution: {
        judge_agent_id: null,
        review_status: 'pending',
        completion_commit_sha: null,
        changed_files: [],
        scope_match: null,
        build_required: true,
        build_command: 'npm run build',
        build_status: 'pending',
        cleanup_paths: ['tmp/task'],
        cleanup_status: 'pending',
        merge_status: 'blocked',
        summary_path: null,
        review_packet: null,
        failure_feedback_id: null,
        failure_distillation_id: null,
        completion_distillation_id: null,
        last_error: null,
        checked_at: null,
        reviewed_at: null,
        note: null,
      },
      replanning: {
        replanner_agent_id: 'task-replanner',
        status: 'pending',
        source_failure: null,
        packet: null,
        successor_task_id: null,
        parent_task_id: null,
        decision_note: null,
        reviewed_at: null,
      },
      acceptance_criteria: [{ id: 'ac1', description: 'It works', satisfied: false }],
    },
  };
}

function buildWorkflowRunDoc() {
  return {
    id: 'run-1-test',
    type: 'workflow-run',
    version: 1,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:30Z',
    created_by: 'session-runner',
    session_id: 's1-test',
    status: 'running',
    data: {
      workflow_template_id: 'wf-1-test',
      workflow_template_version: 1,
      task_id: 't1-test',
      current_step_index: 0,
      callback: {
        auth_scheme: 'bearer',
        report_url: 'http://127.0.0.1:3100/api/workflow-run/run-1-test/report',
        token: 'token-123',
        signing_secret: 'signing-secret',
        signature_algorithm: 'hmac-sha256',
        key_version: 1,
        status: 'active',
        issued_at: '2026-04-17T00:00:00Z',
        prepared_at: '2026-04-17T00:00:05Z',
        last_report_at: '2026-04-17T00:00:30Z',
        last_retry_at: null,
        last_rotated_at: null,
        next_retry_at: null,
        report_timeout_ms: 300000,
        max_retries: 3,
        retry_count: 0,
        retry_backoff_ms: 1000,
        signature_ttl_ms: 60000,
        timeout_at: '2026-04-17T00:05:00Z',
        packet_path: '.ring/orchestrator/runner/sessions/s1-test/run-1-test.json',
        allowed_worker_ids: ['worker-1'],
        accepted_protocols: ['ring.workflow-run-report.v1', 'a2a.task-status.v1'],
        last_worker_id: 'worker-1',
        last_protocol: 'ring.workflow-run-report.v1',
        last_error: null,
      },
      reports: [
        {
          at: '2026-04-17T00:00:30Z',
          status: 'running',
          actor: 'worker-1',
          step_id: 'execute',
          note: 'Checkpointed the execution capsule.',
          commit_sha: null,
          worker_id: 'worker-1',
          protocol: 'ring.workflow-run-report.v1',
          authenticated: true,
          outputs: {
            summary: 'Execution is still running.',
          },
        },
      ],
      node_execution: {
        node_id: 'n1-runner',
        branch_id: 'main',
        active_checkpoint_id: 'cp-root',
        checkpoint_ids: ['cp-root'],
        branch_event_ids: ['be-1'],
        capsule_state: createEmptyCapsuleState({
          node_id: 'n1-runner',
          runtime_status: 'leased',
          current_checkpoint_id: 'cp-root',
          last_accepted_evidence_refs: [
            { kind: 'summary', ref: 'docs/tasks/reviews/t1-test.md', digest: null },
          ],
          replay: {
            status: 'requested',
            requested_at: '2026-04-17T00:00:25Z',
            completed_at: null,
            requested_by: 'session-runner',
            reason: 'worker_timeout',
            source_checkpoint_id: 'cp-root',
            target_checkpoint_id: 'cp-root',
            cursor: { phase: 'execute', step_id: 'execute' },
            journal_state: {
              mode: 'semantic',
              last_applied_entry_id: 'journal-1',
              pending_entry_ids: ['journal-2'],
            },
          },
        }),
      },
      steps: [
        {
          step_id: 'execute',
          status: 'running',
          started_at: '2026-04-17T00:00:10Z',
          ended_at: null,
          outputs: {},
          notes: null,
        },
      ],
    },
  };
}

function buildEffectiveForceSelectionContext() {
  return {
    basis: 'governance_prefer_effective_force',
    preferred: {
      workflow_id: 'wf-1-test',
      workflow_name: 'Governed Workflow',
      policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
      governance_pressure_score: 1228,
      effective_force_score: 25,
      checkpoint_id: 'cp-governed-preferred',
      evidence_count: 3,
      replay_status: 'requested',
      lineage_depth: 5,
      divergence_score: 1,
      composability_score: 3,
    },
    compared: {
      workflow_id: 'wf-2-test',
      workflow_name: 'Comparison Workflow',
      policy: 'tight workflow_tightness, strong oversight, branch_budget=1',
      governance_pressure_score: 1228,
      effective_force_score: 0,
      checkpoint_id: 'cp-governed-compared',
      evidence_count: 0,
      replay_status: 'idle',
      lineage_depth: 2,
      divergence_score: 4,
      composability_score: 0,
    },
  };
}

function buildGovernedSessionDoc({ selectionContext = null } = {}) {
  const doc = {
    id: 's2-governed',
    type: 'session',
    version: 1,
    created_at: '2026-04-18T00:00:00Z',
    updated_at: '2026-04-18T00:00:00Z',
    created_by: 'dispatcher',
    session_id: 's2-governed',
    status: 'preparing',
    data: {
      requirement_id: 'r1-test',
      milestone_id: 'r1m1-test',
      milestone_ids: ['r1m1-test'],
      task_ids: ['t1-test'],
      workflow_run_ids: ['run-1-test'],
      evaluation_id: null,
      distillation_id: null,
      context_injected: {
        workflow_template: 'wf-1-test',
        distillations_applied: [],
        registry_rank_at_selection: null,
        replanning_handoffs: [
          {
            task_id: 't1-test',
            task_name: 'Governed task',
            parent_task_id: 't0-parent',
            parent_decision_note: 'Reuse the governed workflow only if the narrowed retry stays inside the publication scope.',
          },
        ],
        governance_selection_contexts: [
          {
            task_id: 't1-test',
            task_name: 'Governed task',
            workflow_template_id: 'wf-1-test',
            workflow_name: 'Governed Workflow',
            selection_context: selectionContext ?? buildEffectiveForceSelectionContext(),
          },
        ],
      },
      governance_context: {
        source: 'governance_blocked_reuse',
        isolated_batch: true,
        batch_signature: 'warm_semantic_lineage',
        reasons: ['warm_semantic_lineage'],
        blocked_reuse: [
          {
            task_id: 't1-test',
            task_name: 'Governed task',
            workflow_template_id: 'wf-1-test',
            workflow_name: 'Governed Workflow',
            reason: 'warm_semantic_lineage',
            checkpoint_id: 'cp-root',
            adoption_status: 'mainline',
            branch_budget: 0,
            workflow_tightness: 'tight',
            oversight_strength: 'strong',
            detail: 'The latest reusable workflow run still carries a governed warm-lineage hold.',
          },
        ],
      },
      execution_log: [
        {
          timestamp: '2026-04-18T00:00:00Z',
          event: 'governance_context_injected',
          actor: 'session-dispatcher',
          detail: 'Session carries governance-sensitive fallback context.',
        },
      ],
    },
  };

  return doc;
}

function buildPolicyCarryoverSelectionContext() {
  return {
    basis: 'governance_minimize_policy_carryover',
    preferred: {
      workflow_id: 'wf-roomier-test',
      workflow_name: 'Roomier Workflow',
      policy: 'balanced workflow_tightness, normal oversight, branch_budget=2',
      governance_pressure_score: 218,
      effective_force_score: 6,
      checkpoint_id: 'cp-roomier-template',
      evidence_count: 1,
      replay_status: 'idle',
      lineage_depth: 2,
      divergence_score: 0,
      composability_score: 0,
    },
    compared: {
      workflow_id: 'wf-tight-test',
      workflow_name: 'Tighter Workflow',
      policy: 'tight workflow_tightness, strong oversight, branch_budget=0',
      governance_pressure_score: 1228,
      effective_force_score: 6,
      checkpoint_id: 'cp-tight-template',
      evidence_count: 1,
      replay_status: 'idle',
      lineage_depth: 2,
      divergence_score: 0,
      composability_score: 0,
    },
  };
}

describe('validator', async () => {
  const validator = await createValidator(ringDir);

  describe('validate() — valid documents', () => {
    it('accepts a valid requirement', () => {
      const doc = {
        id: 'r1-test', type: 'requirement', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'draft',
        data: { name: 'Test', description: 'A test requirement', acceptance_criteria: [], priority: 'medium' },
      };
      const { valid, errors } = validator.validate('requirement', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid session', () => {
      const doc = {
        id: 's1-test', type: 'session', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-test', status: 'gate_pending',
        data: {
          requirement_id: 'r1-test', milestone_id: 'r1m1-test',
          task_ids: [], workflow_run_ids: [],
          evaluation_id: null, distillation_id: null,
          execution_log: [],
        },
      };
      const { valid, errors } = validator.validate('session', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid governed session context', () => {
      const doc = buildGovernedSessionDoc();
      const { valid, errors } = validator.validate('session', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a governed session selection context for governance_minimize_policy_carryover with checkpoint ids', () => {
      const doc = buildGovernedSessionDoc({
        selectionContext: buildPolicyCarryoverSelectionContext(),
      });
      assert.equal(
        doc.data.context_injected.governance_selection_contexts[0].selection_context.basis,
        'governance_minimize_policy_carryover',
      );
      const { valid, errors } = validator.validate('session', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid task', () => {
      const doc = buildTaskDoc();
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts task review status and replanning source failure pairs emitted by runtime', () => {
      const validPairs = [
        ['verifying_scope', null],
        ['awaiting_judgement', null],
        ['approved', null],
        ['scope_failed', 'scope_mismatch'],
        ['build_failed', 'build_failed'],
        ['cleanup_failed', 'cleanup_failed'],
        ['workflow_failed', 'workflow_failed'],
        ['workflow_timeout', 'workflow_timeout'],
        ['rejected', 'review_rejected'],
      ];

      for (const [reviewStatus, sourceFailure] of validPairs) {
        const doc = buildTaskDoc();
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = sourceFailure === null ? 'pending' : 'awaiting_replan';
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = sourceFailure === null ? null : buildTaskReplanPacket();
        const { valid, errors } = validator.validate('task', doc);
        assert.equal(
          valid,
          true,
          `Expected ${reviewStatus}/${String(sourceFailure)} valid but got errors: ${JSON.stringify(errors)}`,
        );
      }
    });

    it('accepts a valid task replanning payload for judge rejection', () => {
      const doc = buildTaskDoc();
      doc.data.execution.review_status = 'rejected';
      doc.data.replanning.status = 'awaiting_replan';
      doc.data.replanning.source_failure = 'review_rejected';
      doc.data.replanning.packet = buildTaskReplanPacket();
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a redispatched task replanning payload with a preserved packet', () => {
      const doc = buildTaskDoc();
      doc.status = 'failed';
      doc.data.execution.review_status = 'workflow_failed';
      doc.data.replanning.status = 'redispatched';
      doc.data.replanning.source_failure = 'workflow_failed';
      doc.data.replanning.packet = buildTaskReplanPacket();
      doc.data.replanning.successor_task_id = 't2-retry';
      doc.data.replanning.decision_note = 'Retry with a narrower executable file contract.';
      doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a terminal task replanning payload with a preserved packet', () => {
      const doc = buildTaskDoc();
      doc.status = 'failed';
      doc.data.execution.review_status = 'workflow_timeout';
      doc.data.replanning.status = 'terminal';
      doc.data.replanning.source_failure = 'workflow_timeout';
      doc.data.replanning.packet = buildTaskReplanPacket();
      doc.data.replanning.decision_note = 'Needs a broader milestone-level redesign.';
      doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('rejects a terminal task replanning payload without a final decision note', () => {
      const doc = buildTaskDoc();
      doc.status = 'failed';
      doc.data.execution.review_status = 'workflow_timeout';
      doc.data.replanning.status = 'terminal';
      doc.data.replanning.source_failure = 'workflow_timeout';
      doc.data.replanning.packet = buildTaskReplanPacket();
      doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('accepts a valid workflow-run with node execution capsule state', () => {
      const doc = buildWorkflowRunDoc();
      const { valid, errors } = validator.validate('workflow-run', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid evaluation', () => {
      const doc = {
        id: 'eval-test', type: 'evaluation', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-test', status: 'draft',
        data: {
          session_id: 's1-test', outcome: 'success',
          scores: { correctness: 0.9, completeness: 0.8, efficiency: 0.7, adherence: 1.0, reusability: 0.5 },
          composite_score: 0.82, score_weights: { correctness: 0.3, completeness: 0.25, efficiency: 0.2, adherence: 0.15, reusability: 0.1 },
          evidence: { tests_passed: 10, tests_failed: 0, build_status: 'success' },
          evaluator: 'automated',
        },
      };
      const { valid, errors } = validator.validate('evaluation', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid feedback', () => {
      const doc = {
        id: 'fb-1-test', type: 'feedback', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'open',
        data: {
          severity: 'major', category: 'requirement_gap',
          target: { type: 'requirement', id: 'r1-test', field: null },
          description: 'Missing acceptance criterion for edge case.',
          proposed_action: 'Add criterion for empty input.',
        },
      };
      const { valid, errors } = validator.validate('feedback', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid node', () => {
      const doc = {
        id: 'n1-router', type: 'node', version: 1,
        created_at: '2026-04-17T00:00:00Z', updated_at: '2026-04-17T00:00:00Z',
        created_by: 'test', session_id: null, status: 'active',
        data: {
          node_type: 'semantic-router',
          interface_version: 'node.interface.v1',
          input_schema: {
            kind: 'json_schema',
            schema: { type: 'object', additionalProperties: false, required: ['prompt'], properties: { prompt: { type: 'string' } } },
            description: 'Tree-facing input',
            notes: null,
          },
          output_schema: {
            kind: 'json_schema',
            schema: { type: 'object', additionalProperties: false, required: ['decision'], properties: { decision: { type: 'string' } } },
            description: 'Tree-facing output',
            notes: null,
          },
          evidence_schema: {
            kind: 'json_schema',
            schema: { type: 'object', additionalProperties: false, required: ['events'], properties: { events: { type: 'array', items: { type: 'string' } } } },
            description: 'Node evidence',
            notes: null,
          },
          capability_summary: {
            purpose: 'Route work through a stable external contract.',
            responsibilities: ['Accept contract input', 'Emit structured output'],
            limits: ['Does not expose internals'],
          },
          governance_profile: {
            owner: 'kernel',
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
            max_snapshots: 4,
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
      const { valid, errors } = validator.validate('node', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid governance-statement', () => {
      const doc = createGovernanceStatement({
        predicateType: 'https://dp-ring.dev/predicate/checkpoint-publication/v1',
        predicate: {
          checkpoint_id: 'cp-root',
          status: 'published',
          evidence: [{ kind: 'summary', ref: 'docs/tasks/reviews/t1.md' }],
        },
        subjects: [
          {
            name: 'checkpoint-publication/cp-root',
            mediaType: 'application/vnd.dp-ring.checkpoint-publication+json',
            body: {
              checkpoint_id: 'cp-root',
              branch_id: 'main',
              output_ref: 'docs/tasks/reviews/t1.md',
            },
            locator: {
              checkpoint_id: 'cp-root',
              branch_id: 'main',
            },
          },
        ],
      });
      const { valid, errors } = validator.validate('governance-statement', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid publication-root', () => {
      const doc = buildPublicationRootDoc();
      const { valid, errors } = validator.validate('publication-root', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid validation-result', () => {
      const doc = buildValidationResultDoc();
      const { valid, errors } = validator.validate('validation-result', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid validation-report', () => {
      const doc = buildValidationReportDoc();
      const { valid, errors } = validator.validate('validation-report', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid checkpoint', () => {
      const doc = {
        id: 'cp-root', type: 'checkpoint', version: 1,
        created_at: '2026-04-17T00:00:00Z', updated_at: '2026-04-17T00:00:00Z',
        created_by: 'test', session_id: null, status: 'candidate',
        data: {
          parent_checkpoint_id: null,
          publication_root_id: 'pr-checkpoint-root',
          validation_report_id: 'vrpt-checkpoint-root',
          trace_id: 'trace-checkpoint-root',
          span_id: 'span-checkpoint-root',
          parent_span_id: 'span-checkpoint-parent',
          branch_id: 'main',
          node_id: 'n1-router',
          scope_ref: { kind: 'task', id: 't1-test', path: 'docs/tasks/t1-test/t1-test.md' },
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
          evidence_refs: [
            { kind: 'summary', ref: 'docs/tasks/reviews/t1.md', digest: null },
          ],
          publication_statements: [],
          adoption_status: 'candidate',
          replay_state: {
            status: 'idle',
            requested_at: null,
            completed_at: null,
            requested_by: null,
            reason: null,
            source_checkpoint_id: null,
            target_checkpoint_id: null,
            cursor: null,
            journal_state: {
              mode: 'semantic',
              last_applied_entry_id: null,
              pending_entry_ids: [],
            },
          },
          synthesis_inputs: [],
        },
      };
      const { valid, errors } = validator.validate('checkpoint', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });

    it('accepts a valid branch-event', () => {
      const doc = {
        id: 'be-1', type: 'branch-event', version: 1,
        created_at: '2026-04-17T00:00:00Z', updated_at: '2026-04-17T00:00:00Z',
        created_by: 'test', session_id: null, status: 'recorded',
        data: {
          event_type: 'checkpoint_created',
          message_class: 'commit',
          branch_id: 'main',
          checkpoint_id: 'cp-root',
          publication_root_id: 'pr-branch-event-root',
          validation_report_id: 'vrpt-branch-event-root',
          trace_id: 'trace-branch-event-root',
          span_id: 'span-branch-event-root',
          parent_span_id: 'span-branch-event-parent',
          actor: 'test',
          occurred_at: '2026-04-17T00:00:00Z',
          statement: createBranchCommitStatement({
            event_type: 'checkpoint_created',
            branch_id: 'main',
            checkpoint_id: 'cp-root',
            actor: 'test',
            occurred_at: '2026-04-17T00:00:00Z',
            parent_checkpoint_id: null,
            synthesis_inputs: [],
            reason: null,
          }),
          details: {
            parent_checkpoint_id: null,
            synthesis_inputs: [],
            reason: null,
          },
        },
      };
      const { valid, errors } = validator.validate('branch-event', doc);
      assert.equal(valid, true, `Expected valid but got errors: ${JSON.stringify(errors)}`);
    });
  });

  describe('validate() — invalid documents', () => {
    it('rejects a requirement with missing data.name', () => {
      const doc = {
        id: 'r1-bad', type: 'requirement', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'draft',
        data: { description: 'No name', acceptance_criteria: [], priority: 'medium' },
      };
      const { valid } = validator.validate('requirement', doc);
      assert.equal(valid, false);
    });

    it('rejects a session with invalid status', () => {
      const doc = {
        id: 's1-bad', type: 'session', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1-bad', status: 'invalid_status',
        data: { requirement_id: 'r1', milestone_id: 'm1', task_ids: [], workflow_run_ids: [], execution_log: [] },
      };
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session context when required fields are missing', () => {
      const doc = buildGovernedSessionDoc();
      delete doc.data.governance_context.blocked_reuse;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session context with a non-integer branch budget', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.governance_context.blocked_reuse[0].branch_budget = 0.5;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session context with an invalid governance source', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.governance_context.source = 'custom_override';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session context with an empty batch signature', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.governance_context.batch_signature = '';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session selection context with an unknown basis', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.governance_selection_contexts[0].selection_context.basis = 'governance_rank_override';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session context with an invalid workflow tightness label', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.governance_context.blocked_reuse[0].workflow_tightness = 'chaotic';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects blank blocked-reuse linkage fields in governed session context', () => {
      const cases = [
        ['task_id', ''],
        ['task_id', '   '],
        ['workflow_template_id', ''],
        ['workflow_template_id', '   '],
        ['workflow_name', ''],
        ['workflow_name', '   '],
      ];

      for (const [field, value] of cases) {
        const doc = buildGovernedSessionDoc();
        doc.data.governance_context.blocked_reuse[0][field] = value;
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${field}=${JSON.stringify(value)}`);
      }
    });

    it('rejects blank blocked-reuse detail strings in governed session context', () => {
      const cases = ['', '   '];

      for (const detail of cases) {
        const doc = buildGovernedSessionDoc();
        doc.data.governance_context.blocked_reuse[0].detail = detail;
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for detail=${JSON.stringify(detail)}`);
      }
    });

    it('rejects blank blocked-reuse checkpoint ids across governed session hold reasons', () => {
      const cases = [
        ['warm_semantic_lineage', '   '],
        ['checkpoint_branch_budget_exhausted', ''],
      ];

      for (const [reason, checkpointId] of cases) {
        const doc = buildGovernedSessionDoc();
        doc.data.governance_context.blocked_reuse[0].reason = reason;
        doc.data.governance_context.blocked_reuse[0].checkpoint_id = checkpointId;
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${reason}`);
      }
    });

    it('rejects a governed session selection context with a negative divergence score', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.governance_selection_contexts[0].selection_context.preferred.divergence_score = -1;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session selection context with a negative lineage depth', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.governance_selection_contexts[0].selection_context.preferred.lineage_depth = -1;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session selection context with a negative evidence count', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.governance_selection_contexts[0].selection_context.preferred.evidence_count = -1;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects a governed session selection context with an unknown replay status', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.governance_selection_contexts[0].selection_context.preferred.replay_status = 'paused';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects blank preferred-side checkpoint ids across governed selection-context bases', () => {
      const cases = [
        ['governance_prefer_effective_force', buildEffectiveForceSelectionContext],
        ['governance_minimize_policy_carryover', buildPolicyCarryoverSelectionContext],
      ];

      for (const [basis, buildSelectionContext] of cases) {
        const selectionContext = buildSelectionContext();
        selectionContext.preferred.checkpoint_id = '   ';
        const doc = buildGovernedSessionDoc({ selectionContext });
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${basis}`);
      }
    });

    it('rejects blank compared-side checkpoint ids across governed selection-context bases', () => {
      const cases = [
        ['governance_prefer_effective_force', buildEffectiveForceSelectionContext],
        ['governance_minimize_policy_carryover', buildPolicyCarryoverSelectionContext],
      ];

      for (const [basis, buildSelectionContext] of cases) {
        const selectionContext = buildSelectionContext();
        selectionContext.compared.checkpoint_id = '';
        const doc = buildGovernedSessionDoc({ selectionContext });
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${basis}`);
      }
    });

    it('rejects negative preferred-side composability scores across governed selection-context bases', () => {
      const cases = [
        ['governance_prefer_effective_force', buildEffectiveForceSelectionContext],
        ['governance_minimize_policy_carryover', buildPolicyCarryoverSelectionContext],
      ];

      for (const [basis, buildSelectionContext] of cases) {
        const selectionContext = buildSelectionContext();
        selectionContext.preferred.composability_score = -1;
        const doc = buildGovernedSessionDoc({ selectionContext });
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${basis}`);
      }
    });

    it('rejects compared-side effective-force metrics that violate the governed session schema', () => {
      const cases = [
        ['negative divergence score', (selectionContext) => {
          selectionContext.compared.divergence_score = -1;
        }],
        ['negative lineage depth', (selectionContext) => {
          selectionContext.compared.lineage_depth = -1;
        }],
        ['negative evidence count', (selectionContext) => {
          selectionContext.compared.evidence_count = -1;
        }],
        ['negative composability score', (selectionContext) => {
          selectionContext.compared.composability_score = -1;
        }],
        ['unknown replay status', (selectionContext) => {
          selectionContext.compared.replay_status = 'paused';
        }],
      ];

      for (const [label, mutate] of cases) {
        const selectionContext = buildEffectiveForceSelectionContext();
        mutate(selectionContext);
        const doc = buildGovernedSessionDoc({ selectionContext });
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${label}`);
      }
    });

    it('rejects compared-side policy-carryover metrics that violate the governed session schema', () => {
      const cases = [
        ['negative divergence score', (selectionContext) => {
          selectionContext.compared.divergence_score = -1;
        }],
        ['negative lineage depth', (selectionContext) => {
          selectionContext.compared.lineage_depth = -1;
        }],
        ['negative evidence count', (selectionContext) => {
          selectionContext.compared.evidence_count = -1;
        }],
        ['negative composability score', (selectionContext) => {
          selectionContext.compared.composability_score = -1;
        }],
        ['unknown replay status', (selectionContext) => {
          selectionContext.compared.replay_status = 'paused';
        }],
      ];

      for (const [label, mutate] of cases) {
        const selectionContext = buildPolicyCarryoverSelectionContext();
        mutate(selectionContext);
        const doc = buildGovernedSessionDoc({ selectionContext });
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for ${label}`);
      }
    });

    it('rejects a governed session selection context when task linkage is missing', () => {
      const doc = buildGovernedSessionDoc();
      delete doc.data.context_injected.governance_selection_contexts[0].task_id;
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects blank governed session selection-context linkage fields', () => {
      const cases = ['task_id', 'workflow_template_id', 'workflow_name'];

      for (const field of cases) {
        const doc = buildGovernedSessionDoc();
        doc.data.context_injected.governance_selection_contexts[0][field] = '   ';
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for blank ${field}`);
      }
    });

    it('accepts null governed session task_name labels when task labels are absent', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.replanning_handoffs[0].task_name = null;
      doc.data.context_injected.governance_selection_contexts[0].task_name = null;
      doc.data.governance_context.blocked_reuse[0].task_name = null;
      const { valid, errors } = validator.validate('session', doc);
      assert.equal(valid, true, `Expected valid with null task_name labels but got errors: ${JSON.stringify(errors)}`);
    });

    it('rejects blank governed session workflow_template ids while allowing null', () => {
      const nullDoc = buildGovernedSessionDoc();
      nullDoc.data.context_injected.workflow_template = null;
      const nullResult = validator.validate('session', nullDoc);
      assert.equal(
        nullResult.valid,
        true,
        `Expected valid with null workflow_template but got errors: ${JSON.stringify(nullResult.errors)}`,
      );

      for (const value of ['', '   ']) {
        const doc = buildGovernedSessionDoc();
        doc.data.context_injected.workflow_template = value;
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for blank workflow_template=${JSON.stringify(value)}`);
      }
    });

    it('rejects blank governed session distillation ids while allowing an empty applied list', () => {
      const emptyDoc = buildGovernedSessionDoc();
      emptyDoc.data.context_injected.distillations_applied = [];
      const emptyResult = validator.validate('session', emptyDoc);
      assert.equal(
        emptyResult.valid,
        true,
        `Expected valid with an empty distillations_applied list but got errors: ${JSON.stringify(emptyResult.errors)}`,
      );

      for (const value of ['', '   ']) {
        const doc = buildGovernedSessionDoc();
        doc.data.context_injected.distillations_applied = ['dist-1', value];
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for blank distillation id=${JSON.stringify(value)}`);
      }
    });

    it('rejects blank session linkage ids in task_ids and workflow_run_ids', () => {
      const cases = [
        ['task_ids', (doc, value) => {
          doc.data.task_ids = ['t1-test', value];
        }],
        ['workflow_run_ids', (doc, value) => {
          doc.data.workflow_run_ids = ['run-1-test', value];
        }],
      ];

      for (const [label, mutate] of cases) {
        for (const value of ['', '   ']) {
          const doc = buildGovernedSessionDoc();
          mutate(doc, value);
          const { valid } = validator.validate('session', doc);
          assert.equal(valid, false, `Expected invalid for ${label} containing ${JSON.stringify(value)}`);
        }
      }
    });

    it('rejects negative governed session registry ranks while allowing null', () => {
      const nullDoc = buildGovernedSessionDoc();
      nullDoc.data.context_injected.registry_rank_at_selection = null;
      const nullResult = validator.validate('session', nullDoc);
      assert.equal(
        nullResult.valid,
        true,
        `Expected valid with null registry_rank_at_selection but got errors: ${JSON.stringify(nullResult.errors)}`,
      );

      const zeroDoc = buildGovernedSessionDoc();
      zeroDoc.data.context_injected.registry_rank_at_selection = 0;
      const zeroResult = validator.validate('session', zeroDoc);
      assert.equal(
        zeroResult.valid,
        true,
        `Expected valid with registry_rank_at_selection=0 but got errors: ${JSON.stringify(zeroResult.errors)}`,
      );

      const invalidDoc = buildGovernedSessionDoc();
      invalidDoc.data.context_injected.registry_rank_at_selection = -1;
      const { valid } = validator.validate('session', invalidDoc);
      assert.equal(valid, false, 'Expected invalid for negative registry_rank_at_selection');
    });

    it('rejects blank governed session task_name labels across governance metadata', () => {
      const cases = [
        ['replanning_handoffs[0].task_name', (doc, value) => {
          doc.data.context_injected.replanning_handoffs[0].task_name = value;
        }],
        ['governance_selection_contexts[0].task_name', (doc, value) => {
          doc.data.context_injected.governance_selection_contexts[0].task_name = value;
        }],
        ['governance_context.blocked_reuse[0].task_name', (doc, value) => {
          doc.data.governance_context.blocked_reuse[0].task_name = value;
        }],
      ];

      for (const [label, mutate] of cases) {
        for (const value of ['', '   ']) {
          const doc = buildGovernedSessionDoc();
          mutate(doc, value);
          const { valid } = validator.validate('session', doc);
          assert.equal(valid, false, `Expected invalid for blank ${label}=${JSON.stringify(value)}`);
        }
      }
    });

    it('rejects blank preferred/compared workflow provenance labels in governed session selection context', () => {
      const variants = [
        ['effective-force', () => buildEffectiveForceSelectionContext()],
        ['policy-carryover', () => buildPolicyCarryoverSelectionContext()],
      ];
      const sides = ['preferred', 'compared'];
      const fields = ['workflow_id', 'workflow_name', 'policy'];

      for (const [variantLabel, buildSelectionContext] of variants) {
        for (const side of sides) {
          for (const field of fields) {
            const doc = buildGovernedSessionDoc({ selectionContext: buildSelectionContext() });
            doc.data.context_injected.governance_selection_contexts[0].selection_context[side][field] = '   ';
            const { valid } = validator.validate('session', doc);
            assert.equal(valid, false, `Expected invalid for ${variantLabel} ${side}.${field}`);
          }
        }
      }
    });

    it('rejects a session replanning handoff with a blank parent decision note', () => {
      const doc = buildGovernedSessionDoc();
      doc.data.context_injected.replanning_handoffs[0].parent_decision_note = '   ';
      const { valid } = validator.validate('session', doc);
      assert.equal(valid, false);
    });

    it('rejects blank session replanning handoff linkage fields', () => {
      const cases = ['task_id', 'parent_task_id'];

      for (const field of cases) {
        const doc = buildGovernedSessionDoc();
        doc.data.context_injected.replanning_handoffs[0][field] = '   ';
        const { valid } = validator.validate('session', doc);
        assert.equal(valid, false, `Expected invalid for blank ${field}`);
      }
    });

    it('rejects a task with invalid id prefix', () => {
      const doc = {
        id: 'bad-prefix', type: 'task', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: null, status: 'pending',
        data: {
          name: 'Bad', description: 'Bad prefix', task_type: 'bug-fix',
          requirement_id: 'r1', milestone_id: 'm1', acceptance_criteria: [],
        },
      };
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects a task replanning payload with an unknown source failure reason', () => {
      const doc = buildTaskDoc();
      doc.data.replanning.status = 'awaiting_replan';
      doc.data.replanning.source_failure = 'mystery_failure';
      doc.data.replanning.packet = buildTaskReplanPacket();
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects a pending task replanning payload with a stale packet', () => {
      const doc = buildTaskDoc();
      doc.data.replanning.packet = buildTaskReplanPacket();
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects a non-pending task replanning payload without a packet', () => {
      const cases = [
        ['awaiting_replan', 'workflow_failed', 'workflow_failed'],
        ['redispatched', 'workflow_failed', 'workflow_failed'],
        ['terminal', 'workflow_timeout', 'workflow_timeout'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = null;
        if (replanningStatus === 'redispatched') {
          doc.data.replanning.successor_task_id = 't2-retry';
        }
        if (replanningStatus !== 'awaiting_replan') {
          doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
        }
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected ${replanningStatus} without packet to be invalid.`);
      }
    });

    it('rejects a redispatched task replanning payload without a successor task id', () => {
      const doc = buildTaskDoc();
      doc.status = 'failed';
      doc.data.execution.review_status = 'workflow_failed';
      doc.data.replanning.status = 'redispatched';
      doc.data.replanning.source_failure = 'workflow_failed';
      doc.data.replanning.packet = buildTaskReplanPacket();
      doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects a non-redispatched task replanning payload with a stale successor task id', () => {
      const cases = [
        ['pending', 'pending', null],
        ['awaiting_replan', 'workflow_failed', 'workflow_failed'],
        ['terminal', 'workflow_timeout', 'workflow_timeout'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = replanningStatus === 'pending' ? 'pending' : 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = replanningStatus === 'pending' ? null : buildTaskReplanPacket();
        doc.data.replanning.successor_task_id = 't2-retry';
        if (replanningStatus === 'terminal') {
          doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
        }
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected ${replanningStatus} with stale successor task id to be invalid.`);
      }
    });

    it('rejects a stale replanning reviewed_at timestamp before a replanning decision exists', () => {
      const cases = [
        ['pending', 'pending', null],
        ['awaiting_replan', 'workflow_failed', 'workflow_failed'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = replanningStatus === 'pending' ? 'pending' : 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = replanningStatus === 'pending' ? null : buildTaskReplanPacket();
        doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected ${replanningStatus} with stale reviewed_at to be invalid.`);
      }
    });

    it('rejects a stale replanning decision note before a replanning verdict exists', () => {
      const cases = [
        ['pending', 'pending', null],
        ['awaiting_replan', 'workflow_failed', 'workflow_failed'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = replanningStatus === 'pending' ? 'pending' : 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = replanningStatus === 'pending' ? null : buildTaskReplanPacket();
        doc.data.replanning.decision_note = 'This stale decision should not exist yet.';
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected ${replanningStatus} with stale decision_note to be invalid.`);
      }
    });

    it('rejects a redispatched child task without a non-empty parent decision note', () => {
      const cases = [null, '   '];

      for (const parentDecisionNote of cases) {
        const doc = buildTaskDoc();
        doc.data.replanning.parent_task_id = 't0-parent';
        doc.data.replanning.parent_decision_note = parentDecisionNote;
        const { valid } = validator.validate('task', doc);
        assert.equal(
          valid,
          false,
          `Expected pending child task with parent_decision_note=${JSON.stringify(parentDecisionNote)} to be invalid.`,
        );
      }
    });

    it('accepts a redispatched child task with a parent decision note handoff', () => {
      const doc = buildTaskDoc();
      doc.data.replanning.parent_task_id = 't0-parent';
      doc.data.replanning.parent_decision_note = 'Retry only the narrowed file set from the governed redispatch review.';
      const { valid, errors } = validator.validate('task', doc);
      assert.equal(valid, true, JSON.stringify(errors));
    });

    it('rejects a resolved redispatched replanning payload without a non-empty decision note', () => {
      const cases = [null, '   '];

      for (const decisionNote of cases) {
        const doc = buildTaskDoc();
        doc.status = 'failed';
        doc.data.execution.review_status = 'workflow_failed';
        doc.data.replanning.status = 'redispatched';
        doc.data.replanning.source_failure = 'workflow_failed';
        doc.data.replanning.packet = buildTaskReplanPacket();
        doc.data.replanning.successor_task_id = 't2-retry';
        doc.data.replanning.decision_note = decisionNote;
        doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected redispatched payload with decision_note=${JSON.stringify(decisionNote)} to be invalid.`);
      }
    });

    it('accepts a resolved replanning payload with a final decision note', () => {
      const cases = [
        ['redispatched', 'workflow_failed', 'workflow_failed'],
        ['terminal', 'workflow_timeout', 'workflow_timeout'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = buildTaskReplanPacket();
        doc.data.replanning.decision_note = 'Final replanning decision recorded.';
        doc.data.replanning.reviewed_at = '2026-04-08T00:05:00Z';
        if (replanningStatus === 'redispatched') {
          doc.data.replanning.successor_task_id = 't2-retry';
        }
        const { valid, errors } = validator.validate('task', doc);
        assert.equal(valid, true, `Expected ${replanningStatus} with final decision_note to be valid: ${JSON.stringify(errors)}`);
      }
    });

    it('rejects a resolved replanning payload without a reviewed_at timestamp', () => {
      const cases = [
        ['redispatched', 'workflow_failed', 'workflow_failed'],
        ['terminal', 'workflow_timeout', 'workflow_timeout'],
      ];

      for (const [replanningStatus, reviewStatus, sourceFailure] of cases) {
        const doc = buildTaskDoc();
        doc.status = 'failed';
        doc.data.execution.review_status = reviewStatus;
        doc.data.replanning.status = replanningStatus;
        doc.data.replanning.source_failure = sourceFailure;
        doc.data.replanning.packet = buildTaskReplanPacket();
        if (replanningStatus === 'redispatched') {
          doc.data.replanning.successor_task_id = 't2-retry';
        }
        const { valid } = validator.validate('task', doc);
        assert.equal(valid, false, `Expected ${replanningStatus} without reviewed_at to be invalid.`);
      }
    });

    it('rejects a task that records a source failure while review is still pending', () => {
      const doc = buildTaskDoc();
      doc.data.replanning.status = 'awaiting_replan';
      doc.data.replanning.source_failure = 'scope_mismatch';
      doc.data.replanning.packet = buildTaskReplanPacket();
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects a task whose rejected review state carries the wrong source failure', () => {
      const doc = buildTaskDoc();
      doc.data.execution.review_status = 'rejected';
      doc.data.replanning.status = 'awaiting_replan';
      doc.data.replanning.source_failure = 'workflow_failed';
      doc.data.replanning.packet = buildTaskReplanPacket();
      const { valid } = validator.validate('task', doc);
      assert.equal(valid, false);
    });

    it('rejects an evaluation with score > 1', () => {
      const doc = {
        id: 'eval-bad', type: 'evaluation', version: 1,
        created_at: '2026-04-08T00:00:00Z', updated_at: '2026-04-08T00:00:00Z',
        created_by: 'test', session_id: 's1', status: 'draft',
        data: {
          session_id: 's1', outcome: 'success',
          scores: { correctness: 1.5, completeness: 0.8, efficiency: 0.7, adherence: 1.0, reusability: 0.5 },
          composite_score: 0.9, score_weights: { correctness: 0.3, completeness: 0.25, efficiency: 0.2, adherence: 0.15, reusability: 0.1 },
          evidence: {}, evaluator: 'human',
        },
      };
      const { valid } = validator.validate('evaluation', doc);
      assert.equal(valid, false);
    });

    it('rejects a workflow-run without node execution capsule state', () => {
      const doc = buildWorkflowRunDoc();
      delete doc.data.node_execution.capsule_state;
      const { valid } = validator.validate('workflow-run', doc);
      assert.equal(valid, false);
    });

    it('rejects a workflow-run report with an invalid replanning status', () => {
      const doc = buildWorkflowRunDoc();
      doc.data.reports[0].outputs.replanning_status = 'ready';
      const { valid } = validator.validate('workflow-run', doc);
      assert.equal(valid, false);
    });

    it('rejects a workflow-run report with a non-integer branch budget', () => {
      const doc = buildWorkflowRunDoc();
      doc.data.reports[0].outputs.branch_budget = 0.5;
      const { valid } = validator.validate('workflow-run', doc);
      assert.equal(valid, false);
    });

    it('rejects a publication-root with an invalid membership digest', () => {
      const doc = buildPublicationRootDoc();
      doc.membership_digest = 'sha256:not-a-digest';
      const { valid } = validator.validate('publication-root', doc);
      assert.equal(valid, false);
    });

    it('rejects a validation-result with query-style locations', () => {
      const doc = buildValidationResultDoc();
      doc.data.subject_location = '$.data.publication_statements[0]';
      const { valid } = validator.validate('validation-result', doc);
      assert.equal(valid, false);
    });

    it('rejects a validation-report with a conformant blocking outcome', () => {
      const doc = buildValidationReportDoc();
      doc.data.conforms = true;
      doc.data.outcome = 'blocking';
      const { valid } = validator.validate('validation-report', doc);
      assert.equal(valid, false);
    });

    it('returns error for unknown type', () => {
      const { valid, errors } = validator.validate('nonexistent', {});
      assert.equal(valid, false);
      assert.ok(errors[0].message.includes('Unknown artifact type'));
    });
  });

  describe('getSchema()', () => {
    it('returns schema for known types', () => {
      const schema = validator.getSchema('session');
      assert.ok(schema);
      assert.equal(schema.title, 'Session');
    });

    it('returns null for unknown type', () => {
      assert.equal(validator.getSchema('nonexistent'), null);
    });
  });
});
