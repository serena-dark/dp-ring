import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

describe("operator-web shared surface primitives", () => {
  it("defines a reusable table primitive with an explicit empty state", () => {
    const dataTable = readRepoFile("apps/operator-web/src/components/DataTable.tsx");

    assert.match(dataTable, /export function DataTable/);
    assert.match(dataTable, /emptyLabel = "No records"/);
    assert.match(dataTable, /rows\.length === 0/);
    assert.match(dataTable, /columns\.map/);
    assert.match(dataTable, /<table className="data-table">/);
  });

  it("centralizes resource, status, datetime, and list cell rendering helpers", () => {
    const renderers = readRepoFile("apps/operator-web/src/components/table-renderers.tsx");

    assert.match(renderers, /export function resourceLink/);
    assert.match(renderers, /to="\/resources\/\$kind\/\$id"/);
    assert.match(renderers, /export function renderStatus/);
    assert.match(renderers, /StatusBadge/);
    assert.match(renderers, /export function renderDateTime/);
    assert.match(renderers, /formatDateTime/);
    assert.match(renderers, /export function renderList/);
  });

  it("registers governance artifact kinds in the typed snapshot model and API client", () => {
    const types = readRepoFile("apps/operator-web/src/lib/types.ts");
    const api = readRepoFile("apps/operator-web/src/lib/api.ts");

    assert.match(types, /export interface PublicationRoot/);
    assert.match(types, /export interface ValidationReport/);
    assert.match(types, /export interface ValidationResult/);
    assert.match(types, /publication_roots: PublicationRoot\[\];/);
    assert.match(types, /validation_reports: ValidationReport\[\];/);
    assert.match(types, /validation_results: ValidationResult\[\];/);
    assert.match(types, /\| "publication-roots"/);
    assert.match(types, /\| "validation-reports"/);
    assert.match(types, /\| "validation-results"/);
    assert.match(api, /"publication-roots": \(\) =>/);
    assert.match(api, /"validation-reports": \(\) =>/);
    assert.match(api, /"validation-results": \(\) =>/);
  });

  it("reuses the shared table and renderer primitives across the main operator surfaces", () => {
    const pages = readRepoFile("apps/operator-web/src/routes/pages.tsx");
    const tableCount = pages.match(/<DataTable/g)?.length ?? 0;

    assert.ok(tableCount >= 15, `expected at least 15 DataTable uses, got ${tableCount}`);
    assert.match(pages, /export function GovernancePage/);
    assert.match(pages, /resourceLink\("publication-roots"/);
    assert.match(pages, /resourceLink\("validation-reports"/);
    assert.match(pages, /resourceLink\("validation-results"/);
    assert.match(pages, /renderStatus/);
    assert.match(pages, /renderDateTime/);
    assert.doesNotMatch(pages, /TextField/);
    assert.doesNotMatch(pages, /assistant-pane/i);
  });
});
