import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'));

describe('root frontend script alignment', () => {
  it('routes root frontend commands to the v2 operator web app', () => {
    assert.equal(packageJson.scripts.dev, 'npm run v2:web:dev');
    assert.equal(packageJson.scripts.build, 'npm run v2:web:build');
    assert.equal(packageJson.scripts.preview, 'npm run v2:web:preview');
    assert.equal(packageJson.scripts.typecheck, 'npm run v2:web:typecheck');
  });

  it('routes split frontend/backend test commands through the root scripts directory', () => {
    assert.equal(packageJson.scripts['test:backend'], 'node scripts/run-backend-tests.mjs');
    assert.equal(packageJson.scripts['test:frontend'], 'node scripts/run-frontend-tests.mjs');
    assert.notEqual(packageJson.scripts['test:backend'], 'node cli-tool/run-tests.mjs');
    assert.notEqual(packageJson.scripts['test:frontend'], 'node cli-tool/run-frontend-tests.mjs');
  });
});
