import type { UiConfig, UiThemeTemplate } from "@ring-gui/types/api";
import type { ResolvedTheme } from "@ring-gui/lib/theme/types";

const appliedThemeKeys = new Set<string>();

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function selectThemeTemplate(
  templates: UiThemeTemplate[],
  templateId: string,
): UiThemeTemplate | null {
  return (
    templates.find((template) => template.id === templateId) ?? templates[0] ?? null
  );
}

export function applyDocumentTheme(
  config: UiConfig,
  templates: UiThemeTemplate[],
  resolvedTheme: ResolvedTheme,
) {
  const root = document.documentElement;
  const selectedTemplate = selectThemeTemplate(templates, config.theme.template_id);
  const nextTokens = selectedTemplate?.tokens?.[resolvedTheme] ?? {};

  root.dataset.theme = resolvedTheme;
  root.dataset.themeTemplate = selectedTemplate?.id ?? "";
  root.style.colorScheme = resolvedTheme;

  for (const key of [...appliedThemeKeys]) {
    if (!(key in nextTokens)) {
      root.style.removeProperty(key);
      appliedThemeKeys.delete(key);
    }
  }

  for (const [key, value] of Object.entries(nextTokens)) {
    root.style.setProperty(key, value);
    appliedThemeKeys.add(key);
  }

  root.style.setProperty(
    "--layout-sidebar-width",
    `${config.layout.sidebar_width_px}px`,
  );
  root.style.setProperty(
    "--layout-content-padding",
    `${config.layout.content_padding_px}px`,
  );
  root.style.setProperty(
    "--layout-panel-radius",
    `${config.layout.panel_radius_px}px`,
  );
}
