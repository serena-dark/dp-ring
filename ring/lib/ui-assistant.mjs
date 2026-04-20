import { filterByFields } from './query.mjs';

const ENTITY_DEFINITIONS = [
  {
    type: 'workflow',
    singular: 'workflow',
    plural: 'workflows',
    label_en: 'workflow',
    label_zh: 'Workflow',
    path: '/workflows',
    aliases: ['workflow', 'workflows', '工作流'],
  },
  {
    type: 'session',
    singular: 'session',
    plural: 'sessions',
    label_en: 'session',
    label_zh: 'Session',
    path: '/sessions',
    aliases: ['session', 'sessions', '会话'],
  },
  {
    type: 'requirement',
    singular: 'requirement',
    plural: 'requirements',
    label_en: 'requirement',
    label_zh: 'Requirement',
    path: '/requirements',
    aliases: ['requirement', 'requirements', '需求'],
  },
  {
    type: 'task',
    singular: 'task',
    plural: 'tasks',
    label_en: 'task',
    label_zh: 'Task',
    path: '/tasks',
    aliases: ['task', 'tasks', '任务'],
  },
  {
    type: 'feedback',
    singular: 'feedback',
    plural: 'feedback',
    label_en: 'feedback item',
    label_zh: 'Feedback',
    path: '/feedback',
    aliases: ['feedback', '反馈'],
  },
  {
    type: 'distillation',
    singular: 'distillation',
    plural: 'distillations',
    label_en: 'distillation',
    label_zh: 'Distillation',
    path: '/knowledge',
    aliases: ['distillation', 'distillations', 'knowledge', '知识', '蒸馏'],
  },
  {
    type: 'publication-root',
    singular: 'publication root',
    plural: 'publication roots',
    label_en: 'publication root',
    label_zh: 'Publication Root',
    path: '/publication-roots',
    aliases: ['publication root', 'publication roots', 'publication-root', 'publication-roots'],
  },
  {
    type: 'validation-report',
    singular: 'validation report',
    plural: 'validation reports',
    label_en: 'validation report',
    label_zh: 'Validation Report',
    path: '/validation-reports',
    aliases: ['validation report', 'validation reports', 'validation-report', 'validation-reports'],
  },
  {
    type: 'validation-result',
    singular: 'validation result',
    plural: 'validation results',
    label_en: 'validation result',
    label_zh: 'Validation Result',
    path: '/validation-results',
    aliases: ['validation result', 'validation results', 'validation-result', 'validation-results'],
  },
];

const STATUS_ALIASES = {
  active: ['active', '启用', '活跃'],
  deprecated: ['deprecated', '废弃'],
  archived: ['archived', 'archive', '归档'],
  draft: ['draft', '草稿'],
  published: ['published', 'publish', '发布'],
  withheld: ['withheld', 'hold', '暂缓'],
  superseded: ['superseded', 'replaced', '替代'],
  recorded: ['recorded', '记录中', '已记录'],
  ready: ['ready', '就绪'],
  in_progress: ['in progress', 'in_progress', '进行中'],
  completed: ['completed', '完成'],
  pending: ['pending', '待处理'],
  open: ['open', '未解决', '打开'],
  acknowledged: ['acknowledged', '已确认'],
  resolved: ['resolved', '已解决'],
  wont_fix: ['wont fix', 'wont_fix', '不修复'],
  gate_pending: ['gate pending', 'gate_pending'],
  preparing: ['preparing', '准备中'],
  executing: ['executing', '执行中'],
  reviewing: ['reviewing', '评审中'],
  closing: ['closing', '收尾中'],
  closed: ['closed', '已关闭'],
  failed: ['failed', '失败'],
};

const SEVERITY_ALIASES = {
  critical: ['critical', '严重'],
  major: ['major', '重要'],
  minor: ['minor', '次要'],
  info: ['info', '信息'],
};

const FEEDBACK_CATEGORY_ALIASES = {
  requirement_gap: ['requirement gap', '需求缺口'],
  implementation_bug: ['implementation bug', 'bug', '缺陷'],
  workflow_flaw: ['workflow flaw', '流程问题'],
  tooling_issue: ['tooling issue', '工具问题'],
  process_issue: ['process issue', '流程缺陷'],
};

