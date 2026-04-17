import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const controlApiSource = readFileSync(resolve(repoRoot, 'services/control-api/src/main.rs'), 'utf8');
const openapi = readFileSync(resolve(repoRoot, 'contracts/openapi/openapi.yaml'), 'utf8');

function documentedPath(path) {
  return `\n  ${path}:\n`;
}

function extractControlApiRoutes(source) {
  return [...source.matchAll(/\.route\("([^"]+)"/g)]
    .map(([, route]) => route)
    .sort();
}

describe('control-api OpenAPI contract', () => {
  it('documents every current control-api route path', () => {
    const routes = extractControlApiRoutes(controlApiSource);
    assert.ok(routes.length > 0, 'expected to discover control-api routes');

    for (const route of routes) {
      assert.match(openapi, new RegExp(documentedPath(route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  it('documents bootstrap viewer override headers', () => {
    assert.match(openapi, /\/api\/bootstrap:[\s\S]*x-dp-user/);
    assert.match(openapi, /\/api\/bootstrap:[\s\S]*x-dp-role/);
  });

  it('uses current axum path parameter syntax in control-api routes', () => {
    assert.doesNotMatch(controlApiSource, /\.route\("[^"]+:id"/);
    assert.match(controlApiSource, /\.route\("\/api\/orgs\/\{id\}"/);
  });

  it('documents the shared not-found response for resource lookups', () => {
    assert.match(openapi, /ResourceNotFound:/);
    assert.match(openapi, /NotFoundError:/);
    assert.match(openapi, /enum: \[resource_not_found\]/);
  });

  it('documents activity stream event envelope semantics', () => {
    assert.match(controlApiSource, /\.event\(event\.kind\.clone\(\)\)/);
    assert.match(controlApiSource, /\.id\(event\.id\.clone\(\)\)/);
    assert.match(controlApiSource, /keep_alive\(KeepAlive::new\(\)\.interval\(Duration::from_secs\(10\)\)\)/);

    assert.match(openapi, /\/api\/activity\/stream:[\s\S]*ActivityEvent\.id/);
    assert.match(openapi, /\/api\/activity\/stream:[\s\S]*ActivityEvent\.kind/);
    assert.match(openapi, /\/api\/activity\/stream:[\s\S]*JSON-serialized `ActivityEvent` payload/);
    assert.match(openapi, /\/api\/activity\/stream:[\s\S]*id: evt_001[\s\S]*event: objective\.submitted\.v1/);
    assert.match(openapi, /\/api\/activity\/stream:[\s\S]*x-dp-keepalive-seconds: 10/);
  });
});
