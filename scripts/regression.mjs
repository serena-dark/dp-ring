#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function runStep(index, total, label, command, args) {
  console.log(`\n[regression ${index}/${total}] ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if ((result.status ?? 1) !== 0) {
    console.error(`\n[regression] failed at step: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const steps = [
  ['Lint frontend/backend sources', 'npm', ['run', 'lint']],
  ['Typecheck frontend TypeScript', 'npm', ['run', 'typecheck']],
  ['Typecheck the v2 operator console', 'npm', ['run', 'v2:web:typecheck']],
  ['Run backend and CLI tests', 'npm', ['run', 'test:backend']],
  ['Run frontend state regression tests', 'npm', ['run', 'test:frontend']],
];

console.log('[regression] starting full regression suite');

steps.forEach(([label, command, args], index) => {
  runStep(index + 1, steps.length, label, command, args);
});

console.log('\n[regression] all regression checks passed');