const VALIDATION_REPORT_OUTCOME_ALIASES = {
  conformant: ['conformant', 'passing', 'pass'],
  advisory: ['advisory'],
  blocking: ['blocking'],
};

const VALIDATION_RESULT_SEVERITY_ALIASES = {
  info: ['info', 'informational'],
  warning: ['warning', 'warnings'],
  violation: ['violation', 'violations'],
};

function containsAny(value, candidates) {
  return candidates.some((candidate) => value.includes(candidate));
}

function hasChinese(value) {
  return /[\u4e00-\u9fff]/.test(value);
}

function localize(prompt, zh, en) {
  return hasChinese(prompt) ? zh : en;
}

function findPage(pages, path) {
  return pages.find((page) => page.path === path) ?? null;
}

function resolveSection(page, preferred) {
  if (!page) {
    return preferred ?? null;
  }

  if (preferred && page.sections.some((section) => section.id === preferred)) {
    return preferred;
  }

  return page.default_section_id ?? page.sections[0]?.id ?? null;
}

function fallbackPage(pages, fallbackPath) {
  return findPage(pages, fallbackPath) ?? findPage(pages, '/') ?? pages[0] ?? null;
}

function resolveNavigationTarget(pages, path, preferredSectionId, fallbackPath = '/') {
  const requestedPage = findPage(pages, path);
  const page = requestedPage ?? fallbackPage(pages, fallbackPath);

  return {
    matchedRequestedPath: Boolean(requestedPage),
    path: page?.path ?? fallbackPath ?? path ?? '/',
    section_id: resolveSection(page, requestedPage ? preferredSectionId : null),
  };
}

function buildNavigationPayload(pages, {
  path,
  sectionId = null,
  query = {},
  adjustments = [],
  fallbackPath = '/',
}) {
  const target = resolveNavigationTarget(pages, path, sectionId, fallbackPath);

  return {
    navigation: {
      path: target.path,
      query: target.matchedRequestedPath ? query : {},
      section_id: target.section_id,
      source: 'assistant',
    },
    page_adjustments: target.matchedRequestedPath ? adjustments : [],
  };
}

function buildReadPlan(prompt, pages, {
  answer,
  confidence = 0.8,
  path,
  sectionId = null,
  query = {},
  adjustments = [],
  fallbackPath = '/',
}) {
  const { navigation, page_adjustments } = buildNavigationPayload(pages, {
    path,
    sectionId,
    query,
    adjustments,
    fallbackPath,
  });

  return {
    mode: 'read',
    answer,
    confidence,
    navigation,
    page_adjustments,
    proposed_action: null,
  };
}

function buildMutationPlan(prompt, pages, {
  answer,
  confidence = 0.74,
  path,
  sectionId = 'create',
  query = {},
  adjustments = [],
  action,
  fallbackPath = '/',
}) {
  const { navigation, page_adjustments } = buildNavigationPayload(pages, {
    path,
    sectionId,
    query,
    adjustments,
    fallbackPath,
  });

  return {
    mode: 'mutate',
    answer,
    confidence,
    navigation,
    page_adjustments,
    proposed_action: action,
  };
}

function detectEntity(prompt) {
  return ENTITY_DEFINITIONS.find((entity) => containsAny(prompt, entity.aliases)) ?? null;
}

function detectStatus(prompt) {
  for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
    if (containsAny(prompt, aliases)) {
      return status;
    }
  }
  return null;
}

function detectSeverity(prompt) {
  for (const [severity, aliases] of Object.entries(SEVERITY_ALIASES)) {
    if (containsAny(prompt, aliases)) {
      return severity;
    }
  }
  return null;
}

function detectFeedbackCategory(prompt) {
  for (const [category, aliases] of Object.entries(FEEDBACK_CATEGORY_ALIASES)) {
    if (containsAny(prompt, aliases)) {
      return category;
    }
  }
  return null;
}

function detectValidationReportOutcome(prompt) {
  for (const [outcome, aliases] of Object.entries(VALIDATION_REPORT_OUTCOME_ALIASES)) {
    if (containsAny(prompt, aliases)) {
      return outcome;
    }
  }
  return null;
}

