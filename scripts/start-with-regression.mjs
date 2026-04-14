#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2] ?? 'restart';

if (!['start', 'restart'].includes(action)) {
  console.error('Usage: node scripts/start-with-regression.mjs <start|restart>');
  process.exit(1);
}

function run(label, command, args) {
  console.log(`\n[workflow] ${label}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if ((result.status ?? 1) !== 0) {
    console.error(`\n[workflow] failed during: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('[workflow] phase 1/2 regression checks');
run('Run regression suite', process.execPath, [join(repoRoot, 'scripts', 'regression.mjs')]);

console.log('\n[workflow] phase 2/2 managed stack startup');
run(
  `Run managed stack ${action}`,
  process.execPath,
  [join(repoRoot, 'scripts', 'stack.mjs'), action],
);

console.log('\n[workflow] regression and startup completed successfully');
