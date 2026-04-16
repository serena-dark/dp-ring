#!/usr/bin/env node

import { spawn, execFile as rawExecFile } from 'node:child_process';
import { openSync } from 'node:fs';
import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { loadEnvFiles } from '../ring/lib/env.mjs';

const execFile = promisify(rawExecFile);
const entryPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(entryPath), '..');
loadEnvFiles(repoRoot);
const runtimeDir = join(repoRoot, '.ring', 'runtime');
const statePath = join(runtimeDir, 'service-stack.json');
const backendLogPath = join(runtimeDir, 'backend.log');
const frontendLogPath = join(runtimeDir, 'frontend.log');
const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const backend = {
  name: 'backend',
  pidKey: 'backend_pid',
  port: 3100,
  url: 'http://127.0.0.1:3100/api/orchestrator/workers',
  command: process.execPath,
  args: [join(repoRoot, 'ring', 'server.mjs')],
  cwd: repoRoot,
  env: {
    ...process.env,
    PORT: '3100',
  },
  logPath: backendLogPath,
  psMatch: 'ring/server.mjs',
};

const frontend = {
  name: 'frontend',
  pidKey: 'frontend_pid',
  port: 4174,
  url: 'http://127.0.0.1:4174/',
  proxyUrl: 'http://127.0.0.1:4174/api/orchestrator/workers',
  command: process.execPath,
  args: [viteBin, 'preview', '--host', '127.0.0.1', '--port', '4174'],
  cwd: repoRoot,
  env: process.env,
  logPath: frontendLogPath,
  psMatch: 'vite.js preview --host 127.0.0.1 --port 4174',
};