function detectValidationResultSeverity(prompt) {
  for (const [severity, aliases] of Object.entries(VALIDATION_RESULT_SEVERITY_ALIASES)) {
    if (containsAny(prompt, aliases)) {
      return severity;
    }
  }
  return null;
}

function filtersForEntity(entity, prompt) {
  const status = detectStatus(prompt);

  switch (entity?.type) {
    case 'feedback': {
      const severity = detectSeverity(prompt);
      return [
        ...(status ? [{ field: 'status', key: 'status', matchValue: status, queryValue: status, label: status }] : []),
        ...(severity
          ? [{ field: 'data.severity', key: 'severity', matchValue: severity, queryValue: severity, label: severity }]
          : []),
      ];
    }
    case 'validation-report': {
      const outcome = detectValidationReportOutcome(prompt);
      return [
        ...(status ? [{ field: 'status', key: 'status', matchValue: status, queryValue: status, label: status }] : []),
        ...(outcome
          ? [{ field: 'data.outcome', key: 'outcome', matchValue: outcome, queryValue: outcome, label: outcome }]
          : []),
      ];
    }
    case 'validation-result': {
      const severity = detectValidationResultSeverity(prompt);
      return [
        ...(status ? [{ field: 'status', key: 'status', matchValue: status, queryValue: status, label: status }] : []),
        ...(severity
          ? [{ field: 'data.severity', key: 'severity', matchValue: severity, queryValue: severity, label: severity }]
          : []),
      ];
    }
    default:
      return status
        ? [{ field: 'status', key: 'status', matchValue: status, queryValue: status, label: status }]
        : [];
  }
}

function isCountIntent(prompt) {
  return containsAny(prompt, [
    'how many',
    'count',
    '多少',
    '几条',
    '几个',
    '数量',
  ]);
}

function isRankingIntent(prompt) {
  return containsAny(prompt, [
    'ranking',
    'rank',
    'leaderboard',
    '排行',
    '排名',
    '榜单',
  ]);
}

function isCreateRequirementIntent(prompt) {
  return containsAny(prompt, [
    'create requirement',
    'new requirement',
    '新增需求',
    '创建需求',
    '新建需求',
  ]);
}

function isCreateSessionIntent(prompt) {
  return containsAny(prompt, [
    'create session',
    'new session',
    '创建 session',
    '创建会话',
    '新建会话',
  ]);
}

function isCreateFeedbackIntent(prompt) {
  return containsAny(prompt, [
    'create feedback',
    'new feedback',
    '创建反馈',
    '新建反馈',
    '提交反馈',
  ]);
}

function isTransitionIntent(prompt) {
  return containsAny(prompt, [
    'set ',
    'move ',
    'change ',
    'archive ',
    'deprecate ',
    'activate ',
    'resolve ',
    '创建为',
    '改为',
    '切换到',
    '归档',
    '废弃',
    '关闭',
    '解决',
  ]);
}

function toAcceptanceCriteria(lines) {
  return lines.map((description, index) => ({
    id: `ac${index + 1}`,
    description,
    satisfied: false,
  }));
}

function stripCommandPrefix(prompt, aliases) {
  for (const alias of aliases) {
    const index = prompt.toLowerCase().indexOf(alias);
    if (index !== -1) {
      return prompt.slice(index + alias.length).replace(/^[\s:：-]+/, '').trim();
    }
  }
  return prompt.trim();
}

function parseRequirementDraft(prompt) {
  const body = stripCommandPrefix(prompt, [
    'create requirement',
    'new requirement',
    '创建需求',
    '新建需求',
    '新增需求',
  ]);
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletPattern = /^([-*+]|\d+\.)\s+/;
  const priority =
    detectSeverity(prompt) === 'critical' || prompt.toLowerCase().includes('priority critical')
      ? 'critical'
      : prompt.toLowerCase().includes('priority medium') || prompt.includes('中优先级')
        ? 'medium'
        : prompt.toLowerCase().includes('priority low') || prompt.includes('低优先级')
          ? 'low'
          : 'high';

  const name = lines[0] ?? '';
  const rest = lines.slice(1);
  const acceptanceLines = rest
    .filter((line) => bulletPattern.test(line))
    .map((line) => line.replace(bulletPattern, '').trim())
    .filter(Boolean);
  const descriptionLines = rest.filter((line) => !bulletPattern.test(line));
  const description =
    descriptionLines.join('\n') ||
    rest.join('\n') ||
    name;
  const criteria = acceptanceLines.length > 0
    ? acceptanceLines
    : description
      ? [description]
      : [];

  return {
    payload: {
      name,
      description,
      priority,
      acceptance_criteria: toAcceptanceCriteria(criteria),
    },
    missing_inputs: [
      ...(name ? [] : ['name']),
      ...(description ? [] : ['description']),
    ],
  };
}

