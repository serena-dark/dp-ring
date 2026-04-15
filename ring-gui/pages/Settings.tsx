import { type CSSProperties, type FormEvent, useEffect, useState } from "react";
import { openai as openaiApi } from "@ring-gui/api/client";
import { PageSection } from "@ring-gui/components/PageSection";
import { useRouter } from "@ring-gui/lib/router";
import {
  buildSettingsOAuthModel,
  getActiveThemeLabel,
  getSelectedTemplate,
} from "@ring-gui/lib/settings-state";
import { useTheme, type ThemeMode } from "@ring-gui/lib/theme";
import type {
  OpenAiStatus,
  UiThemeTemplate,
} from "@ring-gui/types/api";

const OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  description: string;
}> = [
  {
    value: "system",
    label: "System",
    description: "Follow OS preference",
  },
  {
    value: "light",
    label: "Light",
    description: "Neutral light console",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Low-glare dark console",
  },
];
function getPrimaryFontName(stack: string | undefined) {
  const primary = stack?.split(",")[0]?.trim().replaceAll('"', "");
  return primary && primary.length > 0 ? primary : "System";
}

function getTemplatePreviewStyle(
  template: UiThemeTemplate,
  resolvedTheme: "light" | "dark",
): CSSProperties {
  const tokens = template.tokens[resolvedTheme] ?? {};
  return {
    ["--preview-bg" as string]: tokens["--theme-bg"] ?? "var(--bg)",
    ["--preview-panel" as string]: tokens["--theme-panel"] ?? "var(--panel)",
    ["--preview-text" as string]: tokens["--theme-text"] ?? "var(--text)",
    ["--preview-muted" as string]: tokens["--theme-muted"] ?? "var(--muted)",
    ["--preview-line" as string]: tokens["--theme-line"] ?? "var(--line)",
    ["--preview-accent" as string]: tokens["--theme-accent"] ?? "var(--accent)",
    ["--preview-display-font" as string]:
      tokens["--theme-font-display"] ?? "var(--font-display)",
    ["--preview-body-font" as string]:
      tokens["--theme-font-body"] ?? "var(--font-body)",
    ["--preview-display-tracking" as string]:
      tokens["--theme-letter-spacing-display"] ?? "var(--display-tracking)",
    ["--preview-radius-card" as string]:
      tokens["--theme-radius-card"] ?? "var(--radius-card)",
    ["--preview-radius-control" as string]:
      tokens["--theme-radius-control"] ?? "var(--radius-control)",
    ["--preview-border-width" as string]:
      tokens["--theme-border-width"] ?? "var(--theme-border-width)",
    ["--preview-border-style" as string]:
      tokens["--theme-border-style"] ?? "var(--theme-border-style)",
  } as CSSProperties;
}

function getTemplatePreviewMeta(
  template: UiThemeTemplate,
  resolvedTheme: "light" | "dark",
) {
  const tokens = template.tokens[resolvedTheme] ?? {};
  const displayFont = getPrimaryFontName(tokens["--theme-font-display"]);
  const borderWidth = tokens["--theme-border-width"] ?? "1px";
  const borderStyle = tokens["--theme-border-style"] ?? "solid";
  const radius = tokens["--theme-radius-card"] ?? "16px";
  return `${displayFont} · ${borderWidth} ${borderStyle} · ${radius}`;
}

