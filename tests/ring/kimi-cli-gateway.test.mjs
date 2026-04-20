import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createKimiCliGateway } from '../../ring/lib/kimi-cli-gateway.mjs';

describe('kimi cli gateway', async () => {
  let tempDir;
  let credentialsPath;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-kimi-gateway-'));
    await mkdir(join(tempDir, '.ring', 'runtime'), { recursive: true });
    credentialsPath = join(tempDir, 'kimi-code.json');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reports available status when the kimi cli probe and credentials are present', async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: new Date('2026-04-20T12:00:00.000Z').toISOString(),
      }, null, 2),
      'utf-8',
    );

    const gateway = createKimiCliGateway(tempDir, {
      credentialsPath,
      probeCli: async () => ({
        available: true,
        version: '1.30.0',
      }),
      runPrompt: async () => '{"ok":true}',
    });

    const status = await gateway.getStatus();

    assert.equal(status.provider, 'kimi');
    assert.equal(status.responses.available, true);
    assert.equal(status.responses.auth_mode, 'oauth');
    assert.equal(status.session.connected, true);
    assert.equal(status.cli.version, '1.30.0');
  });

  it('parses structured json output and strips the kimi resume footer', async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: new Date('2026-04-20T12:00:00.000Z').toISOString(),
      }, null, 2),
      'utf-8',
    );

    const calls = [];
    const gateway = createKimiCliGateway(tempDir, {
      credentialsPath,
      probeCli: async () => ({
        available: true,
        version: '1.30.0',
      }),
      runPrompt: async (request) => {
        calls.push(request);
        return '{"verdict":"approved","note":"Use Kimi."}\n\nTo resume this session: kimi -r session-123';
      },
    });

    const result = await gateway.completeJson({
      instructions: 'Return a decision.',
      input: '{"task":"demo"}',
      schemaName: 'decision',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['verdict', 'note'],
        properties: {
          verdict: { type: 'string' },
          note: { type: 'string' },
        },
      },
      model: 'kimi-code/kimi-for-coding',
    });

    assert.equal(result.provider, 'kimi');
    assert.deepEqual(result.parsed, {
      verdict: 'approved',
      note: 'Use Kimi.',
    });
    assert.equal(result.output_text, '{"verdict":"approved","note":"Use Kimi."}');
    assert.equal(calls[0].model, 'kimi-code/kimi-for-coding');
    assert.match(calls[0].prompt, /Return ONLY valid JSON/i);
    assert.match(calls[0].prompt, /decision/);
  });

  it('extracts json from fenced output even when surrounding text contains braces', async () => {
    await writeFile(
      credentialsPath,
      JSON.stringify({
        access_token: 'token-123',
        refresh_token: 'refresh-123',
        expires_at: new Date('2026-04-20T12:00:00.000Z').toISOString(),
      }, null, 2),
      'utf-8',
    );

    const gateway = createKimiCliGateway(tempDir, {
      credentialsPath,
      probeCli: async () => ({
        available: true,
        version: '1.30.0',
      }),
      runPrompt: async () => [
        'Context {discard this annotation}',
        '',
        '```json',
        '{"verdict":"approved","note":"Use fenced JSON."}',
        '```',
        '',
        'Rendered successfully.',
        '',
        'To resume this session: kimi -r session-456',
      ].join('\n'),
    });

    const result = await gateway.completeJson({
      instructions: 'Return a decision.',
      input: '{"task":"demo"}',
      schemaName: 'decision',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['verdict', 'note'],
        properties: {
          verdict: { type: 'string' },
          note: { type: 'string' },
        },
      },
    });

    assert.deepEqual(result.parsed, {
      verdict: 'approved',
      note: 'Use fenced JSON.',
    });
    assert.equal(result.output_text, '{"verdict":"approved","note":"Use fenced JSON."}');
  });
});