function extractIdAfter(prompt, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s+([a-z0-9][a-z0-9-_]*)`, 'i');
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return '';
}

function extractIdsAfter(prompt, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s+([a-z0-9,_\\s-]+)`, 'i');
    const match = prompt.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    return match[1]
      .split(/[,\s]+/)
      .map((token) => token.trim())
      .filter((token) => /^[a-z0-9][a-z0-9-_]*$/i.test(token));
  }
  return [];
}

function extractQuotedValue(prompt) {
  const match = prompt.match(/["“](.+?)["”]/);
  return match?.[1]?.trim() ?? '';
}

function parseSessionDraft(prompt) {
  const quotedName = extractQuotedValue(prompt);
  const requirementId = extractIdAfter(prompt, ['requirement', '需求']);
  const milestoneId = extractIdAfter(prompt, ['milestone', '里程碑']);
  const taskIds = extractIdsAfter(prompt, ['tasks', 'task', '任务']);
  const fallbackName = [requirementId, milestoneId].filter(Boolean).join(' / ');

  return {
    payload: {
      name: quotedName || (fallbackName ? `Session ${fallbackName}` : ''),
      requirement_id: requirementId,
      milestone_id: milestoneId,
      task_ids: taskIds,
    },
    missing_inputs: [
      ...((quotedName || fallbackName) ? [] : ['name']),
      ...(requirementId ? [] : ['requirement_id']),
      ...(milestoneId ? [] : ['milestone_id']),
      ...(taskIds.length > 0 ? [] : ['task_ids']),
    ],
  };
}

function parseFeedbackDraft(prompt) {
  const severity = detectSeverity(prompt) ?? 'major';
  const category = detectFeedbackCategory(prompt) ?? 'implementation_bug';
  const targetType = detectEntity(prompt)?.type ?? 'task';
  const targetId = extractIdAfter(prompt, [
    'target',
    targetType,
    '目标',
  ]);
  const sourceSessionId = extractIdAfter(prompt, ['session', 'source session', '会话']);
  const description = stripCommandPrefix(prompt, [
    'create feedback',
    'new feedback',
    '创建反馈',
    '新建反馈',
    '提交反馈',
  ]);

  return {
    payload: {
      severity,
      category,
      target: {
        type: targetType,
        id: targetId,
        field: null,
      },
      description,
      proposed_action: null,
      source_session_id: sourceSessionId || null,
    },
    missing_inputs: [
      ...(targetId ? [] : ['target.id']),
      ...(description ? [] : ['description']),
    ],
  };
}

function parseTransitionDraft(prompt) {
  const entity = detectEntity(prompt);
  const nextStatus = detectStatus(prompt) ?? '';
  const artifactId = entity
    ? extractIdAfter(prompt, [entity.singular, entity.plural, ...entity.aliases])
    : '';

  return {
    payload: {
      artifact_type: entity?.type ?? 'task',
      artifact_id: artifactId,
      next_status: nextStatus,
    },
    missing_inputs: [
      ...(entity ? [] : ['artifact_type']),
      ...(artifactId ? [] : ['artifact_id']),
      ...(nextStatus ? [] : ['next_status']),
    ],
  };
}

function detailPathForArtifact(type, id) {
  switch (type) {
    case 'requirement':
      return `/requirements/${id}`;
    case 'session':
      return `/sessions/${id}`;
    case 'task':
      return `/tasks/${id}`;
    case 'workflow':
      return `/workflows/${id}`;
    default:
      return null;
  }
}

