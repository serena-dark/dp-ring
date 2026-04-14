import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createUiAssistant } from '../../ring/lib/ui-assistant.mjs';

const pages = [
  {
    route_key: 'dashboard',
    path: '/',
    title: 'Dashboard',
    default_section_id: 'summary',
    sections: [{ id: 'summary', label: 'Summary' }],
  },
  {
    route_key: 'workflows',
    path: '/workflows',
    title: 'Workflows',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
      { id: 'records', label: 'Records' },
    ],
  },
  {
    route_key: 'workflow-rankings',
    path: '/workflows/rankings',
    title: 'Workflow Ranking',
    default_section_id: 'records',
    sections: [
      { id: 'filters', label: 'Filters' },
      { id: 'records', label: 'Records' },
    ],
  },
  {
    route_key: 'requirements',
    path: '/requirements',
    title: 'Requirements',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
      { id: 'create', label: 'Create' },
      { id: 'records', label: 'Records' },
    ],
  },
  {
    route_key: 'feedback',
    path: '/feedback',
    title: 'Feedback',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
      { id: 'create', label: 'Create' },
      { id: 'records', label: 'Records' },
    ],
  },
];

function createAssistant(openai = null) {
  const records = {
    workflow: [
      { id: 'wf-alpha', status: 'active', data: {} },
      { id: 'wf-beta', status: 'active', data: {} },
      { id: 'wf-old', status: 'archived', data: {} },
    ],
    feedback: [
      { id: 'fb-1', status: 'open', data: { severity: 'critical' } },
      { id: 'fb-2', status: 'resolved', data: { severity: 'major' } },
    ],
  };

  return createUiAssistant({
    list: async (type) => records[type] ?? [],
    registry: {
      getAll: async () => ({
        updated_at: '2026-04-14T00:00:00Z',
        rankings: {
          'feature-implementation': [
            {
              workflow_id: 'wf-alpha',
              avg_score: 0.91,
              usage_count: 12,
            },
          ],
        },
      }),
    },
    openai,
  });
}

describe('ui assistant planner', () => {
  it('counts workflows and routes to the workflow summary section', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: '现在有多少个Workflow？',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/workflows');
    assert.equal(plan.navigation.section_id, 'summary');
    assert.match(plan.answer, /3/);
  });

  it('applies status filters for list navigation', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'show active workflows',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/workflows');
    assert.equal(plan.navigation.section_id, 'records');
    assert.deepEqual(plan.page_adjustments, [
      { key: 'status', value: 'active', scope: 'query' },
    ]);
  });

  it('drafts a requirement mutation with confirmation', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: '创建需求: Workflow summary panel\n需要展示工作流统计\n- 总数\n- 状态分布',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'mutate');
    assert.equal(plan.navigation.path, '/requirements');
    assert.equal(plan.proposed_action.kind, 'create-requirement');
    assert.equal(plan.proposed_action.ready, true);
    assert.equal(plan.proposed_action.payload.name, 'Workflow summary panel');
  });

  it('drafts a transition instead of executing it immediately', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'archive workflow wf-old',
      current_route: { path: '/workflows', title: 'Workflows', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'mutate');
    assert.equal(plan.proposed_action.kind, 'transition-artifact');
    assert.equal(plan.proposed_action.ready, true);
    assert.equal(plan.proposed_action.payload.artifact_id, 'wf-old');
    assert.equal(plan.proposed_action.payload.next_status, 'archived');
  });

  it('uses the cloud planner when OpenAI is available', async () => {
    const assistant = createAssistant({
      completeJson: async () => ({
        parsed: {
          mode: 'read',
          answer: 'Opened the feedback queue.',
          confidence: 0.91,
          navigation: {
            should_navigate: true,
            path: '/feedback',
            section_id: 'records',
            query_items: [
              { key: 'status', value: 'open' },
            ],
          },
          page_adjustments: [],
          action: {
            kind: 'none',
            title: '',
            description: '',
            ready: false,
            confirmation_required: true,
            missing_inputs: [],
            target_artifact_type: '',
            target_artifact_id: '',
            payload_json: '{}',
          },
        },
      }),
    });

    const plan = await assistant.plan({
      prompt: 'open unresolved feedback',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/feedback');
    assert.equal(plan.navigation.section_id, 'records');
    assert.deepEqual(plan.navigation.query, {
      status: 'open',
    });
    assert.equal(plan.answer, 'Opened the feedback queue.');
  });
});
