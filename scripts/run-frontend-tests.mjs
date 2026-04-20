#!/usr/bin/env node

import { globSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '..');
export const DEFAULT_FRONTEND_PATTERN = 'tests/operator-web/**/*.test.ts';
export const FRONTEND_TEST_PATTERNS = [DEFAULT_FRONTEND_PATTERN];

export function resolveFrontendNodeArgs(argv = []) {
  const nodeExtra = argv[0] === '--' ? argv.slice(1) : argv;
  const invalidArgs = nodeExtra.filter((arg) => !arg.startsWith('-'));
  if (invalidArgs.length > 0) {
    throw new Error(`前端测试运行器不接受测试路径参数：${invalidArgs.join('、')}`);
  }
  return nodeExtra;
}

export function resolveFrontendTestFiles(repoRoot = REPO_ROOT) {
  const files = [...new Set(
    FRONTEND_TEST_PATTERNS.flatMap((pattern) =>
      globSync(pattern, { cwd: repoRoot }).map((file) => join(repoRoot, file)),
    ),
  )].sort();
  if (files.length === 0) {
    throw new Error(`未找到匹配 ${FRONTEND_TEST_PATTERNS.join(' 或 ')} 的前端测试文件`);
  }
  return files;
}

export function main(argv = process.argv.slice(2)) {
  let files;
  let nodeExtra;
  try {
    nodeExtra = resolveFrontendNodeArgs(argv);
    files = resolveFrontendTestFiles();
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...nodeExtra, ...files], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });

  process.exit(result.status ?? 1);
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