export default function Settings() {
  const {
    error,
    isLoading,
    isSaving,
    layout,
    resolvedTheme,
    setTemplate,
    setTheme,
    templateId,
    templates,
    theme,
    updateLayout,
  } = useTheme();
  const { pathname, search, navigate } = useRouter();
  const [layoutDraft, setLayoutDraft] = useState(layout);
  const [openAiStatus, setOpenAiStatus] = useState<OpenAiStatus | null>(null);
  const [openAiLoading, setOpenAiLoading] = useState(true);
  const [openAiBusy, setOpenAiBusy] = useState(false);
  const [openAiError, setOpenAiError] = useState<string | null>(null);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);

  const selectedTemplate = getSelectedTemplate(templates, templateId);
  const activeThemeLabel = getActiveThemeLabel(theme, resolvedTheme);
  const oauthModel = buildSettingsOAuthModel(openAiStatus);

  useEffect(() => {
    setLayoutDraft(layout);
  }, [layout]);

  useEffect(() => {
    let cancelled = false;

    async function loadOpenAiStatus() {
      setOpenAiLoading(true);
      const response = await openaiApi.status();
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setOpenAiError(response.error ?? "Failed to load OpenAI status.");
        setOpenAiStatus(null);
      } else {
        setOpenAiStatus(response.data);
        setOpenAiError(null);
      }
      setOpenAiLoading(false);
    }

    void loadOpenAiStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(search);
    const code = query.get("code");
    const state = query.get("state");
    const providerError = query.get("error");
    const providerErrorDescription = query.get("error_description");

    if (providerError) {
      setOpenAiError(providerErrorDescription ?? providerError);
      navigate({ path: pathname }, { replace: true, scroll: false });
      return;
    }

    if (!code && !state) {
      return;
    }

    let cancelled = false;

    async function completeOAuth() {
      setOpenAiBusy(true);
      if (!code || !state) {
        setOpenAiError("OpenAI OAuth redirect is missing code or state.");
        navigate({ path: pathname }, { replace: true, scroll: false });
        setOpenAiBusy(false);
        return;
      }

      const response = await openaiApi.oauth.complete({ code, state });

      if (cancelled) {
        return;
      }

      navigate({ path: pathname }, { replace: true, scroll: false });

      if (!response.ok) {
        setOpenAiError(response.error ?? "OpenAI OAuth token exchange failed.");
      } else {
        const statusResponse = await openaiApi.status();
        if (statusResponse.ok) {
          setOpenAiStatus(statusResponse.data);
        }
        setOpenAiError(null);
      }

      setOpenAiBusy(false);
    }

    void completeOAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate, pathname, search]);

  async function handleLayoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateLayout(layoutDraft);
  }

  async function reloadOpenAiStatus() {
    setOpenAiBusy(true);
    const response = await openaiApi.status();
    if (!response.ok) {
      setOpenAiError(response.error ?? "Failed to refresh OpenAI status.");
    } else {
      setOpenAiStatus(response.data);
      setOpenAiError(null);
    }
    setOpenAiBusy(false);
  }

  async function handleConnectOpenAi() {
    if (!oauthModel.connectAllowed) {
      setOpenAiError(
        "Backend OAuth is not configured. Add OPENAI_OAUTH_CLIENT_ID, OPENAI_OAUTH_CLIENT_SECRET, and OPENAI_OAUTH_REDIRECT_URI, then restart the stack.",
      );
      return;
    }

    setOpenAiBusy(true);
    const response = await openaiApi.oauth.start({ prompt: "consent" });
    if (!response.ok) {
      setOpenAiBusy(false);
      setOpenAiError(response.error ?? "Failed to start OpenAI OAuth.");
      return;
    }
    window.location.assign(response.data.authorize_url);
  }

  async function handleDisconnectOpenAi() {
    setOpenAiBusy(true);
    const response = await openaiApi.disconnect();
    if (!response.ok) {
      setOpenAiError(response.error ?? "Failed to disconnect OpenAI.");
    } else if (openAiStatus) {
      setOpenAiStatus({
        ...openAiStatus,
        session: response.data.session,
        responses: {
          ...openAiStatus.responses,
          auth_mode:
            openAiStatus.responses.auth_mode === "api_key" ? "api_key" : "none",
          available: openAiStatus.responses.auth_mode === "api_key",
        },
      });
      setOpenAiError(null);
    }
    setOpenAiBusy(false);
  }

  return (
    <div className="page">
      <PageSection id="summary" label="Theme settings">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Appearance</h3>
              <p className="subtle">
                Theme color is folded into a compact drawer. Expand only when you
                want to tune the palette and template.
              </p>
            </div>
            <button
              type="button"
              className="button button-ghost button-small"
              aria-expanded={appearanceExpanded}
              onClick={() => setAppearanceExpanded((current) => !current)}
            >
              {appearanceExpanded ? "Collapse Theme" : "Expand Theme"}
            </button>
          </div>

          <div
            className="appearance-summary-band"
            style={
              selectedTemplate
                ? getTemplatePreviewStyle(selectedTemplate, resolvedTheme)
                : undefined
            }
          >
            <div className="appearance-summary-copy">
              <span className="appearance-summary-kicker">Active palette</span>
              <strong>
                {selectedTemplate?.label ?? "Theme Template"} · {activeThemeLabel}
              </strong>
              <p className="subtle">
                {selectedTemplate?.description ??
                  "Choose a template to update color, border, and typography tokens."}
              </p>
            </div>
            <div className="appearance-summary-meta">
              <div className="appearance-summary-chip">
                <span>Mode</span>
                <strong>{activeThemeLabel}</strong>
              </div>
              <div className="appearance-summary-chip">
                <span>Template</span>
                <strong>{selectedTemplate?.id ?? "--"}</strong>
              </div>
            </div>
            <div className="appearance-summary-swatches">
              <span className="theme-option-swatch theme-option-swatch-bg" />
              <span className="theme-option-swatch theme-option-swatch-panel" />
              <span className="theme-option-swatch theme-option-swatch-accent" />
            </div>
          </div>

          {appearanceExpanded ? (
            <div className="appearance-drawer-body">
              <div className="panel-header">
                <h3>Theme Mode</h3>
              </div>

              <div className="theme-option-grid">
                {OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-option${theme === option.value ? " is-selected" : ""}`}
                    onClick={() => void setTheme(option.value)}
                    disabled={isLoading}
                  >
                    <div className="theme-option-head">
                      <strong>{option.label}</strong>
                      <span className="theme-option-value">
                        {option.value === "system" ? resolvedTheme : option.value}
                      </span>
                    </div>
                    <p className="subtle">{option.description}</p>
                  </button>
                ))}
              </div>

              <div className="panel-header appearance-templates-header">
                <div>
                  <h3>Templates</h3>
                  <p className="subtle">
                    Pick the visual system first, then fine-tune shell spacing below.
                  </p>
                </div>
              </div>

              <div className="theme-option-grid">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`theme-option${templateId === template.id ? " is-selected" : ""}`}
                    onClick={() => void setTemplate(template.id)}
                    disabled={isLoading}
                  >
                    <div
                      className="theme-option-preview"
                      style={getTemplatePreviewStyle(template, resolvedTheme)}
                    >
                      <div className="theme-option-preview-head">
                        <strong className="theme-option-preview-title">Aa</strong>
                        <span className="theme-option-preview-note">
                          {getTemplatePreviewMeta(template, resolvedTheme)}
                        </span>
                      </div>
                      <div className="theme-option-swatches">
                        <span className="theme-option-swatch theme-option-swatch-bg" />
                        <span className="theme-option-swatch theme-option-swatch-panel" />
                        <span className="theme-option-swatch theme-option-swatch-accent" />
                      </div>
                    </div>
                    <div className="theme-option-head theme-option-head-template">
                      <strong className="theme-option-title">{template.label}</strong>
                      <code className="theme-option-template-id">{template.id}</code>
                    </div>
                    <p className="subtle">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <p className="subtle">{error}</p> : null}
        </section>
      </PageSection>

      <PageSection id="openai" label="OpenAI connection">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Cloud Model Gateway</h3>
              <p className="subtle">
                Click-through OAuth works only when the backend has client credentials
                and the new redirect routes are running.
              </p>
            </div>
          </div>

          <div className="oauth-status-band">
            <div className="oauth-status-copy">
              <span
                className={`badge ${oauthModel.configured ? "badge-success" : "badge-neutral"}`}
              >
                {oauthModel.readinessLabel}
              </span>
              <span
                className={`badge ${oauthModel.sessionConnected ? "badge-success" : "badge-info"}`}
              >
                {oauthModel.sessionLabel}
              </span>
              <p className="subtle">{oauthModel.detail}</p>
            </div>
            <div className="oauth-status-actions">
              <button
                type="button"
                className="button"
                onClick={() => void handleConnectOpenAi()}
                disabled={openAiBusy || openAiLoading || !oauthModel.connectAllowed}
              >
                Connect OpenAI
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void reloadOpenAiStatus()}
                disabled={openAiBusy || openAiLoading}
              >
                Refresh Status
              </button>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="openai-auth-mode">Auth Mode</label>
              <input
                id="openai-auth-mode"
                type="text"
                value={
                  openAiLoading
                    ? "Loading"
                    : openAiStatus?.responses.auth_mode ?? "none"
                }
                disabled
              />
            </div>

            <div className="field">
              <label htmlFor="openai-model">Default Model</label>
              <input
                id="openai-model"
                type="text"
                value={openAiStatus?.responses.default_model ?? "--"}
                disabled
              />
            </div>

            <div className="field">
              <label htmlFor="openai-redirect-uri">Redirect URI</label>
              <input
                id="openai-redirect-uri"
                type="text"
                value={
                  openAiStatus?.oauth.redirect_uri ??
                  `${window.location.origin}${pathname}`
                }
                disabled
              />
            </div>

            <div className="field">
              <label htmlFor="openai-identity">Connected User</label>
              <input
                id="openai-identity"
                type="text"
                value={
                  openAiStatus?.session.user.email ??
                  openAiStatus?.session.user.name ??
                  openAiStatus?.session.user.sub ??
                  "--"
                }
                disabled
              />
            </div>
          </div>

          <p className="subtle">
            {openAiStatus?.oauth.configured
              ? `Scopes: ${openAiStatus.oauth.scopes.join(" ")}`
              : "Add the OpenAI OAuth env vars locally and restart the stack before expecting the browser redirect to work."}
          </p>
          <p className="subtle">
            {openAiStatus?.session.connected
              ? `OAuth session active${openAiStatus.session.expires_at ? ` until ${openAiStatus.session.expires_at}` : ""}.`
              : openAiStatus?.responses.auth_mode === "api_key"
                ? "Backend is currently using OPENAI_API_KEY fallback."
                : "No OpenAI session is connected yet."}
          </p>
          {openAiError ? <p className="subtle">{openAiError}</p> : null}

          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => void handleDisconnectOpenAi()}
              disabled={
                openAiBusy ||
                openAiLoading ||
                !openAiStatus?.session.connected
              }
            >
              Disconnect
            </button>
          </div>
        </section>
      </PageSection>

      <PageSection id="related" label="Shell settings">
        <section className="panel">
          <div className="panel-header">
            <h3>Shell</h3>
          </div>

          <form className="field-grid" onSubmit={handleLayoutSubmit}>
            <div className="field">
              <label htmlFor="sidebar-width">Sidebar Width</label>
              <input
                id="sidebar-width"
                type="number"
                min={200}
                max={360}
                value={layoutDraft.sidebar_width_px}
                onChange={(event) =>
                  setLayoutDraft((current) => ({
                    ...current,
                    sidebar_width_px: Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="content-padding">Content Padding</label>
              <input
                id="content-padding"
                type="number"
                min={12}
                max={48}
                value={layoutDraft.content_padding_px}
                onChange={(event) =>
                  setLayoutDraft((current) => ({
                    ...current,
                    content_padding_px: Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="panel-radius">Panel Radius</label>
              <input
                id="panel-radius"
                type="number"
                min={8}
                max={28}
                value={layoutDraft.panel_radius_px}
                onChange={(event) =>
                  setLayoutDraft((current) => ({
                    ...current,
                    panel_radius_px: Number(event.target.value),
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="theme-status">Status</label>
              <input
                id="theme-status"
                type="text"
                value={isSaving ? "Saving" : isLoading ? "Loading" : "Ready"}
                disabled
              />
            </div>

            <div className="button-row">
              <button type="submit" className="button" disabled={isSaving}>
                Save
              </button>
            </div>
          </form>
        </section>
      </PageSection>
    </div>
  );
}
