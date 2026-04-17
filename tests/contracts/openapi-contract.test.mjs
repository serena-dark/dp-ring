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
    .map(([, route]) => route.replace(/:id/g, '{id}'))
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

  it('documents the shared not-found response for resource lookups', () => {
    assert.match(openapi, /ResourceNotFound:/);
    assert.match(openapi, /NotFoundError:/);
    assert.match(openapi, /enum: \[resource_not_found\]/);
  });
});
