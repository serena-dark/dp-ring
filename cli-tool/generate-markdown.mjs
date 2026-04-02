#!/usr/bin/env node
/**
 * 从固定模板生成 Markdown 文件；**路径与基名仅通过** lib/doc-basename（及 prerequisites 的固定名）解析，不手写命名规则。
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDocBasename } from "./lib/doc-basename.mjs";
import { takeUpToFiveWords } from "./lib/naming-shared.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

const DOC_TYPES = ["requirement", "milestone", "prerequisites", "task", "workflow", "feedback"];

function usage() {
  console.log(`用法: node cli-tool/generate-markdown.mjs --type <${DOC_TYPES.join("|")}> --name "概括短语" [选项]

命名由 lib/doc-basename 计算（prerequisites 固定为 milestones/prerequisites.md）。
须配合:
  --requirement-package <r1-...>   milestone / prerequisites 必填
  --task <T>                       workflow 必填

选项:
  --display-title "显示标题"   不填则用 --name 原串作标题
  --root <path>
  --dry-run
  --force                    prerequisites 已存在时覆盖
  --help, -h
`);
}

function parseArgs(argv) {
  const out = {
    type: null,
    name: null,
    displayTitle: null,
    requirementPackage: null,
    task: null,
    root: process.cwd(),
    dryRun: false,
    force: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--type") out.type = argv[++i];
    else if (a === "--name" || a === "--title") out.name = argv[++i];
    else if (a === "--display-title") out.displayTitle = argv[++i];
    else if (a === "--root") out.root = resolve(argv[++i]);
    else if (a === "--requirement-package") out.requirementPackage = argv[++i];
    else if (a === "--task") out.task = Number.parseInt(argv[++i], 10);
    else if (!a.startsWith("-") && out.name === null) out.name = a;
  }
  return out;
}

function renderTemplate(str, ctx) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (ctx[key] != null ? String(ctx[key]) : ""));
}

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadTemplate(type) {
  const p = join(TEMPLATES_DIR, `${type}.md`);
  return readFile(p, "utf8");
}

function buildTitle(nameInput, displayTitle) {
  if (displayTitle && String(displayTitle).trim()) return String(displayTitle).trim();
  return String(nameInput).trim();
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.type || !DOC_TYPES.includes(args.type)) {
    console.error(`错误: 请指定 --type ${DOC_TYPES.join(", ")}`);
    process.exit(1);
  }

  if (args.type === "prerequisites") {
    if (!args.requirementPackage) {
      console.error("错误: prerequisites 须 --requirement-package");
      process.exit(1);
    }
    const absPath = join(
      args.root,
      "docs/requirements",
      args.requirementPackage,
      "milestones",
      "prerequisites.md"
    );
    if ((await fileExists(absPath)) && !args.force) {
      console.error(`错误: 已存在 ${absPath}，加 --force 覆盖`);
      process.exit(1);
    }
    const tpl = await loadTemplate("prerequisites");
    const ctx = {
      REQUIREMENT_PACKAGE: args.requirementPackage,
      DATE_ISO: new Date().toISOString().slice(0, 10),
      TITLE: "先决条件",
      BASE_NAME: "prerequisites",
      NAME_SLUG: "prerequisites",
    };
    const body = renderTemplate(tpl, ctx);
    if (args.dryRun) {
      console.log(`[dry-run] 将写入: ${absPath}`);
      console.log(body.slice(0, 400));
      return;
    }
    await mkdir(dirname(absPath), { recursive: true });
    await writeFile(absPath, body, "utf8");
    console.error(`已写入: ${absPath}`);
    return;
  }

  if (args.type === "milestone" && !args.requirementPackage) {
    console.error("错误: milestone 须 --requirement-package");
    process.exit(1);
  }
  if (args.type === "workflow" && (args.task == null || Number.isNaN(args.task) || args.task < 1)) {
    console.error("错误: workflow 须 --task <T>");
    process.exit(1);
  }

  if (!args.name || !String(args.name).trim()) {
    console.error('错误: 请提供 --name "..."');
    process.exit(1);
  }

  const kind =
    args.type === "requirement"
      ? "requirement"
      : args.type === "milestone"
        ? "milestone"
        : args.type === "task"
          ? "task"
          : args.type === "workflow"
            ? "workflow"
            : args.type === "feedback"
              ? "feedback"
              : null;

  if (!kind) {
    console.error("错误: 内部类型映射失败");
    process.exit(1);
  }

  const meta = await computeDocBasename({
    repoRoot: args.root,
    kind,
    nameInput: args.name,
    task: args.task,
    workflow: args.workflow,
    requirementPackage: args.requirementPackage,
  });

  const words = takeUpToFiveWords(String(args.name));
  const ctx = {
    BASE_NAME: meta.basename,
    NAME_SLUG: meta.nameSeg,
    TITLE: buildTitle(args.name, args.displayTitle),
    DATE_ISO: new Date().toISOString().slice(0, 10),
    REQUIREMENT_PACKAGE: args.requirementPackage || "",
    TASK_NUM: meta.taskNum != null ? String(meta.taskNum) : "",
    WORKFLOW_NUM: meta.workflowNum != null ? String(meta.workflowNum) : "",
  };

  const tpl = await loadTemplate(args.type);
  const body = renderTemplate(tpl, ctx);

  if (args.type === "milestone") {
    if (args.dryRun) {
      console.log(`[dry-run] ${meta.fileAbs}`);
      console.log(body.slice(0, 400));
      return;
    }
    await mkdir(dirname(meta.fileAbs), { recursive: true });
    await writeFile(meta.fileAbs, body, "utf8");
    console.error(`已写入: ${meta.fileAbs}`);
    return;
  }

  if (args.type === "requirement" || args.type === "task") {
    const dir = meta.dirAbs;
    const mainFile = join(dir, `${meta.basename}.md`);
    if (args.dryRun) {
      console.log(`[dry-run] ${mainFile}`);
      console.log(body.slice(0, 400));
      return;
    }
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "references"), { recursive: true });
    if (args.type === "requirement") {
      await mkdir(join(dir, "milestones"), { recursive: true });
    }
    await writeFile(mainFile, body, "utf8");
    console.error(`已写入: ${mainFile}`);
    return;
  }

  if (args.type === "workflow") {
    const dir = meta.dirAbs;
    const mainFile = join(dir, `${meta.basename}.md`);
    if (args.dryRun) {
      console.log(`[dry-run] ${mainFile}`);
      console.log(body.slice(0, 400));
      return;
    }
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "logs"), { recursive: true });
    await writeFile(join(dir, "logs", ".gitkeep"), "", "utf8");
    await writeFile(mainFile, body, "utf8");
    console.error(`已写入: ${mainFile}`);
    return;
  }

  if (args.type === "feedback") {
    const dir = meta.dirAbs;
    const inner = join(dir, `${meta.nameSeg}.md`);
    if (args.dryRun) {
      console.log(`[dry-run] ${inner}`);
      console.log(body.slice(0, 400));
      return;
    }
    await mkdir(dir, { recursive: true });
    await writeFile(inner, body, "utf8");
    console.error(`已写入: ${inner}`);
    return;
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
