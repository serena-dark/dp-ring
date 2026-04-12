#!/usr/bin/env node
/**
 * `session_id` 推荐字面值 CLI（三段式）；语义见 docs/sessions/sessions.md；算法见 lib/session-id.mjs（代码中须 import 该模块，勿复制实现）。
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildSessionArchiveBasename, SESSION_ARCHIVE_DIR } from "./lib/session-id.mjs";

function usage() {
  console.log(`用法: node cli-tool/generate-session-id.mjs --name "概括短语" [选项]

生成 session_id 标准字面值（与其它载体同源）；可选 --mkdir 创建 ${SESSION_ARCHIVE_DIR}/<basename>/

三段式: s{N}-{name}-{6位随机}{YYYYMMDD}

选项:
  --name, --title
  --root <path>
  --mkdir
  --dry-run
  --help, -h

编程复用: import { buildSessionArchiveBasename } from "./cli-tool/lib/session-id.mjs"（路径按调用方调整）
`);
}

function parseArgs(argv) {
  const out = {
    name: null,
    root: process.cwd(),
    mkdir: false,
    dryRun: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--mkdir") out.mkdir = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--name" || a === "--title") out.name = argv[++i];
    else if (a === "--root") out.root = resolve(argv[++i]);
    else if (!a.startsWith("-") && out.name === null) out.name = a;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.name || !String(args.name).trim()) {
    console.error('错误: 请提供 --name "..."');
    process.exit(1);
  }

  const { basename, absDir, relDir } = await buildSessionArchiveBasename(args.root, args.name);

  console.log(basename);
  if (args.mkdir && !args.dryRun) {
    await mkdir(absDir, { recursive: true });
    console.error(`已创建目录: ${relDir}`);
  } else if (args.mkdir && args.dryRun) {
    console.error(`[dry-run] 将创建目录: ${relDir}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
