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

describe("ring-gui shared text field", () => {
  it("defines a reusable text field component for input and textarea surfaces", () => {
    const source = readRepoFile("ring-gui/components/TextField.tsx");

    assert.match(source, /export function TextField/);
    assert.match(source, /multiline/);
    assert.match(source, /onValueChange/);
  });

  it("uses the shared component in assistant and compose windows", () => {
    const assistantPane = readRepoFile("ring-gui/components/AssistantPane.tsx");
    const requirementComposer = readRepoFile("ring-gui/components/RequirementComposerCard.tsx");
    const feedbackList = readRepoFile("ring-gui/pages/FeedbackList.tsx");
    const taskList = readRepoFile("ring-gui/pages/TaskList.tsx");
    const sessionList = readRepoFile("ring-gui/pages/SessionList.tsx");

    for (const source of [
      assistantPane,
      requirementComposer,
      feedbackList,
      taskList,
      sessionList,
    ]) {
      assert.match(source, /TextField/);
    }

    assert.doesNotMatch(assistantPane, /Ask, jump, adjust/);
    assert.doesNotMatch(
      assistantPane,
      /Ask about records, rankings, filters, or draft a safe action\./,
    );
    assert.doesNotMatch(assistantPane, /assistant-pane-header/);
    assert.doesNotMatch(assistantPane, /assistant-feed/);
    assert.doesNotMatch(assistantPane, /assistant-form-footer/);
  });
});
