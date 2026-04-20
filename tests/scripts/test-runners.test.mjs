import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_BACKEND_PATTERN, resolveRequestedFiles } from '../../scripts/run-backend-tests.mjs';
import {
  DEFAULT_FRONTEND_PATTERN,
  resolveFrontendNodeArgs,
  resolveFrontendTestFiles,
} from '../../scripts/run-frontend-tests.mjs';

describe('script test runners', () => {
  it('uses the expected backend default test pattern', () => {
    assert.equal(DEFAULT_BACKEND_PATTERN, 'tests/**/*.test.mjs');
  });

  it('uses the expected frontend default test pattern', () => {
    assert.equal(DEFAULT_FRONTEND_PATTERN, 'tests/operator-web/**/*.test.ts');
  });

  it('forwards frontend node test flags while rejecting positional path args', () => {
    assert.deepEqual(resolveFrontendNodeArgs(['--test-name-pattern=demo']), ['--test-name-pattern=demo']);
    assert.deepEqual(resolveFrontendNodeArgs(['--', '--test-name-pattern=demo']), ['--test-name-pattern=demo']);
    assert.throws(
      () => resolveFrontendNodeArgs(['tests/operator-web/demo-data.test.ts']),
      /不接受测试路径参数/,
    );
  });

  it('resolves backend test files in stable sorted order across mixed inputs', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'dp-ring-test-runners-'));
    try {
      await mkdir(join(repoRoot, 'tests', 'unit'), { recursive: true });
      await writeFile(join(repoRoot, 'tests', 'unit', 'alpha.test.mjs'), '');
      await writeFile(join(repoRoot, 'tests', 'unit', 'beta.test.mjs'), '');

      const files = resolveRequestedFiles({
        repoRoot,
        pathArgs: ['tests/unit/beta.test.mjs', 'tests/unit/*.test.mjs'],
      }).map((file) => file.replace(`${repoRoot}/`, ''));

      assert.deepEqual(files, [
        'tests/unit/alpha.test.mjs',
        'tests/unit/beta.test.mjs',
      ]);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('finds frontend test files only under the v2 operator-web test tree', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'dp-ring-frontend-runner-'));
    try {
      await mkdir(join(repoRoot, 'tests', 'ring-gui'), { recursive: true });
      await mkdir(join(repoRoot, 'tests', 'operator-web'), { recursive: true });
      await writeFile(join(repoRoot, 'tests', 'ring-gui', 'settings-state.test.ts'), '');
      await writeFile(join(repoRoot, 'tests', 'operator-web', 'demo-data.test.ts'), '');
      await writeFile(join(repoRoot, 'tests', 'operator-web', 'app-shell-navigation.test.ts'), '');

      const files = resolveFrontendTestFiles(repoRoot)
        .map((file) => file.replace(`${repoRoot}/`, ''))
        .sort();

      assert.deepEqual(files, [
        'tests/operator-web/app-shell-navigation.test.ts',
        'tests/operator-web/demo-data.test.ts',
      ]);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
