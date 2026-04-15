import type { UiConfig, UiThemeTemplate } from "@ring-gui/types/api";

export type ThemeMode = UiConfig["theme"]["mode"];
export type ResolvedTheme = "light" | "dark";

export interface LayoutConfig {
  sidebar_width_px: number;
  content_padding_px: number;
  panel_radius_px: number;
}

export interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  templateId: string;
  templates: UiThemeTemplate[];
  layout: LayoutConfig;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setTemplate: (templateId: string) => Promise<void>;
  updateLayout: (layoutPatch: Partial<LayoutConfig>) => Promise<void>;
}
