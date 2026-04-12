#!/usr/bin/env node
/**
 * 仓库内推荐的自动化测试入口：解析仓库根目录，默认收集 tests 下递归的 *.test.mjs，调用 node --test。
 * npm test 与此脚本等价；CI、文档与正式化工作流应引用本入口而非各处手写不同 glob。
 */
import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const DEFAULT_PATTERN = "tests/**/*.test.mjs";

function usage() {
  console.log(`用法: node cli-tool/run-tests.mjs [相对仓库根的测试文件或含 * 的 glob …] [-- …]

无参数：运行 ${DEFAULT_PATTERN} 下全部匹配文件。

-- 之后的内容原样传给 node（例如：--test-name-pattern=名称）。

示例:
  node cli-tool/run-tests.mjs
  node cli-tool/run-tests.mjs tests/cli-tool/generate-markdown.integration.test.mjs
  npm test
`);
}

/** @param {string} p */
function expandArg(p) {
  if (p.includes("*")) {
    const hits = globSync(p, { cwd: REPO_ROOT });
    return hits.map((h) => join(REPO_ROOT, h));
  }
  return [resolve(REPO_ROOT, p)];
}

function main() {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    usage();
    process.exit(0);
  }

  const dash = raw.indexOf("--");
  const pathArgs = dash === -1 ? raw : raw.slice(0, dash);
  const nodeExtra = dash === -1 ? [] : raw.slice(dash + 1);

  /** @type {string[]} */
  let files;
  if (pathArgs.length === 0) {
    const rel = globSync(DEFAULT_PATTERN, { cwd: REPO_ROOT });
    if (rel.length === 0) {
      console.error(`错误: 未找到匹配 ${DEFAULT_PATTERN} 的测试文件`);
      process.exit(1);
    }
    files = rel.map((f) => join(REPO_ROOT, f));
  } else {
    files = [];
    for (const p of pathArgs) files.push(...expandArg(p));
    files = [...new Set(files)];
    if (files.length === 0) {
      console.error("错误: 没有解析到任何测试文件");
      process.exit(1);
    }
  }

  const r = spawnSync(process.execPath, ["--test", ...nodeExtra, ...files], {
    stdio: "inherit",
    cwd: REPO_ROOT,
  });
  process.exit(r.status ?? 1);
}

main();
