#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const operatorWebNodeModules = join(repoRoot, 'apps', 'operator-web', 'node_modules');

export function resolveCargoCommand({ env = process.env } = {}) {
  if (env.CARGO) {
    return env.CARGO;
  }

  const cargoFromHome = join(env.HOME ?? homedir(), '.cargo', 'bin', 'cargo');
  if (existsSync(cargoFromHome)) {
    return cargoFromHome;
  }

  const result = spawnSync('cargo', ['--version'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  if ((result.status ?? 1) === 0) {
    return 'cargo';
  }

  return null;
}

export function runStep(index, total, label, command, args) {
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

export function buildRegressionSteps({
  operatorWebDepsInstalled = existsSync(operatorWebNodeModules),
  cargoCommand = resolveCargoCommand(),
} = {}) {
  const steps = [
    ['Lint frontend/backend sources', 'npm', ['run', 'lint']],
    ['Typecheck frontend TypeScript', 'npm', ['run', 'typecheck']],
  ];

  if (!operatorWebDepsInstalled) {
    steps.push([
      'Install v2 operator console dependencies',
      'npm',
      ['run', 'v2:web:install'],
    ]);
  }

  steps.push(
    ['Typecheck the v2 operator console', 'npm', ['run', 'v2:web:typecheck']],
    ['Build the v2 operator console', 'npm', ['run', 'v2:web:build']],
  );

  if (cargoCommand) {
    steps.push(['Compile the v2 control-api service', cargoCommand, ['check', '-p', 'control-api']]);
  }

  steps.push(
    ['Run backend and CLI tests', 'npm', ['run', 'test:backend']],
    ['Run frontend state regression tests', 'npm', ['run', 'test:frontend']],
  );

  return steps;
}

export function main() {
  console.log('[regression] starting full regression suite');

  const steps = buildRegressionSteps();
  steps.forEach(([label, command, args], index) => {
    runStep(index + 1, steps.length, label, command, args);
  });

  console.log('\n[regression] all regression checks passed');
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
