import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { loadEnvFiles } from '../../ring/lib/env.mjs';

describe('env loader', () => {
  let tempDir;
  let envBackup;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ring-env-'));
    envBackup = {
      OPENAI_OAUTH_CLIENT_ID: process.env.OPENAI_OAUTH_CLIENT_ID,
      OPENAI_OAUTH_CLIENT_SECRET: process.env.OPENAI_OAUTH_CLIENT_SECRET,
      OPENAI_OAUTH_REDIRECT_URI: process.env.OPENAI_OAUTH_REDIRECT_URI,
      CUSTOM_FLAG: process.env.CUSTOM_FLAG,
    };
    delete process.env.OPENAI_OAUTH_CLIENT_ID;
    delete process.env.OPENAI_OAUTH_CLIENT_SECRET;
    delete process.env.OPENAI_OAUTH_REDIRECT_URI;
    delete process.env.CUSTOM_FLAG;
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

  it('loads .env values and supports quoted or exported declarations', async () => {
    await writeFile(
      join(tempDir, '.env'),
      [
        'OPENAI_OAUTH_CLIENT_ID="client-id"',
        "export OPENAI_OAUTH_CLIENT_SECRET='client-secret'",
        'OPENAI_OAUTH_REDIRECT_URI=http://localhost:5173/settings',
        '# ignored comment',
      ].join('\n'),
      'utf-8',
    );

    loadEnvFiles(tempDir);

    assert.equal(process.env.OPENAI_OAUTH_CLIENT_ID, 'client-id');
    assert.equal(process.env.OPENAI_OAUTH_CLIENT_SECRET, 'client-secret');
    assert.equal(
      process.env.OPENAI_OAUTH_REDIRECT_URI,
      'http://localhost:5173/settings',
    );
  });

  it('does not overwrite values that already exist in process.env', async () => {
    process.env.OPENAI_OAUTH_CLIENT_ID = 'already-set';
    await writeFile(
      join(tempDir, '.env'),
      'OPENAI_OAUTH_CLIENT_ID=from-env-file\nCUSTOM_FLAG=enabled\n',
      'utf-8',
    );
    await writeFile(
      join(tempDir, '.env.local'),
      'OPENAI_OAUTH_CLIENT_SECRET=local-secret\n',
      'utf-8',
    );

    loadEnvFiles(tempDir);

    assert.equal(process.env.OPENAI_OAUTH_CLIENT_ID, 'already-set');
    assert.equal(process.env.OPENAI_OAUTH_CLIENT_SECRET, 'local-secret');
    assert.equal(process.env.CUSTOM_FLAG, 'enabled');
  });
});