const CLOUD_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'answer', 'confidence', 'navigation', 'page_adjustments', 'action'],
  properties: {
    mode: {
      type: 'string',
      enum: ['read', 'mutate'],
    },
    answer: {
      type: 'string',
    },
    confidence: {
      type: 'number',
    },
    navigation: {
      type: 'object',
      additionalProperties: false,
      required: ['should_navigate', 'path', 'section_id', 'query_items'],
      properties: {
        should_navigate: {
          type: 'boolean',
        },
        path: {
          type: 'string',
        },
        section_id: {
          type: ['string', 'null'],
        },
        query_items: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'value'],
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    page_adjustments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'value', 'scope'],
        properties: {
          key: {
            type: 'string',
          },
          value: {
            type: 'string',
          },
          scope: {
            type: 'string',
            enum: ['query'],
          },
        },
      },
    },
    action: {
      type: 'object',
      additionalProperties: false,
      required: [
        'kind',
        'title',
        'description',
        'ready',
        'confirmation_required',
        'missing_inputs',
        'target_artifact_type',
        'target_artifact_id',
        'payload_json',
      ],
      properties: {
        kind: {
          type: 'string',
          enum: [
            'none',
            'create-requirement',
            'create-session',
            'create-feedback',
            'transition-artifact',
          ],
        },
        title: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        ready: {
          type: 'boolean',
        },
        confirmation_required: {
          type: 'boolean',
        },
        missing_inputs: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        target_artifact_type: {
          type: 'string',
        },
        target_artifact_id: {
          type: 'string',
        },
        payload_json: {
          type: 'string',
        },
      },
    },
  },
};

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeQueryItems(items) {
  if (!Array.isArray(items)) {
    return {};
  }
  return Object.fromEntries(
    items
      .map((item) => [
        typeof item?.key === 'string' ? item.key.trim() : '',
        typeof item?.value === 'string' ? item.value : '',
      ])
      .filter(([key]) => key),
  );
}

function normalizeCloudPlan(raw, { currentPath = '/', pages = [] } = {}) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const mode = raw.mode === 'mutate' ? 'mutate' : 'read';
  const answer =
    typeof raw.answer === 'string' && raw.answer.trim()
      ? raw.answer.trim()
      : 'I could not build a valid assistant plan.';
  const confidence = Math.max(
    0,
    Math.min(1, Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0.5),
  );
  const shouldNavigate = raw.navigation?.should_navigate === true;
  const requestedPath =
    shouldNavigate && typeof raw.navigation?.path === 'string' && raw.navigation.path.trim()
      ? raw.navigation.path.trim()
      : currentPath;
  const normalizedAdjustments = Array.isArray(raw.page_adjustments)
    ? raw.page_adjustments
      .filter((item) => item?.scope === 'query' && typeof item?.key === 'string')
      .map((item) => ({
        key: item.key.trim(),
        value: typeof item.value === 'string' ? item.value : '',
        scope: 'query',
      }))
      .filter((item) => item.key)
    : [];
  const { navigation, page_adjustments: pageAdjustments } = buildNavigationPayload(pages, {
    path: requestedPath,
    sectionId:
      typeof raw.navigation?.section_id === 'string' && raw.navigation.section_id.trim()
        ? raw.navigation.section_id.trim()
        : null,
    query: shouldNavigate ? normalizeQueryItems(raw.navigation.query_items) : {},
    adjustments: shouldNavigate ? normalizedAdjustments : [],
    fallbackPath: currentPath,
  });

  if (mode === 'read' || raw.action?.kind === 'none') {
    return {
      mode: 'read',
      answer,
      confidence,
      navigation,
      page_adjustments: pageAdjustments,
      proposed_action: null,
    };
  }

  const payload =
    typeof raw.action?.payload_json === 'string' && raw.action.payload_json.trim()
      ? parseJsonSafe(raw.action.payload_json)
      : null;
  const target =
    typeof raw.action?.target_artifact_type === 'string' &&
    typeof raw.action?.target_artifact_id === 'string' &&
    raw.action.target_artifact_type.trim() &&
    raw.action.target_artifact_id.trim()
      ? {
          artifact_type: raw.action.target_artifact_type.trim(),
          artifact_id: raw.action.target_artifact_id.trim(),
        }
      : null;

  return {
    mode: 'mutate',
    answer,
    confidence,
    navigation,
    page_adjustments: pageAdjustments,
    proposed_action: {
      kind: raw.action.kind,
      title:
        typeof raw.action.title === 'string' && raw.action.title.trim()
          ? raw.action.title.trim()
          : 'Confirm action',
      description:
        typeof raw.action.description === 'string' && raw.action.description.trim()
          ? raw.action.description.trim()
          : 'Run the requested action.',
      ready: Boolean(raw.action.ready),
      confirmation_required: raw.action.confirmation_required !== false,
      missing_inputs: Array.isArray(raw.action.missing_inputs)
        ? raw.action.missing_inputs
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => item.trim())
        : [],
      target,
      payload,
    },
  };
}

