import { execFileSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRing } from '../../ring/index.mjs';

const CLI_PATH = resolve(import.meta.dirname, '../../ring/cli.mjs');

function runCli(args, { cwd }) {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

async function createIsolatedCliRepo() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'ring-cli-'));
  const ringDir = join(repoRoot, '.ring');

  await cp(resolve(import.meta.dirname, '../../.ring/schemas'), join(ringDir, 'schemas'), {
    recursive: true,
  });
  await cp(resolve(import.meta.dirname, '../../.ring/config.json'), join(ringDir, 'config.json'));
  await cp(resolve(import.meta.dirname, '../../.ring/orchestrator'), join(ringDir, 'orchestrator'), {
    recursive: true,
  });

  const dirs = [
    'sessions',
    'requirements',
    'milestones',
    'tasks',
    'workflows',
    'workflow-runs',
    'evaluations',
    'feedback',
    'distillations',
    'registry',
  ];
  for (const dir of dirs) {
    await mkdir(join(ringDir, dir), { recursive: true });
  }

  await writeFile(
    join(ringDir, 'registry', 'leaderboard.json'),
    JSON.stringify({ updated_at: '2026-04-08T00:00:00Z', rankings: {} }),
  );

  return {
    repoRoot,
    async cleanup() {
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
}

describe('ring cli', { concurrency: 1 }, async () => {
  let fixture;

  before(async () => {
    fixture = await createIsolatedCliRepo();
  });

  after(async () => {
    await fixture.cleanup();
  });

  it('shows submit-requirement in --help output', () => {
    const output = runCli(['--help'], { cwd: fixture.repoRoot });
    assert.match(output, /submit-requirement/);
  });

  it('submits a requirement dispatch job with repeated --criterion flags', async () => {
    const output = runCli([
      'submit-requirement',
      '--name',
      'CLI Dispatch',
      '--description',
      'Drive orchestrator requirement submission from the command line.',
      '--priority',
      'critical',
      '--created-by',
      'cli-test',
      '--criterion',
      'Creates a requirement artifact',
      '--criterion',
      'Creates an orchestrator job',
    ], { cwd: fixture.repoRoot });

    const result = JSON.parse(output);
    assert.equal(result.requirement.status, 'analyzing');
    assert.equal(result.job.status, 'requirement_dispatched');
    assert.equal(result.requirement.created_by, 'cli-test');
    assert.deepEqual(result.requirement.data.acceptance_criteria, [
      { id: 'ac1', description: 'Creates a requirement artifact', satisfied: false },
      { id: 'ac2', description: 'Creates an orchestrator job', satisfied: false },
    ]);

    const ring = await createRing(fixture.repoRoot);
    const persistedRequirement = await ring.read('requirement', result.requirement.id);
    assert.equal(persistedRequirement.status, 'analyzing');

    const scaffold = await readFile(
      join(fixture.repoRoot, result.job.requirement_document.document.path),
      'utf-8',
    );
    assert.match(scaffold, /^# CLI Dispatch/m);
  });
});
