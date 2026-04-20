#!/usr/bin/env node

import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');
export const DEFAULT_BACKEND_PATTERN = 'tests/**/*.test.mjs';

function usage() {
  console.log(`用法: node scripts/run-backend-tests.mjs [相对仓库根的测试文件或含 * 的 glob …] [-- …]

无参数：运行 ${DEFAULT_BACKEND_PATTERN} 下全部匹配文件。

-- 之后的内容原样传给 node（例如：--test-name-pattern=名称）。

示例:
  node scripts/run-backend-tests.mjs
  node scripts/run-backend-tests.mjs tests/scripts/test-runners.test.mjs
  npm run test:backend
`);
}

function expandArg(repoRoot, pattern) {
  if (pattern.includes('*')) {
    return globSync(pattern, { cwd: repoRoot }).map((match) => join(repoRoot, match));
  }
  return [resolve(repoRoot, pattern)];
}

export function resolveRequestedFiles({ repoRoot = REPO_ROOT, pathArgs = [] } = {}) {
  if (pathArgs.length === 0) {
    const matches = globSync(DEFAULT_BACKEND_PATTERN, { cwd: repoRoot });
    if (matches.length === 0) {
      throw new Error(`未找到匹配 ${DEFAULT_BACKEND_PATTERN} 的测试文件`);
    }
    return matches.map((match) => join(repoRoot, match)).sort();
  }

  const files = [...new Set(pathArgs.flatMap((pattern) => expandArg(repoRoot, pattern)))].sort();
  if (files.length === 0) {
    throw new Error('没有解析到任何测试文件');
  }
  return files;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const dashIndex = argv.indexOf('--');
  const pathArgs = dashIndex === -1 ? argv : argv.slice(0, dashIndex);
  const nodeExtra = dashIndex === -1 ? [] : argv.slice(dashIndex + 1);

  let files;
  try {
    files = resolveRequestedFiles({ pathArgs });
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ['--test', ...nodeExtra, ...files], {
    stdio: 'inherit',
    cwd: REPO_ROOT,
  });
  process.exit(result.status ?? 1);
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
