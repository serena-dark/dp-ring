import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

const DEFAULT_DISCOVERY = Object.freeze({
  issuer: 'https://auth0.openai.com/',
  authorization_endpoint: 'https://auth.openai.com/authorize',
  token_endpoint: 'https://auth0.openai.com/oauth/token',
  device_authorization_endpoint: 'https://auth0.openai.com/oauth/device/code',
  revocation_endpoint: 'https://auth0.openai.com/oauth/revoke',
  userinfo_endpoint: 'https://auth0.openai.com/userinfo',
  jwks_uri: 'https://auth.openai.com/.well-known/jwks.json',
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
});

const DEFAULT_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const DEFAULT_AUDIENCE = 'https://api.openai.com/v1';
const DEFAULT_API_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-5.4-mini';
const TOKEN_REFRESH_WINDOW_MS = 60_000;

function trimString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nowIso() {
  return new Date().toISOString();
}

function randomBase64Url(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

function sha256Base64Url(value) {
  return createHash('sha256').update(String(value)).digest('base64url');
}

function splitScopes(value) {
  if (!value) {
    return [...DEFAULT_SCOPES];
  }
  return [...new Set(
    String(value)
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function parseJsonSafe(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function decodeJwtPayload(token) {
  const payload = trimString(token)?.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return JSON.parse(Buffer.from(normalized + pad, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function normalizeDiscovery() {
  return {
    ...DEFAULT_DISCOVERY,
    issuer: trimString(process.env.OPENAI_AUTH_ISSUER) ?? DEFAULT_DISCOVERY.issuer,
    authorization_endpoint:
      trimString(process.env.OPENAI_AUTHORIZATION_ENDPOINT) ??
      DEFAULT_DISCOVERY.authorization_endpoint,
    token_endpoint:
      trimString(process.env.OPENAI_TOKEN_ENDPOINT) ??
      DEFAULT_DISCOVERY.token_endpoint,
    device_authorization_endpoint:
      trimString(process.env.OPENAI_DEVICE_AUTHORIZATION_ENDPOINT) ??
      DEFAULT_DISCOVERY.device_authorization_endpoint,
    revocation_endpoint:
      trimString(process.env.OPENAI_REVOCATION_ENDPOINT) ??
      DEFAULT_DISCOVERY.revocation_endpoint,
    userinfo_endpoint:
      trimString(process.env.OPENAI_USERINFO_ENDPOINT) ??
      DEFAULT_DISCOVERY.userinfo_endpoint,
    jwks_uri: trimString(process.env.OPENAI_JWKS_URI) ?? DEFAULT_DISCOVERY.jwks_uri,
  };
}

function buildError(message, statusCode = 400, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function resolveResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts = [];
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const fragment of content) {
      if (typeof fragment?.text === 'string' && fragment.text.trim()) {
        parts.push(fragment.text.trim());
      }
    }
  }
  return parts.join('\n\n').trim();
}

function sessionSummary(session) {
  return {
    connected: Boolean(trimString(session?.access_token)),
    expires_at: trimString(session?.expires_at),
    updated_at: trimString(session?.updated_at),
    scope: Array.isArray(session?.scope) ? session.scope : [],
    token_type: trimString(session?.token_type) ?? 'Bearer',
    user: session?.user ?? {
      sub: null,
      email: null,
      name: null,
      preferred_username: null,
    },
  };
}

function normalizeTokenSession(tokenPayload, existingSession = null) {
  const claims = decodeJwtPayload(tokenPayload?.id_token) ?? existingSession?.claims ?? null;
  const expiresInSeconds = Number(tokenPayload?.expires_in);
  const expiresAt =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : trimString(existingSession?.expires_at);
  const scope = splitScopes(tokenPayload?.scope ?? existingSession?.scope?.join(' '));

  return {
    provider: 'openai',
    access_token: trimString(tokenPayload?.access_token) ?? trimString(existingSession?.access_token),
    refresh_token: trimString(tokenPayload?.refresh_token) ?? trimString(existingSession?.refresh_token),
    token_type: trimString(tokenPayload?.token_type) ?? trimString(existingSession?.token_type) ?? 'Bearer',
    scope,
    expires_at: expiresAt,
    id_token: trimString(tokenPayload?.id_token) ?? trimString(existingSession?.id_token),
    claims,
    user: {
      sub: trimString(claims?.sub) ?? trimString(existingSession?.user?.sub),
      email: trimString(claims?.email) ?? trimString(existingSession?.user?.email),
      name: trimString(claims?.name) ?? trimString(existingSession?.user?.name),
      preferred_username:
        trimString(claims?.preferred_username) ??
        trimString(existingSession?.user?.preferred_username),
    },
    updated_at: nowIso(),
  };
}

function buildTextFormat(schemaName, schema) {
  return {
    format: {
      type: 'json_schema',
      name: schemaName,
      strict: true,
      schema,
    },
  };
}

function normalizeDeviceAuthorization(payload) {
  const expiresInSeconds = Number(payload?.expires_in);
  const expiresAt =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null;
  const intervalSeconds = Number(payload?.interval);

  return {
    provider: 'openai',
    status: 'pending',
    device_code: trimString(payload?.device_code),
    user_code: trimString(payload?.user_code),
    verification_uri: trimString(payload?.verification_uri),
    verification_uri_complete: trimString(payload?.verification_uri_complete),
    expires_at: expiresAt,
    interval_seconds:
      Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 5,
  };
}

export function createOpenAiGateway(repoRoot) {
  const runtimeDir = join(repoRoot, '.ring', 'runtime');
  const sessionPath = join(runtimeDir, 'openai-session.local.json');
  const pendingAuthorizationPath = join(runtimeDir, 'openai-oauth-pending.local.json');
  const discovery = normalizeDiscovery();

  async function ensureRuntimeDir() {
    await mkdir(runtimeDir, { recursive: true });
  }

  async function readSession() {
    await ensureRuntimeDir();
    const raw = await readFile(sessionPath, 'utf-8').catch(() => null);
    return raw ? parseJsonSafe(raw, null) : null;
  }

  async function writeSession(session) {
    await ensureRuntimeDir();
    await writeFile(sessionPath, JSON.stringify(session, null, 2) + '\n', 'utf-8');
    return session;
  }

  async function clearSession() {
    await rm(sessionPath, { force: true });
  }

  async function readPendingAuthorization() {
    await ensureRuntimeDir();
    const raw = await readFile(pendingAuthorizationPath, 'utf-8').catch(() => null);
    return raw ? parseJsonSafe(raw, null) : null;
  }

  async function writePendingAuthorization(flow) {
    await ensureRuntimeDir();
    await writeFile(pendingAuthorizationPath, JSON.stringify(flow, null, 2) + '\n', 'utf-8');
    return flow;
  }

  async function clearPendingAuthorization() {
    await rm(pendingAuthorizationPath, { force: true });
  }

  function oauthClientConfig() {
    const clientId = trimString(process.env.OPENAI_OAUTH_CLIENT_ID);
    const clientSecret = trimString(process.env.OPENAI_OAUTH_CLIENT_SECRET);
    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: trimString(process.env.OPENAI_OAUTH_REDIRECT_URI),
      scopes: splitScopes(process.env.OPENAI_OAUTH_SCOPES),
      audience: trimString(process.env.OPENAI_OAUTH_AUDIENCE) ?? DEFAULT_AUDIENCE,
      configured: Boolean(clientId && clientSecret),
    };
  }

  function apiConfig() {
    return {
      api_key: trimString(process.env.OPENAI_API_KEY),
      api_base_url: trimString(process.env.OPENAI_API_BASE_URL) ?? DEFAULT_API_BASE_URL,
      default_model: trimString(process.env.OPENAI_RESPONSES_MODEL) ?? DEFAULT_MODEL,
    };
  }

  async function getStatus() {
    const session = await readSession();
    const oauth = oauthClientConfig();
    const api = apiConfig();
    const authMode = sessionSummary(session).connected
      ? 'oauth'
      : api.api_key
        ? 'api_key'
        : 'none';

    return {
      provider: 'openai',
      discovery,
      oauth: {
        configured: oauth.configured,
        client_id_present: Boolean(oauth.client_id),
        redirect_uri: oauth.redirect_uri,
        scopes: oauth.scopes,
        audience: oauth.audience,
      },
      responses: {
        api_base_url: api.api_base_url,
        default_model: api.default_model,
        auth_mode: authMode,
        available: authMode !== 'none',
      },
      session: sessionSummary(session),
    };
  }

  async function fetchJson(url, init, fallbackMessage) {
    const response = await fetch(url, init);
    const raw = await response.text();
    const payload = raw ? parseJsonSafe(raw, raw) : null;
    if (!response.ok) {
      throw buildError(
        fallbackMessage,
        response.status,
        payload,
      );
    }
    return payload;
  }

  async function fetchUserInfo(accessToken) {
    if (!accessToken) {
      return null;
    }

    try {
      const payload = await fetchJson(
        discovery.userinfo_endpoint,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        },
        'OpenAI userinfo request failed.',
      );
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      return {
        sub: trimString(payload.sub),
        email: trimString(payload.email),
        name: trimString(payload.name),
        preferred_username: trimString(payload.preferred_username),
      };
    } catch {
      return null;
    }
  }

  async function persistTokenSession(tokenPayload, existingSession = null) {
    const session = normalizeTokenSession(tokenPayload, existingSession);
    const userInfo = await fetchUserInfo(session.access_token);
    if (userInfo) {
      session.user = {
        ...session.user,
        ...userInfo,
      };
    }
    await writeSession(session);
    return session;
  }

  async function exchangeToken(input = {}) {
    const oauth = oauthClientConfig();
    if (!oauth.configured) {
      throw buildError(
        'OpenAI OAuth is not configured. Set OPENAI_OAUTH_CLIENT_ID and OPENAI_OAUTH_CLIENT_SECRET first.',
        400,
      );
    }

    const grantType =
      trimString(input.grant_type) ??
      (trimString(input.refresh_token) ? 'refresh_token' : 'authorization_code');

    if (!['authorization_code', 'refresh_token'].includes(grantType)) {
      throw buildError(`Unsupported grant_type: ${grantType}`, 400);
    }

    if (grantType === 'authorization_code' && !trimString(input.code)) {
      throw buildError('OpenAI OAuth token exchange requires a code.', 400);
    }
    if (grantType === 'refresh_token' && !trimString(input.refresh_token)) {
      throw buildError('OpenAI OAuth refresh requires a refresh_token.', 400);
    }

    const params = new URLSearchParams();
    params.set('grant_type', grantType);
    params.set('client_id', oauth.client_id);
    params.set('client_secret', oauth.client_secret);

    if (grantType === 'authorization_code') {
      params.set('code', trimString(input.code));
      params.set(
        'redirect_uri',
        trimString(input.redirect_uri) ?? oauth.redirect_uri ?? '',
      );
      const codeVerifier = trimString(input.code_verifier);
      if (codeVerifier) {
        params.set('code_verifier', codeVerifier);
      }
    } else {
      params.set('refresh_token', trimString(input.refresh_token));
    }

    const existingSession = await readSession();
    const payload = await fetchJson(
      discovery.token_endpoint,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
      'OpenAI OAuth token exchange failed.',
    );

    const session = await persistTokenSession(payload, existingSession);
    return {
      provider: 'openai',
      session: sessionSummary(session),
    };
  }

  async function refreshSession() {
    const session = await readSession();
    if (!trimString(session?.refresh_token)) {
      return {
        provider: 'openai',
        session: sessionSummary(session),
      };
    }
    return exchangeToken({
      grant_type: 'refresh_token',
      refresh_token: session.refresh_token,
    });
  }

  async function revokeSession() {
    const oauth = oauthClientConfig();
    const session = await readSession();
    const token =
      trimString(session?.refresh_token) ??
      trimString(session?.access_token);

    if (!token) {
      await clearSession();
      return {
        provider: 'openai',
        session: sessionSummary(null),
      };
    }

    if (oauth.configured) {
      const params = new URLSearchParams();
      params.set('client_id', oauth.client_id);
      params.set('client_secret', oauth.client_secret);
      params.set('token', token);
      await fetch(discovery.revocation_endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }).catch(() => null);
    }

    await clearSession();
    return {
      provider: 'openai',
      session: sessionSummary(null),
    };
  }

  async function buildAuthorizeUrl(input = {}) {
    const oauth = oauthClientConfig();
    if (!oauth.configured || !oauth.client_id) {
      throw buildError(
        'OpenAI OAuth is not configured. Set OPENAI_OAUTH_CLIENT_ID and OPENAI_OAUTH_CLIENT_SECRET first.',
        400,
      );
    }

    const redirectUri = trimString(input.redirect_uri) ?? oauth.redirect_uri;
    if (!redirectUri) {
      throw buildError(
        'OpenAI OAuth redirect URI is missing. Set OPENAI_OAUTH_REDIRECT_URI or provide redirect_uri.',
        400,
      );
    }

    const params = new URLSearchParams();
    params.set('response_type', 'code');
    params.set('client_id', oauth.client_id);
    params.set('redirect_uri', redirectUri);
    params.set('scope', splitScopes(input.scope ?? oauth.scopes.join(' ')).join(' '));
    params.set('audience', trimString(input.audience) ?? oauth.audience);

    const state = trimString(input.state);
    if (state) {
      params.set('state', state);
    }
    const codeChallenge = trimString(input.code_challenge);
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', trimString(input.code_challenge_method) ?? 'S256');
    }
    const prompt = trimString(input.prompt);
    if (prompt) {
      params.set('prompt', prompt);
    }

    return {
      authorize_url: `${discovery.authorization_endpoint}?${params.toString()}`,
    };
  }

  async function startOAuthRedirect(input = {}) {
    const oauth = oauthClientConfig();
    if (!oauth.configured || !oauth.client_id) {
      throw buildError(
        'OpenAI OAuth is not configured. Set OPENAI_OAUTH_CLIENT_ID and OPENAI_OAUTH_CLIENT_SECRET first.',
        400,
      );
    }

    const redirectUri = oauth.redirect_uri;
    if (!redirectUri) {
      throw buildError(
        'OpenAI OAuth redirect URI is missing. Set OPENAI_OAUTH_REDIRECT_URI first.',
        400,
      );
    }

    const state = randomBase64Url(24);
    const codeVerifier = randomBase64Url(48);
    await writePendingAuthorization({
      provider: 'openai',
      state,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      created_at: nowIso(),
    });

    return buildAuthorizeUrl({
      ...input,
      state,
      redirect_uri: redirectUri,
      code_challenge: sha256Base64Url(codeVerifier),
      code_challenge_method: 'S256',
      prompt: trimString(input.prompt) ?? 'consent',
    });
  }

  async function completeOAuthRedirect(input = {}) {
    const code = trimString(input.code);
    const state = trimString(input.state);
    if (!code) {
      throw buildError('OpenAI OAuth completion requires a code.', 400);
    }
    if (!state) {
      throw buildError('OpenAI OAuth completion requires a state.', 400);
    }

    const pending = await readPendingAuthorization();
    if (!pending?.state || !pending?.code_verifier || !pending?.redirect_uri) {
      throw buildError('No pending OpenAI OAuth redirect flow exists.', 400);
    }
    if (pending.state !== state) {
      throw buildError('OpenAI OAuth state mismatch.', 400);
    }

    const response = await exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: pending.redirect_uri,
      code_verifier: pending.code_verifier,
    });
    await clearPendingAuthorization();
    return response;
  }

  async function startDeviceAuthorization(input = {}) {
    const oauth = oauthClientConfig();
    if (!oauth.configured || !oauth.client_id) {
      throw buildError(
        'OpenAI OAuth is not configured. Set OPENAI_OAUTH_CLIENT_ID and OPENAI_OAUTH_CLIENT_SECRET first.',
        400,
      );
    }

    const params = new URLSearchParams();
    params.set('client_id', oauth.client_id);
    params.set('scope', splitScopes(input.scope ?? oauth.scopes.join(' ')).join(' '));
    params.set('audience', trimString(input.audience) ?? oauth.audience);

    const payload = await fetchJson(
      discovery.device_authorization_endpoint,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
      'OpenAI device authorization request failed.',
    );

    const normalized = normalizeDeviceAuthorization(payload);
    if (!normalized.device_code || !normalized.user_code || !normalized.verification_uri) {
      throw buildError(
        'OpenAI device authorization response was incomplete.',
        502,
        payload,
      );
    }

    return normalized;
  }

  async function pollDeviceAuthorization(input = {}) {
    const oauth = oauthClientConfig();
    if (!oauth.configured || !oauth.client_id) {
      throw buildError(
        'OpenAI OAuth is not configured. Set OPENAI_OAUTH_CLIENT_ID and OPENAI_OAUTH_CLIENT_SECRET first.',
        400,
      );
    }

    const deviceCode = trimString(input.device_code);
    if (!deviceCode) {
      throw buildError('OpenAI device poll requires device_code.', 400);
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
    params.set('device_code', deviceCode);
    params.set('client_id', oauth.client_id);
    if (oauth.client_secret) {
      params.set('client_secret', oauth.client_secret);
    }

    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const raw = await response.text();
    const payload = raw ? parseJsonSafe(raw, raw) : null;

    if (response.ok) {
      const session = await persistTokenSession(payload, await readSession());
      return {
        provider: 'openai',
        status: 'completed',
        session: sessionSummary(session),
      };
    }

    const errorCode = trimString(payload?.error) ?? '';
    if (errorCode === 'authorization_pending') {
      return {
        provider: 'openai',
        status: 'pending',
        retry_after_seconds: Math.max(1, Number(input.interval_seconds) || 5),
        error: trimString(payload?.error_description) ?? null,
      };
    }
    if (errorCode === 'slow_down') {
      return {
        provider: 'openai',
        status: 'slow_down',
        retry_after_seconds: Math.max(5, Number(input.interval_seconds) || 5) + 5,
        error: trimString(payload?.error_description) ?? null,
      };
    }
    if (['expired_token', 'access_denied', 'invalid_grant'].includes(errorCode)) {
      return {
        provider: 'openai',
        status: 'expired',
        error: trimString(payload?.error_description) ?? errorCode,
      };
    }

    throw buildError(
      'OpenAI device authorization poll failed.',
      response.status,
      payload,
    );
  }

  async function ensureAuthorization() {
    const api = apiConfig();
    const session = await readSession();

    if (trimString(session?.access_token)) {
      const expiresAt = Date.parse(session.expires_at ?? '');
      const shouldRefresh =
        Number.isFinite(expiresAt) &&
        expiresAt - Date.now() <= TOKEN_REFRESH_WINDOW_MS &&
        trimString(session.refresh_token);
      if (shouldRefresh) {
        await refreshSession();
      }
      const refreshedSession = await readSession();
      if (trimString(refreshedSession?.access_token)) {
        return {
          mode: 'oauth',
          authorization: `Bearer ${refreshedSession.access_token}`,
        };
      }
    }

    if (trimString(api.api_key)) {
      return {
        mode: 'api_key',
        authorization: `Bearer ${api.api_key}`,
      };
    }

    throw buildError(
      'OpenAI is not connected. Complete OAuth or set OPENAI_API_KEY.',
      401,
    );
  }

  async function createResponse(body = {}) {
    const api = apiConfig();
    const auth = await ensureAuthorization();
    const payload = {
      model: trimString(body.model) ?? api.default_model,
      ...body,
    };

    const response = await fetchJson(
      `${api.api_base_url.replace(/\/$/, '')}/responses`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: auth.authorization,
        },
        body: JSON.stringify(payload),
      },
      'OpenAI Responses request failed.',
    );

    return {
      provider: 'openai',
      auth_mode: auth.mode,
      id: trimString(response?.id),
      model: trimString(response?.model) ?? payload.model,
      output_text: resolveResponseText(response),
      response,
    };
  }

  async function completeText({
    instructions,
    input,
    model = null,
    reasoning = null,
    metadata = null,
  } = {}) {
    const payload = {
      instructions,
      input,
      metadata: metadata ?? undefined,
      reasoning: reasoning ?? undefined,
      model: model ?? undefined,
    };
    return createResponse(payload);
  }

  async function completeJson({
    instructions,
    input,
    schemaName,
    schema,
    model = null,
    reasoning = null,
    metadata = null,
  } = {}) {
    const result = await createResponse({
      instructions,
      input,
      metadata: metadata ?? undefined,
      reasoning: reasoning ?? undefined,
      model: model ?? undefined,
      text: buildTextFormat(schemaName, schema),
    });
    const parsed = parseJsonSafe(result.output_text, null);
    if (!parsed || typeof parsed !== 'object') {
      throw buildError(
        'OpenAI returned a non-JSON structured response.',
        502,
        result.response,
      );
    }
    return {
      ...result,
      parsed,
    };
  }

  return {
    getStatus,
    buildAuthorizeUrl,
    startOAuthRedirect,
    completeOAuthRedirect,
    exchangeToken,
    startDeviceAuthorization,
    pollDeviceAuthorization,
    refreshSession,
    revokeSession,
    clearSession,
    createResponse,
    completeText,
    completeJson,
  };
}
