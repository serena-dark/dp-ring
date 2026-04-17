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

describe("ring-gui layout navigation", () => {
  it("does not render the Operational secondary nav block", () => {
    const layout = readRepoFile("ring-gui/components/Layout.tsx");

    assert.doesNotMatch(layout, /Operational/);
    assert.doesNotMatch(layout, /Secondary navigation/);
    assert.doesNotMatch(layout, /secondaryNavItems/);
    assert.doesNotMatch(layout, /nav-group-label/);
    assert.doesNotMatch(layout, /nav-link-secondary/);
  });
});
