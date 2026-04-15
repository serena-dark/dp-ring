import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSettingsOAuthModel,
  getActiveThemeLabel,
  getSelectedTemplate,
} from "../../ring-gui/lib/settings-state.ts";

describe("ring-gui settings state", () => {
  const templates = [
    {
      id: "ring-console",
      label: "Ring Console",
      description: "Default operator palette.",
      tokens: {
        light: {
          "--theme-bg": "#f7f6f1",
        },
        dark: {
          "--theme-bg": "#0d1117",
        },
      },
    },
    {
      id: "amber-grid",
      label: "Amber Grid",
      description: "Warm accent console.",
      tokens: {
        light: {},
        dark: {},
      },
    },
  ];

  it("describes the active theme label for explicit and system modes", () => {
    assert.equal(getActiveThemeLabel("dark", "light"), "Dark");
    assert.equal(getActiveThemeLabel("light", "dark"), "Light");
    assert.equal(getActiveThemeLabel("system", "dark"), "System / Dark");
    assert.equal(getActiveThemeLabel("system", "light"), "System / Light");
  });

  it("selects the matching template and falls back to the first available template", () => {
    assert.equal(getSelectedTemplate(templates, "amber-grid")?.label, "Amber Grid");
    assert.equal(getSelectedTemplate(templates, "missing-template")?.label, "Ring Console");
    assert.equal(getSelectedTemplate([], "missing-template"), null);
  });

  it("marks OAuth as unavailable when the backend is not configured", () => {
    const model = buildSettingsOAuthModel({
      provider: "openai",
      discovery: {
        issuer: "https://auth0.openai.com/",
        authorization_endpoint: "https://auth.openai.com/authorize",
        token_endpoint: "https://auth0.openai.com/oauth/token",
        device_authorization_endpoint: "https://auth0.openai.com/oauth/device/code",
        revocation_endpoint: "https://auth0.openai.com/oauth/revoke",
        userinfo_endpoint: "https://auth0.openai.com/userinfo",
        jwks_uri: "https://auth.openai.com/.well-known/jwks.json",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      },
      oauth: {
        configured: false,
        client_id_present: false,
        redirect_uri: null,
        scopes: ["openid", "profile"],
        audience: "https://api.openai.com/v1",
      },
      responses: {
        api_base_url: "https://api.openai.com/v1",
        default_model: "gpt-5.4-mini",
        auth_mode: "none",
        available: false,
      },
      session: {
        connected: false,
        expires_at: null,
        updated_at: null,
        scope: [],
        token_type: "Bearer",
        user: {
          sub: null,
          email: null,
          name: null,
          preferred_username: null,
        },
      },
    });

    assert.equal(model.configured, false);
    assert.equal(model.connectAllowed, false);
    assert.equal(model.readinessLabel, "OAuth Not Configured");
    assert.match(model.detail, /OPENAI_OAUTH_CLIENT_ID/);
  });

  it("marks OAuth as ready once the backend is configured", () => {
    const model = buildSettingsOAuthModel({
      provider: "openai",
      discovery: {
        issuer: "https://auth0.openai.com/",
        authorization_endpoint: "https://auth.openai.com/authorize",
        token_endpoint: "https://auth0.openai.com/oauth/token",
        device_authorization_endpoint: "https://auth0.openai.com/oauth/device/code",
        revocation_endpoint: "https://auth0.openai.com/oauth/revoke",
        userinfo_endpoint: "https://auth0.openai.com/userinfo",
        jwks_uri: "https://auth.openai.com/.well-known/jwks.json",
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
      },
      oauth: {
        configured: true,
        client_id_present: true,
        redirect_uri: "http://localhost:5173/settings",
        scopes: ["openid", "profile", "email"],
        audience: "https://api.openai.com/v1",
      },
      responses: {
        api_base_url: "https://api.openai.com/v1",
        default_model: "gpt-5.4-mini",
        auth_mode: "oauth",
        available: true,
      },
      session: {
        connected: true,
        expires_at: "2026-04-15T00:00:00.000Z",
        updated_at: "2026-04-14T00:00:00.000Z",
        scope: ["openid", "profile", "email"],
        token_type: "Bearer",
        user: {
          sub: "user-123",
          email: "ring@example.com",
          name: "Ring User",
          preferred_username: "ring",
        },
      },
    });

    assert.equal(model.configured, true);
    assert.equal(model.connectAllowed, true);
    assert.equal(model.sessionConnected, true);
    assert.equal(model.readinessLabel, "OAuth Ready");
    assert.equal(model.sessionLabel, "Session Connected");
    assert.match(model.detail, /authorization URL/i);
  });
});
