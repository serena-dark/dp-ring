import { type ReactNode, useEffect, useState } from "react";
import { ui } from "@ring-gui/api/client";
import { ThemeContext } from "@ring-gui/lib/theme/context";
import { applyDocumentTheme, getSystemTheme } from "@ring-gui/lib/theme/apply-theme";
import type {
  LayoutConfig,
  ResolvedTheme,
  ThemeMode,
} from "@ring-gui/lib/theme/types";
import type { UiConfig, UiConfigPatch, UiThemeTemplate } from "@ring-gui/types/api";

const FALLBACK_CONFIG: UiConfig = {
  schema_version: 1,
  theme: {
    mode: "system",
    template_id: "ring-console",
  },
  layout: {
    sidebar_width_px: 272,
    content_padding_px: 24,
    panel_radius_px: 16,
  },
};

function resolveTheme(theme: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === "system" ? systemTheme : theme;
}

function mergeConfigPatch(existing: UiConfig, patch: UiConfigPatch): UiConfig {
  return {
    ...existing,
    ...patch,
    theme: {
      ...existing.theme,
      ...(patch.theme ?? {}),
    },
    layout: {
      ...existing.layout,
      ...(patch.layout ?? {}),
    },
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<UiConfig>(FALLBACK_CONFIG);
  const [templates, setTemplates] = useState<UiThemeTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    getSystemTheme(),
  );

  const resolvedTheme = resolveTheme(config.theme.mode, systemTheme);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const [configResponse, themesResponse] = await Promise.all([
        ui.config.read(),
        ui.themes.list(),
      ]);

      if (cancelled) {
        return;
      }

      if (configResponse.ok && configResponse.data) {
        setConfig(configResponse.data);
      }

      if (themesResponse.ok && themesResponse.data) {
        setTemplates(themesResponse.data);
      }

      if (!configResponse.ok || !themesResponse.ok) {
        setError(
          configResponse.ok
            ? !themesResponse.ok
              ? themesResponse.error ?? "Failed to load theme templates."
              : "Failed to load theme templates."
            : configResponse.error ?? "Failed to load UI config.",
        );
      } else {
        setError(null);
      }

      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyDocumentTheme(config, templates, resolvedTheme);
  }, [config, resolvedTheme, templates]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  async function persistConfig(patch: UiConfigPatch) {
    const previous = config;
    const optimistic = mergeConfigPatch(previous, patch);

    setConfig(optimistic);
    setIsSaving(true);
    setError(null);

    const response = await ui.config.update(patch);

    if (!response.ok) {
      setConfig(previous);
      setError(response.error ?? "Failed to save UI config.");
      setIsSaving(false);
      return;
    }

    setConfig(response.data);
    setIsSaving(false);
  }

  async function setTheme(theme: ThemeMode) {
    await persistConfig({
      theme: {
        mode: theme,
      },
    });
  }

  async function setTemplate(templateId: string) {
    await persistConfig({
      theme: {
        template_id: templateId,
      },
    });
  }

  async function updateLayout(layoutPatch: Partial<LayoutConfig>) {
    await persistConfig({
      layout: layoutPatch,
    });
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: config.theme.mode,
        resolvedTheme,
        templateId: config.theme.template_id,
        templates,
        layout: config.layout,
        isLoading,
        isSaving,
        error,
        setTheme,
        setTemplate,
        updateLayout,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
