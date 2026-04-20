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
  {
    route_key: 'publication-roots',
    path: '/publication-roots',
    title: 'Publication Roots',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
      { id: 'records', label: 'Records' },
    ],
  },
  {
    route_key: 'validation-reports',
    path: '/validation-reports',
    title: 'Validation Reports',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
      { id: 'records', label: 'Records' },
    ],
  },
  {
    route_key: 'validation-results',
    path: '/validation-results',
    title: 'Validation Results',
    default_section_id: 'summary',
    sections: [
      { id: 'summary', label: 'Summary' },
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
      { id: 'fb-3', status: 'open', data: { severity: 'major' } },
    ],
    'publication-root': [
      { id: 'pr-1', status: 'published', data: {} },
      { id: 'pr-2', status: 'draft', data: {} },
      { id: 'pr-3', status: 'published', data: {} },
    ],
    'validation-report': [
      { id: 'vrpt-1', status: 'recorded', data: { outcome: 'blocking', conforms: false } },
      { id: 'vrpt-2', status: 'recorded', data: { outcome: 'advisory', conforms: false } },
      { id: 'vrpt-3', status: 'recorded', data: { outcome: 'conformant', conforms: true } },
    ],
    'validation-result': [
      { id: 'vres-1', status: 'recorded', data: { severity: 'warning' } },
      { id: 'vres-2', status: 'recorded', data: { severity: 'violation' } },
      { id: 'vres-3', status: 'recorded', data: { severity: 'info' } },
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

  it('counts feedback with combined status and severity filters', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'how many open critical feedback items are there?',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/feedback');
    assert.equal(plan.navigation.section_id, 'records');
    assert.match(plan.answer, /1/);
    assert.match(plan.answer, /critical/i);
    assert.deepEqual(plan.page_adjustments, [
      { key: 'status', value: 'open', scope: 'query' },
      { key: 'severity', value: 'critical', scope: 'query' },
    ]);
  });

  it('counts published publication roots and routes to the publication root records view', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'how many published publication roots are there?',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/publication-roots');
    assert.equal(plan.navigation.section_id, 'records');
    assert.match(plan.answer, /2/);
    assert.deepEqual(plan.page_adjustments, [
      { key: 'status', value: 'published', scope: 'query' },
    ]);
  });

  it('opens blocking validation reports with an outcome filter', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'show blocking validation reports',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/validation-reports');
    assert.equal(plan.navigation.section_id, 'records');
    assert.deepEqual(plan.page_adjustments, [
      { key: 'outcome', value: 'blocking', scope: 'query' },
    ]);
  });

  it('counts warning validation results using validation severity filters', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'how many warning validation results are there?',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/validation-results');
    assert.equal(plan.navigation.section_id, 'records');
    assert.match(plan.answer, /1/);
    assert.deepEqual(plan.page_adjustments, [
      { key: 'severity', value: 'warning', scope: 'query' },
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

  it('falls back to the current page when a migrated-out target route is unavailable locally', async () => {
    const assistant = createAssistant();
    const plan = await assistant.plan({
      prompt: 'create session "Kickoff" requirement req-1 milestone ms-1 tasks task-1',
      current_route: { path: '/', title: 'Dashboard', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'mutate');
    assert.equal(plan.navigation.path, '/');
    assert.equal(plan.navigation.section_id, 'summary');
    assert.deepEqual(plan.navigation.query, {});
    assert.deepEqual(plan.page_adjustments, []);
    assert.equal(plan.proposed_action.kind, 'create-session');
    assert.equal(plan.proposed_action.ready, true);
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

  it('falls back to the current page when the cloud planner returns a removed route', async () => {
    const assistant = createAssistant({
      completeJson: async () => ({
        parsed: {
          mode: 'read',
          answer: 'I could not find the old session page, so I stayed here.',
          confidence: 0.77,
          navigation: {
            should_navigate: true,
            path: '/sessions',
            section_id: 'create',
            query_items: [
              { key: 'compose', value: '1' },
            ],
          },
          page_adjustments: [
            { key: 'compose', value: '1', scope: 'query' },
          ],
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
      prompt: 'open the session composer',
      current_route: { path: '/feedback', title: 'Feedback', search: '', hash: null },
      pages,
    });

    assert.equal(plan.mode, 'read');
    assert.equal(plan.navigation.path, '/feedback');
    assert.equal(plan.navigation.section_id, 'summary');
    assert.deepEqual(plan.navigation.query, {});
    assert.deepEqual(plan.page_adjustments, []);
    assert.equal(plan.answer, 'I could not find the old session page, so I stayed here.');
  });
});
