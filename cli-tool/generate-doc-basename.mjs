#!/usr/bin/env node
/**
 * 打印非 Session 基名；计算逻辑在 lib/doc-basename.mjs。
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { computeDocBasename, SIMPLE_KINDS } from "./lib/doc-basename.mjs";

function tableHelp() {
  const rows = Object.entries(SIMPLE_KINDS)
    .map(([k, v]) => `│ ${k.padEnd(12)} │ ${v.prefix}{N} │ ${v.relativeDir} │`)
    .join("\n");
  return `
单列 kind: 
${rows}
另有: workflow (+ --task), step (+ --task --workflow), milestone (+ --requirement-package r1-...)
`;
}

function usage() {
  console.log(`用法: node cli-tool/generate-doc-basename.mjs --kind <类型> --name "概括短语" [选项]
${tableHelp()}
milestone 须: --requirement-package <r1-...目录名>
workflow 须: --task <T>
step 须:     --task <T> --workflow <W>

选项: --root  --mkdir  --dry-run  --help
`);
}

function parseArgs(argv) {
  const out = {
    kind: null,
    name: null,
    task: null,
    workflow: null,
    requirementPackage: null,
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
    else if (a === "--kind") out.kind = argv[++i];
    else if (a === "--name" || a === "--title") out.name = argv[++i];
    else if (a === "--root") out.root = resolve(argv[++i]);
    else if (a === "--task") out.task = Number.parseInt(argv[++i], 10);
    else if (a === "--workflow") out.workflow = Number.parseInt(argv[++i], 10);
    else if (a === "--requirement-package") out.requirementPackage = argv[++i];
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

  const simpleKinds = Object.keys(SIMPLE_KINDS);
  const allKinds = [...simpleKinds, "workflow", "step", "milestone"];

  if (!args.kind || !allKinds.includes(args.kind)) {
    console.error(`错误: 请指定有效 --kind：${allKinds.join(", ")}`);
    process.exit(1);
  }
  if (!args.name || !String(args.name).trim()) {
    console.error('错误: 请提供 --name "..."');
    process.exit(1);
  }

  const meta = await computeDocBasename({
    repoRoot: args.root,
    kind: args.kind,
    nameInput: args.name,
    task: args.task,
    workflow: args.workflow,
    requirementPackage: args.requirementPackage,
  });

  if (meta.kind === "step") {
    if (args.mkdir) console.error("提示: step 仅输出文件名；已忽略 --mkdir。");
    console.log(`${meta.basename}.md`);
    console.error(`完整路径建议: ${meta.fileAbs}`);
    return;
  }

  console.log(meta.basename);

  let mkdirTarget = meta.dirAbs;
  let relForMsg = meta.dirRel;
  if (args.kind === "milestone") {
    mkdirTarget = null;
    if (args.mkdir) {
      console.error("提示: milestone 为单文件路径，请用 generate-markdown；已忽略 --mkdir。");
    }
  }

  if (args.mkdir && mkdirTarget && !args.dryRun) {
    await mkdir(mkdirTarget, { recursive: true });
    console.error(`已创建目录: ${relForMsg}`);
  } else if (args.mkdir && mkdirTarget && args.dryRun) {
    console.error(`[dry-run] 将创建目录: ${relForMsg}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
