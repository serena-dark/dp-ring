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
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const { parts, params } = parseRoute(req.url);

  try {
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
    return err(res, 500, e.message ?? 'Internal error');
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