function cloudAssistantPrompt(input) {
  return JSON.stringify({
    task: 'plan-ui-assistant',
    prompt: input.prompt ?? '',
    current_route: input.current_route ?? null,
    pages: input.pages ?? [],
    supported_actions: [
      {
        kind: 'create-requirement',
        payload_shape: {
          name: 'string',
          description: 'string',
          priority: 'critical|high|medium|low',
          acceptance_criteria: [{ id: 'ac1', description: 'string', satisfied: false }],
        },
      },
      {
        kind: 'create-session',
        payload_shape: {
          name: 'string',
          requirement_id: 'string',
          milestone_id: 'string',
          task_ids: ['string'],
        },
      },
      {
        kind: 'create-feedback',
        payload_shape: {
          severity: 'critical|major|minor|info',
          category: 'requirement_gap|implementation_bug|workflow_flaw|tooling_issue|process_issue',
          target: {
            type: 'artifact type',
            id: 'string',
            field: null,
          },
          description: 'string',
          proposed_action: null,
          source_session_id: null,
        },
      },
      {
        kind: 'transition-artifact',
        payload_shape: {
          artifact_type: 'artifact type',
          artifact_id: 'string',
          next_status: 'string',
        },
      },
    ],
  }, null, 2);
}

export function createUiAssistant({ list, registry, openai = null }) {
  async function localPlan(input = {}) {
    const promptRaw = `${input.prompt ?? ''}`.trim();
    const prompt = promptRaw.toLowerCase();
    const pages = Array.isArray(input.pages) ? input.pages : [];
    const fallbackPath = input.current_route?.path ?? '/';
    const createReadPlan = (options) => buildReadPlan(promptRaw, pages, { ...options, fallbackPath });
    const createMutationPlan = (options) => buildMutationPlan(promptRaw, pages, { ...options, fallbackPath });

    if (!promptRaw) {
      return createReadPlan({
        answer: localize(
          promptRaw,
          '请输入一个问题或动作。',
          'Enter a question or action.',
        ),
        confidence: 1,
        path: fallbackPath,
      });
    }

    if (isCreateRequirementIntent(prompt)) {
      const { payload, missing_inputs } = parseRequirementDraft(promptRaw);
      const ready = missing_inputs.length === 0;
      return createMutationPlan({
        answer: ready
          ? localize(
              promptRaw,
              '我已经起草了一个 Requirement。确认后会创建它，并跳转到详情页。',
              'I drafted a requirement. Confirm to create it and open the detail view.',
            )
          : localize(
              promptRaw,
              `我可以起草这个 Requirement，但还缺少 ${missing_inputs.join(', ')}。`,
              `I can draft this requirement, but I still need ${missing_inputs.join(', ')}.`,
            ),
        path: '/requirements',
        adjustments: [{ key: 'compose', value: '1', scope: 'query' }],
        action: {
          kind: 'create-requirement',
          title: 'Create requirement',
          description: ready
            ? localize(promptRaw, `创建 Requirement：${payload.name}`, `Create requirement: ${payload.name}`)
            : localize(promptRaw, '补齐缺失字段后即可创建 Requirement。', 'Fill the missing fields to create the requirement.'),
          ready,
          confirmation_required: true,
          missing_inputs,
          payload,
        },
      });
    }

    if (isCreateSessionIntent(prompt)) {
      const { payload, missing_inputs } = parseSessionDraft(promptRaw);
      const ready = missing_inputs.length === 0;
      return createMutationPlan({
        answer: ready
          ? localize(
              promptRaw,
              '我已经整理了 Session 草案。确认后会创建它。',
              'I prepared a session draft. Confirm to create it.',
            )
          : localize(
              promptRaw,
              `我可以创建 Session，但还缺少 ${missing_inputs.join(', ')}。`,
              `I can create the session, but I still need ${missing_inputs.join(', ')}.`,
            ),
        path: '/sessions',
        adjustments: [{ key: 'compose', value: '1', scope: 'query' }],
        action: {
          kind: 'create-session',
          title: 'Create session',
          description: ready
            ? localize(promptRaw, `创建 Session：${payload.name}`, `Create session: ${payload.name}`)
            : localize(promptRaw, '补齐 requirement、milestone 和 task IDs 后即可创建 Session。', 'Fill requirement, milestone, and task IDs to create the session.'),
          ready,
          confirmation_required: true,
          missing_inputs,
          payload,
        },
      });
    }

    if (isCreateFeedbackIntent(prompt)) {
      const { payload, missing_inputs } = parseFeedbackDraft(promptRaw);
      const ready = missing_inputs.length === 0;
      return createMutationPlan({
        answer: ready
          ? localize(
              promptRaw,
              '我已经准备好 Feedback 草案。确认后会提交它。',
              'I prepared a feedback draft. Confirm to submit it.',
            )
          : localize(
              promptRaw,
              `我可以创建 Feedback，但还缺少 ${missing_inputs.join(', ')}。`,
              `I can create the feedback, but I still need ${missing_inputs.join(', ')}.`,
            ),
        path: '/feedback',
        adjustments: [{ key: 'compose', value: '1', scope: 'query' }],
        action: {
          kind: 'create-feedback',
          title: 'Create feedback',
          description: ready
            ? localize(promptRaw, `提交 Feedback 到 ${payload.target.type}:${payload.target.id}`, `Submit feedback to ${payload.target.type}:${payload.target.id}`)
            : localize(promptRaw, '补齐目标和描述后即可提交 Feedback。', 'Fill the target and description to submit the feedback.'),
          ready,
          confirmation_required: true,
          missing_inputs,
          payload,
        },
      });
    }

    if (isTransitionIntent(prompt)) {
      const { payload, missing_inputs } = parseTransitionDraft(promptRaw);
      const ready = missing_inputs.length === 0;
      const detailPath = detailPathForArtifact(payload.artifact_type, payload.artifact_id);
      return createMutationPlan({
        answer: ready
          ? localize(
              promptRaw,
              `我已经准备好状态变更草案。确认后会把 ${payload.artifact_type} ${payload.artifact_id} 切换到 ${payload.next_status}。`,
              `I prepared the transition draft. Confirm to move ${payload.artifact_type} ${payload.artifact_id} to ${payload.next_status}.`,
            )
          : localize(
              promptRaw,
              `我可以执行状态变更，但还缺少 ${missing_inputs.join(', ')}。`,
              `I can perform the transition, but I still need ${missing_inputs.join(', ')}.`,
            ),
        path: detailPath ?? (ENTITY_DEFINITIONS.find((entity) => entity.type === payload.artifact_type)?.path ?? '/'),
        sectionId: detailPath ? 'summary' : 'records',
        action: {
          kind: 'transition-artifact',
          title: 'Transition artifact',
          description: ready
            ? localize(promptRaw, `切换到 ${payload.next_status}`, `Transition to ${payload.next_status}`)
            : localize(promptRaw, '补齐目标对象和目标状态后即可执行。', 'Fill the target artifact and destination status to execute the transition.'),
          ready,
          confirmation_required: true,
          missing_inputs,
          target: ready
            ? {
                artifact_type: payload.artifact_type,
                artifact_id: payload.artifact_id,
              }
            : null,
          payload,
        },
      });
    }

    if (isRankingIntent(prompt)) {
      const leaderboard = await registry.getAll();
      const taskTypes = Object.keys(leaderboard.rankings ?? {});
      const selectedTaskType =
        taskTypes.find((taskType) => prompt.includes(taskType.toLowerCase())) ??
        taskTypes[0] ??
        '';

      return createReadPlan({
        answer: selectedTaskType
          ? localize(
              promptRaw,
              `已跳转到 Workflow Ranking，并聚焦 ${selectedTaskType} 的榜单。`,
              `Opened workflow ranking and focused the ${selectedTaskType} leaderboard.`,
            )
          : localize(
              promptRaw,
              '已跳转到 Workflow Ranking。',
              'Opened workflow ranking.',
            ),
        confidence: 0.88,
        path: '/workflows/rankings',
        sectionId: 'records',
        adjustments: selectedTaskType
          ? [{ key: 'task_type', value: selectedTaskType, scope: 'query' }]
          : [],
      });
    }

    const entity = detectEntity(prompt);
    const entityFilters = entity ? filtersForEntity(entity, prompt) : [];
    const filterCriteria = Object.fromEntries(
      entityFilters.map(({ field, matchValue }) => [field, matchValue]),
    );
    const filterAdjustments = entityFilters.map(({ key, queryValue }) => ({
      key,
      value: `${queryValue}`,
      scope: 'query',
    }));
    const filterLabels = entityFilters.map(({ label }) => label);

    if (entity && isCountIntent(prompt)) {
      const items = await list(entity.type);
      const filteredItems = filterByFields(items, filterCriteria);
      const descriptor = [...filterLabels, entity.plural].filter(Boolean).join(' ') || entity.plural;
      const qualifier = filterLabels.join(' ');

      return createReadPlan({
        answer: localize(
          promptRaw,
          `当前共有 ${filteredItems.length} 个${qualifier ? `${qualifier} ` : ''}${entity.label_zh}。`,
          `There are ${filteredItems.length} ${descriptor}.`,
        ),
        confidence: 0.92,
        path: entity.path,
        sectionId: entityFilters.length > 0 ? 'records' : 'summary',
        adjustments: filterAdjustments,
      });
    }

    if (entity && (entityFilters.length > 0 || containsAny(prompt, ['show', '只看', 'filter', '筛选']))) {
      const descriptor = [...filterLabels, entity.plural].filter(Boolean).join(' ') || entity.plural;
      return createReadPlan({
        answer: localize(
          promptRaw,
          `已跳转到 ${filterLabels.length > 0 ? `${filterLabels.join(' ')} ` : ''}${entity.label_zh} 页面。`,
          `Opened ${descriptor}.`,
        ),
        confidence: 0.82,
        path: entity.path,
        sectionId: 'records',
        adjustments: filterAdjustments,
      });
    }

    if (entity) {
      return createReadPlan({
        answer: localize(
          promptRaw,
          `已跳转到 ${entity.label_zh} 页面。`,
          `Opened ${entity.plural}.`,
        ),
        confidence: 0.68,
        path: entity.path,
        sectionId: 'summary',
      });
    }

    return createReadPlan({
      answer: localize(
        promptRaw,
        '我先带你回到 Dashboard，你也可以继续问更具体的问题。',
        'I moved you back to the dashboard. Ask a more specific question and I can route you further.',
      ),
      confidence: 0.46,
      path: '/',
      sectionId: 'summary',
    });
  }

  return {
    async plan(input = {}) {
      if (openai?.completeJson) {
        try {
          const remote = await openai.completeJson({
            instructions: [
              'You are the dp-ring UI assistant planner.',
              'Return a single JSON object matching the provided schema.',
              'Only navigate to paths that exist in the provided pages list.',
              'Use action.kind = "none" when the request is informational or ambiguous.',
              'Prefer confirmation-required mutations and never assume missing IDs.',
            ].join(' '),
            input: cloudAssistantPrompt(input),
            schemaName: 'ring_ui_assistant_plan',
            schema: CLOUD_PLAN_SCHEMA,
            reasoning: {
              effort: 'medium',
            },
            metadata: {
              feature: 'ui-assistant',
            },
          });
          const plan = normalizeCloudPlan(remote.parsed, {
            currentPath: input.current_route?.path ?? '/',
            pages: Array.isArray(input.pages) ? input.pages : [],
          });
          if (plan) {
            return plan;
          }
        } catch {
          // Fall back to local deterministic planner when cloud planning is unavailable.
        }
      }

      return localPlan(input);
    },
  };
}
