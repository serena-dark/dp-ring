import type { ResolvedTheme, ThemeMode } from "@ring-gui/lib/theme";
import type { OpenAiStatus, UiThemeTemplate } from "@ring-gui/types/api";

export interface SettingsOAuthModel {
  configured: boolean;
  sessionConnected: boolean;
  connectAllowed: boolean;
  readinessLabel: string;
  sessionLabel: string;
  detail: string;
}

export function getActiveThemeLabel(
  theme: ThemeMode,
  resolvedTheme: ResolvedTheme,
): string {
  if (theme === "system") {
    return `System / ${resolvedTheme === "dark" ? "Dark" : "Light"}`;
  }
  return theme === "dark" ? "Dark" : "Light";
}

export function getSelectedTemplate(
  templates: UiThemeTemplate[],
  templateId: string,
): UiThemeTemplate | null {
  return templates.find((template) => template.id === templateId) ?? templates[0] ?? null;
}

export function buildSettingsOAuthModel(
  status: OpenAiStatus | null,
): SettingsOAuthModel {
  const configured = Boolean(status?.oauth.configured);
  const sessionConnected = Boolean(status?.session.connected);

  if (!configured) {
    return {
      configured,
      sessionConnected,
      connectAllowed: false,
      readinessLabel: "OAuth Not Configured",
      sessionLabel: sessionConnected ? "Session Connected" : "Session Idle",
      detail:
        "This machine is missing OPENAI_OAUTH_CLIENT_ID / OPENAI_OAUTH_CLIENT_SECRET / OPENAI_OAUTH_REDIRECT_URI, so there is no valid link to open yet.",
    };
  }

  return {
    configured,
    sessionConnected,
    connectAllowed: true,
    readinessLabel: "OAuth Ready",
    sessionLabel: sessionConnected ? "Session Connected" : "Session Idle",
    detail:
      "The backend can mint the OpenAI authorization URL and complete the callback automatically.",
  };
}
