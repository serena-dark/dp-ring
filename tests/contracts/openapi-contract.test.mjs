import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../..');
const controlApiSource = readFileSync(resolve(repoRoot, 'services/control-api/src/main.rs'), 'utf8');
const platformTypesSource = readFileSync(resolve(repoRoot, 'crates/platform-types/src/lib.rs'), 'utf8');
const openapi = readFileSync(resolve(repoRoot, 'contracts/openapi/openapi.yaml'), 'utf8');

function documentedPath(path) {
  return `\n  ${path}:\n`;
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      assert.match(openapi, new RegExp(escapeForRegex(documentedPath(route))));
    }
  });

  it('surfaces governance artifact collection routes from the seeded snapshot', () => {
    const routes = extractControlApiRoutes(controlApiSource);
    const governanceRoutes = [
      '/api/publication-roots',
      '/api/publication-roots/{id}',
      '/api/validation-reports',
      '/api/validation-reports/{id}',
      '/api/validation-results',
      '/api/validation-results/{id}',
    ];

    for (const route of governanceRoutes) {
      assert.ok(routes.includes(route), `expected control-api to register ${route}`);
      assert.match(openapi, new RegExp(escapeForRegex(documentedPath(route))));
    }

    assert.match(platformTypesSource, /pub struct PlatformSnapshot[\s\S]*pub publication_roots: Vec<PublicationRoot>/);
    assert.match(platformTypesSource, /pub struct PlatformSnapshot[\s\S]*pub validation_reports: Vec<ValidationReport>/);
    assert.match(platformTypesSource, /pub struct PlatformSnapshot[\s\S]*pub validation_results: Vec<ValidationResult>/);
    assert.match(platformTypesSource, /demo_snapshot\(\) -> PlatformSnapshot[\s\S]*publication_roots: vec!\[/);
    assert.match(platformTypesSource, /demo_snapshot\(\) -> PlatformSnapshot[\s\S]*validation_reports: vec!\[/);
    assert.match(platformTypesSource, /demo_snapshot\(\) -> PlatformSnapshot[\s\S]*validation_results: vec!\[/);
  });

  it('documents governance artifact schemas used by operator-web', () => {
    assert.match(openapi, /PublicationRoot:/);
    assert.match(openapi, /PublicationMemberDescriptor:/);
    assert.match(openapi, /ValidationReport:/);
    assert.match(openapi, /ValidationResult:/);
    assert.match(openapi, /GovernanceDescriptor:/);
    assert.match(openapi, /GovernanceLocator:/);
    assert.match(openapi, /membership_digest:/);
    assert.match(openapi, /subject_ref:/);
    assert.match(openapi, /detail_result_ids:/);
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
