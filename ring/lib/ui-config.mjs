import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_THEME_TEMPLATES } from './theme-presets.mjs';

const DEFAULT_UI_CONFIG = {
  schema_version: 1,
  theme: {
    mode: 'system',
    template_id: 'ring-console',
  },
  layout: {
    sidebar_width_px: 272,
    content_padding_px: 24,
    panel_radius_px: 16,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeThemeMode(value) {
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : DEFAULT_UI_CONFIG.theme.mode;
}

function normalizeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function normalizeTokenMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => key.startsWith('--') && typeof item === 'string' && item.trim()),
  );
}

function normalizeTemplate(input, index) {
  const id =
    typeof input?.id === 'string' && input.id.trim()
      ? input.id.trim()
      : `theme-${index + 1}`;
  const label =
    typeof input?.label === 'string' && input.label.trim()
      ? input.label.trim()
      : id;
  const description =
    typeof input?.description === 'string' ? input.description.trim() : '';

  return {
    id,
    label,
    description,
    tokens: {
      light: normalizeTokenMap(input?.tokens?.light),
      dark: normalizeTokenMap(input?.tokens?.dark),
    },
  };
}

function mergeThemeTemplates(rawTemplates) {
  const merged = new Map(
    DEFAULT_THEME_TEMPLATES.map((template, index) => [
      template.id,
      normalizeTemplate(template, index),
    ]),
  );

  if (Array.isArray(rawTemplates)) {
    rawTemplates.forEach((template, index) => {
      const normalized = normalizeTemplate(template, index);
      const existing = merged.get(normalized.id);
      merged.set(normalized.id, {
        ...normalized,
        tokens: {
          light: {
            ...(existing?.tokens?.light ?? {}),
            ...normalized.tokens.light,
          },
          dark: {
            ...(existing?.tokens?.dark ?? {}),
            ...normalized.tokens.dark,
          },
        },
      });
    });
  }

  return [...merged.values()];
}

function mergeUiConfig(raw, templates) {
  const templateIds = new Set(templates.map((template) => template.id));
  const requestedTemplateId =
    typeof raw?.theme?.template_id === 'string'
      ? raw.theme.template_id
      : '';
  const templateId = templateIds.has(requestedTemplateId)
    ? requestedTemplateId
    : DEFAULT_UI_CONFIG.theme.template_id;

  return {
    ...DEFAULT_UI_CONFIG,
    ...raw,
    theme: {
      ...DEFAULT_UI_CONFIG.theme,
      ...(raw?.theme ?? {}),
      mode: normalizeThemeMode(raw?.theme?.mode),
      template_id: templateId,
    },
    layout: {
      ...DEFAULT_UI_CONFIG.layout,
      ...(raw?.layout ?? {}),
      sidebar_width_px: normalizeNumber(
        raw?.layout?.sidebar_width_px,
        DEFAULT_UI_CONFIG.layout.sidebar_width_px,
      ),
      content_padding_px: normalizeNumber(
        raw?.layout?.content_padding_px,
        DEFAULT_UI_CONFIG.layout.content_padding_px,
      ),
      panel_radius_px: normalizeNumber(
        raw?.layout?.panel_radius_px,
        DEFAULT_UI_CONFIG.layout.panel_radius_px,
      ),
    },
  };
}

export async function createUiConfig(repoRoot) {
  const uiDir = join(repoRoot, '.ring', 'ui');
  const configPath = join(uiDir, 'config.json');
  const themesPath = join(uiDir, 'theme-templates.json');

  async function ensureDir() {
    await mkdir(uiDir, { recursive: true });
  }

  async function getThemes() {
    await ensureDir();

    try {
      const raw = JSON.parse(await readFile(themesPath, 'utf-8'));
      const templates = mergeThemeTemplates(raw);
      await writeFile(themesPath, JSON.stringify(templates, null, 2) + '\n', 'utf-8');
      return templates;
    } catch {
      const templates = clone(DEFAULT_THEME_TEMPLATES);
      await writeFile(themesPath, JSON.stringify(templates, null, 2) + '\n', 'utf-8');
      return templates;
    }
  }

  async function getConfig() {
    await ensureDir();
    const templates = await getThemes();

    try {
      const raw = JSON.parse(await readFile(configPath, 'utf-8'));
      const config = mergeUiConfig(raw, templates);
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      return config;
    } catch {
      const config = mergeUiConfig(DEFAULT_UI_CONFIG, templates);
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      return config;
    }
  }

  async function updateConfig(patch) {
    const templates = await getThemes();
    const existing = await getConfig();
    const next = mergeUiConfig(
      {
        ...existing,
        ...patch,
        theme: {
          ...existing.theme,
          ...(patch?.theme ?? {}),
        },
        layout: {
          ...existing.layout,
          ...(patch?.layout ?? {}),
        },
      },
      templates,
    );
    await writeFile(configPath, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    return next;
  }

  return {
    getConfig,
    updateConfig,
    getThemes,
  };
}
