/**
 * generate-markdown.mjs 集成测试：独立 `--root` 临时目录，不污染仓库 docs/。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const SCRIPT = join(REPO_ROOT, "cli-tool", "generate-markdown.mjs");

/** @param {string[]} args @param {{ cwd?: string }} [opts] */
function runGenerateMarkdown(args, opts = {}) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: opts.cwd ?? REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function assertFails(args, opts = {}) {
  assert.throws(
    () =>
      execFileSync(process.execPath, [SCRIPT, ...args], {
        encoding: "utf8",
        cwd: opts.cwd ?? REPO_ROOT,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    (err) => /** @type {NodeJS.ErrnoException & { status: number }} */ (err).status === 1
  );
}

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "gm-test-"));
}

test("help exits 0 and prints 用法", () => {
  const out = runGenerateMarkdown(["--help"]);
  assert.match(out, /用法/);
});

test("task: creates main md under docs/tasks and references/", () => {
  const root = tempRoot();
  runGenerateMarkdown(["--type", "task", "--name", "integration task", "--root", root]);
  const tasksDir = join(root, "docs", "tasks");
  const entries = readdirSync(tasksDir).filter((n) => n.startsWith("t") && n.includes("integration-task"));
  assert.equal(entries.length, 1, "one t*-integration-task dir");
  const taskDir = join(tasksDir, entries[0]);
  assert.ok(existsSync(join(taskDir, "references")));
  const md = entries[0].replace(/\/$/, "") + ".md";
  assert.ok(existsSync(join(taskDir, md)), `expected ${md}`);
});

test("requirement: creates milestones/ and references/", () => {
  const root = tempRoot();
  runGenerateMarkdown(["--type", "requirement", "--name", "integration req", "--root", root]);
  const reqDir = join(root, "docs", "requirements");
  const entries = readdirSync(reqDir).filter((n) => n.startsWith("r") && n.includes("integration-req"));
  assert.equal(entries.length, 1);
  const dir = join(reqDir, entries[0]);
  assert.ok(existsSync(join(dir, "milestones")));
  assert.ok(existsSync(join(dir, "references")));
  assert.ok(existsSync(join(dir, `${entries[0]}.md`)));
});

test("milestone: writes under package milestones/", () => {
  const root = tempRoot();
  const pkg = "r1-gmtest-milestone";
  runGenerateMarkdown([
    "--type",
    "milestone",
    "--name",
    "milestone one",
    "--requirement-package",
    pkg,
    "--root",
    root,
  ]);
  const msDir = join(root, "docs", "requirements", pkg, "milestones");
  const mds = readdirSync(msDir).filter((f) => f.endsWith(".md") && f.startsWith("r1m"));
  assert.ok(mds.length >= 1);
  const text = readFileSync(join(msDir, mds[0]), "utf8");
  assert.match(text, /milestone one|Milestone one|\{\{TITLE\}\}/u);
});

test("prerequisites: fixed path prerequisites.md", () => {
  const root = tempRoot();
  const pkg = "r1-gmtest-prereq";
  runGenerateMarkdown(["--type", "prerequisites", "--requirement-package", pkg, "--root", root]);
  const p = join(root, "docs", "requirements", pkg, "milestones", "prerequisites.md");
  assert.ok(existsSync(p));
});

test("workflow: creates logs/.gitkeep and main md", () => {
  const root = tempRoot();
  const taskNum = 42;
  runGenerateMarkdown([
    "--type",
    "workflow",
    "--task",
    String(taskNum),
    "--name",
    "integration workflow",
    "--root",
    root,
  ]);
  const wfRoot = join(root, "docs", "tasks", "workflows");
  const dirs = readdirSync(wfRoot).filter((n) => n.startsWith(`t${taskNum}w`) && n.includes("integration-workflow"));
  assert.equal(dirs.length, 1);
  const dir = join(wfRoot, dirs[0]);
  assert.ok(existsSync(join(dir, "logs", ".gitkeep")));
  assert.ok(existsSync(join(dir, `${dirs[0]}.md`)));
});

test("feedback: inner markdown uses name slug", () => {
  const root = tempRoot();
  runGenerateMarkdown(["--type", "feedback", "--name", "integration feedback", "--root", root]);
  const fbRoot = join(root, "docs", "feedbacks");
  const dirs = readdirSync(fbRoot).filter((n) => n.startsWith("f") && n.includes("integration-feedback"));
  assert.equal(dirs.length, 1);
  const inner = join(fbRoot, dirs[0], "integration-feedback.md");
  assert.ok(existsSync(inner));
});

test("validation: milestone without --requirement-package fails", () => {
  assertFails(["--type", "milestone", "--name", "x"]);
});

test("validation: workflow without --task fails", () => {
  assertFails(["--type", "workflow", "--name", "x"]);
});

test("validation: prerequisites without --requirement-package fails", () => {
  assertFails(["--type", "prerequisites"]);
});
