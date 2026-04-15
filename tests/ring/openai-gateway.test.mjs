import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createOpenAiGateway } from '../../ring/lib/openai-gateway.mjs';

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

    const gateway = createOpenAiGateway(tempDir);
    const result = await gateway.startOAuthRedirect();
    const url = new URL(result.authorize_url);
    const pendingFlow = JSON.parse(
      await readFile(
        join(tempDir, '.ring', 'runtime', 'openai-oauth-pending.local.json'),
        'utf-8',
      ),
    );

    assert.equal(url.origin + url.pathname, 'https://auth.openai.com/authorize');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5173/settings');
    assert.equal(url.searchParams.get('state'), pendingFlow.state);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('prompt'), 'consent');
    assert.ok(url.searchParams.get('code_challenge'));
    assert.ok(pendingFlow.code_verifier);
  });

  it('completes a managed OpenAI OAuth redirect flow with the stored PKCE verifier', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'client-id';
    process.env.OPENAI_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.OPENAI_OAUTH_REDIRECT_URI = 'http://localhost:5173/settings';

    const gateway = createOpenAiGateway(tempDir);
    const started = await gateway.startOAuthRedirect();
    const state = new URL(started.authorize_url).searchParams.get('state');
    const pendingFlow = JSON.parse(
      await readFile(
        join(tempDir, '.ring', 'runtime', 'openai-oauth-pending.local.json'),
        'utf-8',
      ),
    );

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
        join(tempDir, '.ring', 'runtime', 'openai-oauth-pending.local.json'),
        'utf-8',
      ).catch(() => null);

      assert.equal(result.session.connected, true);
      assert.equal(result.session.user.email, 'ring@example.com');
      assert.equal(tokenParams.get('grant_type'), 'authorization_code');
      assert.equal(tokenParams.get('code'), 'authorization-code');
      assert.equal(tokenParams.get('redirect_uri'), 'http://localhost:5173/settings');
      assert.equal(tokenParams.get('code_verifier'), pendingFlow.code_verifier);
      assert.equal(pendingRaw, null);
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
        expires_at: '2026-04-15T00:00:00.000Z',
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
});
