#!/usr/bin/env node

/**
 * Ring API server — HTTP REST interface for the ring protocol library.
 *
 * Exposes all ring operations over HTTP so that ring-gui (the frontend) and
 * external tools can interact with .ring/ state via a standard API.
 *
 * Usage:
 *   node ring/server.mjs                 # default port 3100
 *   PORT=4000 node ring/server.mjs       # custom port
 *
 * Routes — see ring/API.md for the full contract.
 */

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createRing } from './index.mjs';

const PORT = parseInt(process.env.PORT ?? '3100', 10);

// Find repo root (walk up from cwd)
import { readFile } from 'node:fs/promises';
let repoRoot = process.cwd();
while (true) {
  try {
    await readFile(resolve(repoRoot, '.ring', 'config.json'), 'utf-8');
    break;
  } catch {
    const parent = resolve(repoRoot, '..');
    if (parent === repoRoot) {
      console.error('Cannot find .ring/ directory.');
      process.exit(1);
    }
    repoRoot = parent;
  }
}

const ring = await createRing(repoRoot);
await ring.orchestrator.start();
const serviceStackPath = resolve(repoRoot, '.ring', 'runtime', 'service-stack.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function ok(res, data) { json(res, 200, { ok: true, data }); }
function created(res, data) { json(res, 201, { ok: true, data }); }
function err(res, status, message, details) { json(res, status, { ok: false, error: message, details }); }

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function probeUrl(url, expectJson = false) {
  if (!url) {
    return false;
  }
  try {
    const response = await fetch(url, {
      headers: expectJson ? { Accept: 'application/json' } : undefined,
    });
    if (!response.ok) {
      return false;
    }
    if (expectJson) {
      const payload = await response.json();
      return Boolean(payload?.ok);
    }
    const text = await response.text();
    return text.includes('<!doctype html>');
  } catch {
    return false;
  }
}

async function readServiceStackStatus() {
  const state = await readFile(serviceStackPath, 'utf-8')
    .then((raw) => JSON.parse(raw))
    .catch(() => null);

  const frontendUrl = state?.frontend_url ?? 'http://127.0.0.1:4174/';
  const backendUrl = state?.backend_url ?? 'http://127.0.0.1:3100/';
  const proxyUrl = state?.frontend_proxy_url ?? 'http://127.0.0.1:4174/api/orchestrator/workers';
  const backendHealthy = true;
  const frontendHealthy = await probeUrl(frontendUrl, false);
  const proxyHealthy = await probeUrl(proxyUrl, true);
  const backendProcessAlive = processAlive(state?.backend_pid ?? 0);
  const frontendProcessAlive = processAlive(state?.frontend_pid ?? 0);
  const overallStatus =
    backendHealthy && frontendHealthy && proxyHealthy
      ? 'healthy'
      : state
        ? frontendHealthy || proxyHealthy || backendProcessAlive || frontendProcessAlive
          ? 'degraded'
          : 'offline'
        : 'unmanaged';

  return {
    state_present: Boolean(state),
    started_at: state?.started_at ?? null,
    verified_at: state?.verified_at ?? null,
    backend_pid: state?.backend_pid ?? null,
    frontend_pid: state?.frontend_pid ?? null,
    backend_process_alive: backendProcessAlive,
    frontend_process_alive: frontendProcessAlive,
    backend_healthy: backendHealthy,
    frontend_healthy: frontendHealthy,
    proxy_healthy: proxyHealthy,
    overall_status: overallStatus,
    frontend_url: frontendUrl,
    backend_url: backendUrl,
    proxy_url: proxyUrl,
    backend_log_path: state?.backend_log_path ?? null,
    frontend_log_path: state?.frontend_log_path ?? null,
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

/** Parse URL: /api/requirement/r1-foo → { type: "requirement", id: "r1-foo", extra: null } */
function parseRoute(url) {
  const [path, qs] = (url ?? '').split('?');
  const parts = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const params = new URLSearchParams(qs ?? '');
  return { parts, params };
}

// Valid artifact types for routing
const TYPES = new Set(ring.config.artifact_types);

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Ring-Timestamp, X-Ring-Signature, X-Ring-Key-Version, X-Ring-Worker-Id',
    });
    res.end();
    return;
  }

  const { parts, params } = parseRoute(req.url);

  try {
    // --- Registry endpoints ---
    if (parts[0] === 'orchestrator') {
      if (parts[1] === 'agents' && req.method === 'GET') {
        return ok(res, await ring.orchestrator.getAgents());
      }
      if (parts[1] === 'workers' && req.method === 'GET') {
        return ok(res, await ring.orchestrator.getWorkers());
      }
      if (parts[1] === 'config' && req.method === 'GET') {
        return ok(res, await ring.orchestrator.getConfig());
      }
      if (parts[1] === 'config' && req.method === 'PATCH') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.updateConfig(body ?? {}));
      }
      if (parts[1] === 'jobs' && !parts[2] && req.method === 'GET') {
        return ok(res, await ring.orchestrator.listJobs());
      }
      if (parts[1] === 'jobs' && parts[2] && !parts[3] && req.method === 'GET') {
        try {
          return ok(res, await ring.orchestrator.readJob(parts[2]));
        } catch {
          return err(res, 404, `Not found: orchestrator/jobs/${parts[2]}`);
        }
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'agent-report' && req.method === 'POST') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.reportAgent(parts[2], body ?? {}));
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'interventions' && req.method === 'POST') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.updateIntervention(parts[2], body ?? {}));
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'followup' && parts[4] === 'dispatch' && req.method === 'POST') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.dispatchFollowup(parts[2], body ?? {}));
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'followup' && parts[4] === 'create-requirement' && req.method === 'POST') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.createFollowupRequirement(parts[2], body ?? {}));
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'retry' && req.method === 'POST') {
        return ok(res, await ring.orchestrator.retryJob(parts[2]));
      }
      if (parts[1] === 'jobs' && parts[2] && parts[3] === 'audit' && req.method === 'POST') {
        return ok(res, await ring.orchestrator.runAudit(parts[2]));
      }
      if (parts[1] === 'tick' && req.method === 'POST') {
        return ok(res, await ring.orchestrator.tick());
      }
      if (parts[1] === 'requirements' && req.method === 'POST') {
        const body = await readBody(req);
        return created(res, await ring.orchestrator.createRequirementDispatch(body ?? {}));
      }
      return err(res, 404, 'Not found');
    }

    if (parts[0] === 'runtime') {
      if (parts[1] === 'services' && req.method === 'GET') {
        return ok(res, await readServiceStackStatus());
      }
      return err(res, 404, 'Not found');
    }

    if (parts[0] === 'ui') {
      if (parts[1] === 'config' && req.method === 'GET') {
        return ok(res, await ring.ui.getConfig());
      }
      if (parts[1] === 'config' && req.method === 'PATCH') {
        const body = await readBody(req);
        return ok(res, await ring.ui.updateConfig(body ?? {}));
      }
      if (parts[1] === 'themes' && req.method === 'GET') {
        return ok(res, await ring.ui.getThemes());
      }
      return err(res, 404, 'Not found');
    }

    if (parts[0] === 'dispatch') {
      if (parts[1] === 'protocols' && req.method === 'GET') {
        return ok(res, await ring.orchestrator.getDispatchProtocols());
      }
      if (parts[1] === 'bundles' && !parts[2] && req.method === 'GET') {
        return ok(res, await ring.orchestrator.listDispatchBundles());
      }
      if (parts[1] === 'bundles' && !parts[2] && req.method === 'POST') {
        const body = await readBody(req);
        return created(res, await ring.orchestrator.submitDispatchBundle(body ?? {}));
      }
      if (parts[1] === 'bundles' && parts[2] && !parts[3] && req.method === 'GET') {
        try {
          return ok(res, await ring.orchestrator.readDispatchBundle(parts[2]));
        } catch {
          return err(res, 404, `Not found: dispatch/bundles/${parts[2]}`);
        }
      }
      if (parts[1] === 'bundles' && parts[2] && parts[3] === 'report' && req.method === 'POST') {
        const body = await readBody(req);
        return ok(res, await ring.orchestrator.reportDispatchBundle(parts[2], body ?? {}));
      }
      return err(res, 404, 'Not found');
    }

    // --- Registry endpoints ---
    if (parts[0] === 'registry') {
      if (parts[1] === 'leaderboard' && req.method === 'GET') {
        return ok(res, await ring.registry.getAll());
      }
      if (parts[1] === 'rank' && parts[2] && req.method === 'GET') {
        return ok(res, await ring.registry.rank(parts[2]));
      }
      return err(res, 404, 'Not found');
    }

    // --- Gate endpoint ---
    if (parts[0] === 'gate' && parts[1] && req.method === 'GET') {
      const result = await ring.checkGate(parts[1]);
      return ok(res, result);
    }

    // --- Knowledge endpoint ---
    if (parts[0] === 'knowledge' && parts[1] && req.method === 'GET') {
      const minConf = params.get('min_confidence');
      const items = await ring.knowledge(parts[1], minConf ? parseFloat(minConf) : undefined);
      return ok(res, items);
    }

    // --- Artifact CRUD ---
    const type = parts[0];
    if (!TYPES.has(type)) return err(res, 404, `Unknown type: ${type}`);

    const id = parts[1];
    const extra = parts[2]; // e.g., "context" for /session/:id/context

    // GET /api/<type>/:id/context — session context
    if (type === 'session' && id && extra === 'context' && req.method === 'GET') {
      const ctx = await ring.sessionContext(id);
      return ok(res, ctx);
    }

    // POST /api/task/:id/finalize — verify scope/build/cleanup and request judgement
    if (type === 'task' && id && extra === 'finalize' && req.method === 'POST') {
      const body = await readBody(req);
      return ok(res, await ring.taskExecution.finalize(id, body ?? {}));
    }

    // POST /api/task/:id/judge — accept/reject the finalized task
    if (type === 'task' && id && extra === 'judge' && req.method === 'POST') {
      const body = await readBody(req);
      return ok(res, await ring.taskExecution.judge(id, body ?? {}));
    }

    // POST /api/task/:id/replan — decide whether a failed task should create a successor task
    if (type === 'task' && id && extra === 'replan' && req.method === 'POST') {
      const body = await readBody(req);
      return ok(res, await ring.taskExecution.replan(id, body ?? {}));
    }

    // POST /api/workflow-run/:id/report — progress/completion signal from an external workflow worker
    if (type === 'workflow-run' && id && extra === 'report' && req.method === 'POST') {
      const body = await readBody(req);
      return ok(res, await ring.sessionRunner.reportWorkflowRun(id, body ?? {}, { headers: req.headers }));
    }

    // GET /api/<type> — list
    if (!id && req.method === 'GET') {
      let items = await ring.list(type);
      const statusFilter = params.get('status');
      if (statusFilter) items = items.filter(i => i.status === statusFilter);
      return ok(res, items);
    }

    // GET /api/<type>/:id — read
    if (id && !extra && req.method === 'GET') {
      try {
        const item = await ring.read(type, id);
        return ok(res, item);
      } catch { return err(res, 404, `Not found: ${type}/${id}`); }
    }

    // POST /api/<type> — create
    if (!id && req.method === 'POST') {
      const body = await readBody(req);
      const genId = body.id ?? await ring.newId(type, { name: body.name ?? 'unnamed', parentId: body.parent_id });
      const result = await ring.create(type, {
        id: genId,
        status: body.status,
        created_by: body.created_by ?? 'ring-gui',
        session_id: body.session_id ?? null,
        data: body.data ?? {},
      });
      if (!result.ok) return err(res, 400, 'Validation failed', result.errors);
      return created(res, result.artifact);
    }

    // PATCH /api/<type>/:id — update
    if (id && !extra && req.method === 'PATCH') {
      const body = await readBody(req);
      const patch = {};
      if (body.status) patch.status = body.status;
      if (body.data) patch.data = body.data;
      if (body.session_id !== undefined) patch.session_id = body.session_id;
      const result = await ring.update(type, id, patch);
      if (!result.ok) return err(res, 400, 'Update failed', result.errors);
      return ok(res, result.artifact);
    }

    return err(res, 405, 'Method not allowed');
  } catch (e) {
    const status =
      typeof e?.statusCode === 'number' ? e.statusCode : 500;
    return err(
      res,
      status,
      e?.message ?? 'Internal error',
      e?.details,
    );
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = createServer(handler);
server.listen(PORT, () => {
  console.log(`Ring API server listening on http://localhost:${PORT}`);
  console.log(`Repo root: ${repoRoot}`);
});