function logStep(message) {
  console.log(`[stack] ${message}`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function ensureRuntimeDir() {
  await mkdir(runtimeDir, { recursive: true });
}

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeState(state) {
  await ensureRuntimeDir();
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

async function removeState() {
  await rm(statePath, { force: true });
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function processCommand(pid) {
  try {
    const { stdout } = await execFile('ps', ['-p', String(pid), '-o', 'command='], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

export function parsePidList(output) {
  return output
    .split('\n')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export function parseSsPidOutput(output) {
  const matches = output.matchAll(/pid=(\d+)/g);
  return [...new Set(
    Array.from(matches, (match) => Number(match[1]))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];
}

async function pidsListeningOnPort(port) {
  try {
    const { stdout } = await execFile('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    return parsePidList(stdout);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      return [];
    }
  }

  try {
    const { stdout } = await execFile('ss', ['-ltnp', `sport = :${port}`], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });
    return parseSsPidOutput(stdout);
  } catch {
    return [];
  }
}

async function matchesManagedProcess(pid, expectedFragment) {
  if (!pid || !processExists(pid)) {
    return false;
  }
  const command = await processCommand(pid);
  return command.includes(expectedFragment);
}

async function terminatePid(pid, expectedFragment) {
  if (!(await matchesManagedProcess(pid, expectedFragment))) {
    return false;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return false;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!processExists(pid)) {
      return true;
    }
    await sleep(250);
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
  return !processExists(pid);
}

async function terminateManagedPortProcess(spec) {
  const pids = await pidsListeningOnPort(spec.port);
  let terminated = false;
  for (const pid of pids) {
    terminated = (await terminatePid(pid, spec.psMatch)) || terminated;
  }
  return terminated;
}

async function assertPortAvailable(spec) {
  const pids = await pidsListeningOnPort(spec.port);
  if (pids.length === 0) {
    return;
  }
  const commands = await Promise.all(pids.map((pid) => processCommand(pid)));
  throw new Error(
    `${spec.name} port ${spec.port} is already in use by: ${commands.filter(Boolean).join(' | ') || pids.join(', ')}`,
  );
}

async function runCommand(label, command, args, options = {}) {
  await ensureRuntimeDir();
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${label} exited with code ${code ?? 'null'}.`));
    });
  });
}

function spawnManagedProcess(spec) {
  const outFd = openSync(spec.logPath, 'a');
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: spec.env,
    detached: true,
    stdio: ['ignore', outFd, outFd],
  });
  child.unref();
  return child.pid;
}

async function healthFetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function healthFetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

async function waitForHealthy(label, probe, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await probe();
      return;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw new Error(`${label} health check timed out: ${lastError?.message ?? 'unknown error'}`);
}

async function frontendHealthy() {
  const html = await healthFetchText(frontend.url);
  if (!html.includes('<!doctype html>')) {
    throw new Error('frontend did not return HTML');
  }
}

async function backendHealthy() {
  const body = await healthFetchJson(backend.url);
  if (!body?.ok || !Array.isArray(body.data)) {
    throw new Error('backend did not return the worker registry payload');
  }
}

async function frontendProxyHealthy() {
  const body = await healthFetchJson(frontend.proxyUrl);
  if (!body?.ok || !Array.isArray(body.data)) {
    throw new Error('frontend proxy did not return the worker registry payload');
  }
}

async function tailLog(logPath) {
  try {
    const content = await readFile(logPath, 'utf-8');
    return content.split('\n').slice(-20).join('\n').trim();
  } catch {
    return '';
  }
}

async function buildFrontend() {
  logStep('building frontend preview bundle');
  await runCommand('vite build', process.execPath, [viteBin, 'build']);
}

async function stopManagedServices() {
  const state = await readState();
  if (!state) {
    logStep('no recorded managed state found, checking ports directly');
    await terminateManagedPortProcess(frontend);
    await terminateManagedPortProcess(backend);
    return;
  }

  logStep('stopping existing managed frontend/backend processes');
  await terminatePid(state.frontend_pid, frontend.psMatch);
  await terminatePid(state.backend_pid, backend.psMatch);
  await terminateManagedPortProcess(frontend);
  await terminateManagedPortProcess(backend);
  await removeState();
}

async function startStack() {
  logStep('preparing managed stack startup');
  await stopManagedServices();
  await ensureRuntimeDir();
  logStep('verifying backend and frontend ports are free');
  await assertPortAvailable(backend);
  await assertPortAvailable(frontend);
  await buildFrontend();

  const nextState = {
    version: 1,
    started_at: new Date().toISOString(),
    backend_pid: null,
    frontend_pid: null,
    backend_url: backend.url,
    frontend_url: frontend.url,
    frontend_proxy_url: frontend.proxyUrl,
    backend_log_path: backend.logPath,
    frontend_log_path: frontend.logPath,
  };

  try {
    logStep('starting backend service');
    nextState.backend_pid = spawnManagedProcess(backend);
    await waitForHealthy('backend', backendHealthy);

    logStep('starting frontend preview service');
    nextState.frontend_pid = spawnManagedProcess(frontend);
    await waitForHealthy('frontend', frontendHealthy);
    logStep('verifying frontend api proxy');
    await waitForHealthy('frontend proxy', frontendProxyHealthy);

    nextState.verified_at = new Date().toISOString();
    await writeState(nextState);
    logStep('managed stack is healthy');
    console.log(`Frontend: ${frontend.url}`);
    console.log(`Backend: ${backend.url.replace('/api/orchestrator/workers', '/')}`);
    console.log(`Proxy: ${frontend.proxyUrl}`);
    console.log(`Backend log: ${backend.logPath}`);
    console.log(`Frontend log: ${frontend.logPath}`);
  } catch (error) {
    if (nextState.frontend_pid) {
      await terminatePid(nextState.frontend_pid, frontend.psMatch);
    }
    if (nextState.backend_pid) {
      await terminatePid(nextState.backend_pid, backend.psMatch);
    }
    await removeState();
    const backendTail = await tailLog(backend.logPath);
    const frontendTail = await tailLog(frontend.logPath);
    if (backendTail) {
      console.error('\nBackend log tail:\n' + backendTail);
    }
    if (frontendTail) {
      console.error('\nFrontend log tail:\n' + frontendTail);
    }
    throw error;
  }
}

async function statusStack() {
  const state = await readState();
  const backendOk = await probeBoolean(backendHealthy);
  const frontendOk = await probeBoolean(frontendHealthy);
  const proxyOk = await probeBoolean(frontendProxyHealthy);

  console.log(
    JSON.stringify(
      {
        state_present: Boolean(state),
        started_at: state?.started_at ?? null,
        verified_at: state?.verified_at ?? null,
        backend_pid: state?.backend_pid ?? null,
        frontend_pid: state?.frontend_pid ?? null,
        backend_process_alive:
          state?.backend_pid ? await matchesManagedProcess(state.backend_pid, backend.psMatch) : false,
        frontend_process_alive:
          state?.frontend_pid ? await matchesManagedProcess(state.frontend_pid, frontend.psMatch) : false,
        backend_healthy: backendOk,
        frontend_healthy: frontendOk,
        proxy_healthy: proxyOk,
        frontend_url: frontend.url,
        backend_url: backend.url.replace('/api/orchestrator/workers', '/'),
        proxy_url: frontend.proxyUrl,
      },
      null,
      2,
    ),
  );

  if (!backendOk || !frontendOk || !proxyOk) {
    process.exitCode = 1;
  }
}

async function probeBoolean(fn) {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const command = process.argv[2] ?? 'start';

  if (command === 'start') {
    await startStack();
    return;
  }

  if (command === 'stop') {
    logStep('stopping managed services');
    await stopManagedServices();
    console.log('Stopped managed services.');
    return;
  }

  if (command === 'status') {
    await statusStack();
    return;
  }

  if (command === 'restart') {
    logStep('restarting managed services');
    await startStack();
    return;
  }

  console.error('Usage: node scripts/stack.mjs <start|stop|status|restart>');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === entryPath) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
