#!/usr/bin/env node

import { globSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultPattern = "tests/ring-gui/**/*.test.ts";

const files = globSync(defaultPattern, { cwd: repoRoot }).map((file) =>
  join(repoRoot, file),
);

if (files.length === 0) {
  console.error(`错误: 未找到匹配 ${defaultPattern} 的前端测试文件`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--test", ...files],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
