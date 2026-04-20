import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, mkdir, readFile, rm, stat, chmod, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createOpenAiGateway } from '../../ring/lib/openai-gateway.mjs';

function fileMode(stats) {
  return stats.mode & 0o777;
}

describe('openai gateway', async () => {
  let tempDir;
  let envBackup;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-openai-gateway-'));
    await mkdir(join(tempDir, '.ring', 'runtime'), { recursive: true });
    envBackup = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_OAUTH_CLIENT_ID: process.env.OPENAI_OAUTH_CLIENT_ID,
      OPENAI_OAUTH_CLIENT_SECRET: process.env.OPENAI_OAUTH_CLIENT_SECRET,
      OPENAI_OAUTH_REDIRECT_URI: process.env.OPENAI_OAUTH_REDIRECT_URI,
      OPENAI_OAUTH_AUDIENCE: process.env.OPENAI_OAUTH_AUDIENCE,
      OPENAI_OAUTH_SCOPES: process.env.OPENAI_OAUTH_SCOPES,
      OPENAI_RESPONSES_MODEL: process.env.OPENAI_RESPONSES_MODEL,
    };
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('builds an OpenAI authorize URL with PKCE and audience parameters', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'client-id';
    process.env.OPENAI_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.OPENAI_OAUTH_REDIRECT_URI = 'http://localhost:5173/settings';
    process.env.OPENAI_OAUTH_AUDIENCE = 'https://api.openai.com/v1';
    process.env.OPENAI_OAUTH_SCOPES = 'openid profile offline_access';

    const gateway = createOpenAiGateway(tempDir);
    const result = await gateway.buildAuthorizeUrl({
      state: 'state-123',
      code_challenge: 'challenge-xyz',
    });
    const url = new URL(result.authorize_url);

    assert.equal(url.origin + url.pathname, 'https://auth.openai.com/authorize');
    assert.equal(url.searchParams.get('client_id'), 'client-id');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/settings');
    assert.equal(url.searchParams.get('state'), 'state-123');
    assert.equal(url.searchParams.get('code_challenge'), 'challenge-xyz');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('audience'), 'https://api.openai.com/v1');
    assert.equal(url.searchParams.get('scope'), 'openid profile offline_access');
  });

  it('starts a managed OpenAI OAuth redirect flow and stores PKCE state locally', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'client-id';
    process.env.OPENAI_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.OPENAI_OAUTH_REDIRECT_URI = 'http://localhost:5173/settings';

    const pendingAuthorizationPath = join(
      tempDir,
      '.ring',
      'runtime',
      'openai-oauth-pending.local.json',
    );
    await writeFile(pendingAuthorizationPath, JSON.stringify({ stale: true }, null, 2), 'utf-8');
    await chmod(pendingAuthorizationPath, 0o644);

    const gateway = createOpenAiGateway(tempDir);
    const result = await gateway.startOAuthRedirect();
    const url = new URL(result.authorize_url);
    const pendingFlow = JSON.parse(
      await readFile(
        pendingAuthorizationPath,
        'utf-8',
      ),
    );
    const pendingStats = await stat(pendingAuthorizationPath);

    assert.equal(url.origin + url.pathname, 'https://auth.openai.com/authorize');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/settings');
    assert.equal(url.searchParams.get('state'), pendingFlow.state);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('prompt'), 'consent');
    assert.ok(url.searchParams.get('code_challenge'));
    assert.ok(pendingFlow.code_verifier);
    assert.equal(fileMode(pendingStats), 0o600);
  });

  it('completes a managed OpenAI OAuth redirect flow with the stored PKCE verifier', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'client-id';
    process.env.OPENAI_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.OPENAI_OAUTH_REDIRECT_URI = 'http://localhost:5173/settings';

    const gateway = createOpenAiGateway(tempDir);
    const started = await gateway.startOAuthRedirect();
    const state = new URL(started.authorize_url).searchParams.get('state');
    const pendingAuthorizationPath = join(
      tempDir,
      '.ring',
      'runtime',
      'openai-oauth-pending.local.json',
    );
    const sessionPath = join(tempDir, '.ring', 'runtime', 'openai-session.local.json');
    const pendingFlow = JSON.parse(
      await readFile(
        pendingAuthorizationPath,
        'utf-8',
      ),
    );
    await writeFile(sessionPath, JSON.stringify({ stale: true }, null, 2), 'utf-8');
    await chmod(sessionPath, 0o644);

    let tokenRequestBody = null;
    const fetchBackup = global.fetch;
    global.fetch = async (url, init = {}) => {
      if (url === 'https://auth0.openai.com/oauth/token') {
        tokenRequestBody = String(init.body ?? '');
        return new Response(JSON.stringify({
          access_token: 'oauth-token',
          refresh_token: 'refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email offline_access',
          id_token: 'header.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoicmluZ0BleGFtcGxlLmNvbSIsIm5hbWUiOiJSaW5nIFVzZXIifQ.signature',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://auth0.openai.com/userinfo') {
        return new Response(JSON.stringify({
          sub: 'user-123',
          email: 'ring@example.com',
          name: 'Ring User',
          preferred_username: 'ring',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    };

    try {
      const result = await gateway.completeOAuthRedirect({
        code: 'authorization-code',
        state,
      });

      const tokenParams = new URLSearchParams(tokenRequestBody ?? '');
      const pendingRaw = await readFile(
        pendingAuthorizationPath,
        'utf-8',
      ).catch(() => null);
      const sessionStats = await stat(sessionPath);

      assert.equal(result.session.connected, true);
      assert.equal(result.session.user.email, 'ring@example.com');
      assert.equal(tokenParams.get('grant_type'), 'authorization_code');
      assert.equal(tokenParams.get('code'), 'authorization-code');
      assert.equal(tokenParams.get('redirect_uri'), 'http://localhost:5173/settings');
      assert.equal(tokenParams.get('code_verifier'), pendingFlow.code_verifier);
      assert.equal(pendingRaw, null);
      assert.equal(fileMode(sessionStats), 0o600);
    } finally {
      global.fetch = fetchBackup;
    }
  });

  it('reports oauth status from the local session file and prefers oauth over api_key', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_RESPONSES_MODEL = 'gpt-5.4-mini';

    await writeFile(
      join(tempDir, '.ring', 'runtime', 'openai-session.local.json'),
      JSON.stringify({
        access_token: 'oauth-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        scope: ['openid', 'profile'],
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        updated_at: '2026-04-14T12:00:00.000Z',
        user: {
          sub: 'user-123',
          email: 'ring@example.com',
          name: 'Ring User',
          preferred_username: 'ring',
        },
      }, null, 2),
      'utf-8',
    );

    const gateway = createOpenAiGateway(tempDir);
    const status = await gateway.getStatus();

    assert.equal(status.responses.auth_mode, 'oauth');
    assert.equal(status.responses.default_model, 'gpt-5.4-mini');
    assert.equal(status.session.connected, true);
    assert.equal(status.session.user.email, 'ring@example.com');
  });

  it('falls back to api_key when the stored oauth session is expired and cannot refresh', async () => {
    process.env.OPENAI_API_KEY = 'api-key';

    await writeFile(
      join(tempDir, '.ring', 'runtime', 'openai-session.local.json'),
      JSON.stringify({
        access_token: 'expired-oauth-token',
        token_type: 'Bearer',
        scope: ['openid', 'profile'],
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: '2026-04-14T12:00:00.000Z',
      }, null, 2),
      'utf-8',
    );

    const gateway = createOpenAiGateway(tempDir);
    const status = await gateway.getStatus();

    assert.equal(status.responses.auth_mode, 'api_key');
    assert.equal(status.responses.available, true);
    assert.equal(status.session.connected, false);

    let authorizationHeader = null;
    const fetchBackup = global.fetch;
    global.fetch = async (url, init = {}) => {
      authorizationHeader = init.headers?.Authorization ?? null;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      return new Response(JSON.stringify({
        id: 'resp_123',
        model: 'gpt-5.4-mini',
        output_text: 'ok',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const result = await gateway.createResponse({ input: 'hello' });
      assert.equal(result.auth_mode, 'api_key');
      assert.equal(result.output_text, 'ok');
      assert.equal(authorizationHeader, 'Bearer api-key');
    } finally {
      global.fetch = fetchBackup;
    }
  });

  it('prefers oauth refresh over api_key fallback when only a refresh token is stored locally', async () => {
    process.env.OPENAI_API_KEY = 'api-key';
    process.env.OPENAI_OAUTH_CLIENT_ID = 'client-id';
    process.env.OPENAI_OAUTH_CLIENT_SECRET = 'client-secret';

    await writeFile(
      join(tempDir, '.ring', 'runtime', 'openai-session.local.json'),
      JSON.stringify({
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        scope: ['openid', 'profile'],
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        updated_at: '2026-04-14T12:00:00.000Z',
      }, null, 2),
      'utf-8',
    );

    const gateway = createOpenAiGateway(tempDir);
    const status = await gateway.getStatus();

    assert.equal(status.responses.auth_mode, 'oauth');
    assert.equal(status.responses.available, true);
    assert.equal(status.session.connected, true);

    const fetchBackup = global.fetch;
    const calls = [];
    global.fetch = async (url, init = {}) => {
      calls.push({ url, init });

      if (url === 'https://auth0.openai.com/oauth/token') {
        return new Response(JSON.stringify({
          access_token: 'refreshed-oauth-token',
          refresh_token: 'refreshed-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile email offline_access',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://auth0.openai.com/userinfo') {
        return new Response(JSON.stringify({
          sub: 'user-123',
          email: 'ring@example.com',
          name: 'Ring User',
          preferred_username: 'ring',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'https://api.openai.com/v1/responses') {
        assert.equal(init.headers?.Authorization, 'Bearer refreshed-oauth-token');
        return new Response(JSON.stringify({
          id: 'resp_456',
          model: 'gpt-5.4-mini',
          output_text: 'fresh oauth response',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    };

    try {
      const result = await gateway.createResponse({ input: 'hello' });
      const storedSession = JSON.parse(
        await readFile(join(tempDir, '.ring', 'runtime', 'openai-session.local.json'), 'utf-8'),
      );

      assert.equal(result.auth_mode, 'oauth');
      assert.equal(result.output_text, 'fresh oauth response');
      assert.equal(calls[0].url, 'https://auth0.openai.com/oauth/token');
      assert.equal(storedSession.access_token, 'refreshed-oauth-token');
      assert.equal(storedSession.refresh_token, 'refreshed-refresh-token');
    } finally {
      global.fetch = fetchBackup;
    }
  });

  it('uses the configured default model for completeText when no explicit model is supplied', async () => {
    process.env.OPENAI_API_KEY='***';
    process.env.OPENAI_RESPONSES_MODEL = 'gpt-5.4-mini';

    const gateway = createOpenAiGateway(tempDir);
    let requestBody = null;
    const fetchBackup = global.fetch;
    global.fetch = async (url, init = {}) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      requestBody = JSON.parse(String(init.body ?? '{}'));
      return new Response(JSON.stringify({
        id: 'resp_default_model',
        output_text: 'ok',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const result = await gateway.completeText({
        instructions: 'Say hi',
        input: 'there',
      });
      assert.equal(result.model, 'gpt-5.4-mini');
      assert.equal(requestBody.model, 'gpt-5.4-mini');
      assert.equal(requestBody.instructions, 'Say hi');
      assert.equal(requestBody.input, 'there');
    } finally {
      global.fetch = fetchBackup;
    }
  });
});
