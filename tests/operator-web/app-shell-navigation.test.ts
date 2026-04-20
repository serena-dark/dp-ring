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

describe("operator-web app shell navigation", () => {
  it("drives navigation from bootstrap metadata and keeps the live activity rail in the shell", () => {
    const appShell = readRepoFile("apps/operator-web/src/layouts/AppShell.tsx");

    assert.match(appShell, /bootstrapQuery\.data\?\.navigation \?\? EMPTY_COLLECTION/);
    assert.match(appShell, /navigation\.map\(\(item\) =>/);
    assert.match(appShell, /aria-label="Operator navigation"/);
    assert.match(
      appShell,
      /navigation\.find\(\(item\) => item\.path === location\.pathname\)\?\.label \?\? "Operator"/,
    );
    assert.match(appShell, /<TimelineRail events=\{liveEvents\} \/>/);
  });

  it("keeps the operator shell free of legacy secondary-nav and assistant-pane chrome", () => {
    const appShell = readRepoFile("apps/operator-web/src/layouts/AppShell.tsx");

    assert.doesNotMatch(appShell, /Operational secondary nav/i);
    assert.doesNotMatch(appShell, /secondaryNavItems/);
    assert.doesNotMatch(appShell, /nav-group-label/);
    assert.doesNotMatch(appShell, /assistant-pane/i);
    assert.doesNotMatch(appShell, /Ask, jump, adjust/);
  });

  it("registers the operator routes and shared resource detail route in the v2 router", () => {
    const router = readRepoFile("apps/operator-web/src/routes/router.tsx");

    assert.match(router, /path: "\/"/);
    assert.match(router, /path: "inbox"/);
    assert.match(router, /path: "objectives"/);
    assert.match(router, /path: "queue"/);
    assert.match(router, /path: "runs"/);
    assert.match(router, /path: "reviews"/);
    assert.match(router, /path: "governance"/);
    assert.match(router, /path: "findings"/);
    assert.match(router, /path: "insights"/);
    assert.match(router, /path: "workers"/);
    assert.match(router, /path: "resources\/\$kind\/\$id"/);
  });
});
