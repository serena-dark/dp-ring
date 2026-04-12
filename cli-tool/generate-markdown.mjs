#!/usr/bin/env node
/**
 * 从固定模板生成 Markdown 文件；**路径与基名仅通过** lib/doc-basename（及 prerequisites 的固定名）解析，不手写命名规则。
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeDocBasename } from "./lib/doc-basename.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "templates");

const DOC_TYPES = ["requirement", "milestone", "prerequisites", "task", "workflow", "feedback"];

/** @typedef {{ type: string | null, name: string | null, displayTitle: string | null, requirementPackage: string | null, task: number | null, root: string, dryRun: boolean, force: boolean, help: boolean }} CliArgs */

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

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {CliArgs} */
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

  /** @type {Record<string, (i: number) => number>} */
  const withValue = {
    "--type": (i) => {
      out.type = argv[i + 1];
      return 2;
    },
    "--name": (i) => {
      out.name = argv[i + 1];
      return 2;
    },
    "--title": (i) => {
      out.name = argv[i + 1];
      return 2;
    },
    "--display-title": (i) => {
      out.displayTitle = argv[i + 1];
      return 2;
    },
    "--root": (i) => {
      out.root = resolve(argv[i + 1]);
      return 2;
    },
    "--requirement-package": (i) => {
      out.requirementPackage = argv[i + 1];
      return 2;
    },
    "--task": (i) => {
      out.task = Number.parseInt(argv[i + 1], 10);
      return 2;
    },
  };

  /** @type {Record<string, () => void>} */
  const flags = {
    "--help": () => {
      out.help = true;
    },
    "-h": () => {
      out.help = true;
    },
    "--dry-run": () => {
      out.dryRun = true;
    },
    "--force": () => {
      out.force = true;
    },
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const consume = withValue[a];
    if (consume) {
      i += consume(i) - 1;
      continue;
    }
    const run = flags[a];
    if (run) {
      run();
      continue;
    }
    if (!a.startsWith("-") && out.name === null) out.name = a;
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

function exitError(msg) {
  console.error(`错误: ${msg}`);
  process.exit(1);
}

/** @type {Record<string, (a: CliArgs) => void>} */
const ARG_VALIDATORS = {
  milestone: (a) => {
    if (!a.requirementPackage) exitError("milestone 须 --requirement-package");
  },
  workflow: (a) => {
    if (a.task == null || Number.isNaN(a.task) || a.task < 1) exitError("workflow 须 --task <T>");
  },
};

/** doc-basename kind，与 --type 一一对应（不含 prerequisites） */
const TYPE_TO_KIND = {
  requirement: "requirement",
  milestone: "milestone",
  task: "task",
  workflow: "workflow",
  feedback: "feedback",
};

/**
 * @param {string} type
 * @param {Awaited<ReturnType<typeof computeDocBasename>>} meta
 * @param {string} body
 */
function writePlanFor(type, meta, body) {
  /** @type {Record<string, () => { mkdirs: string[]; files: { path: string; content: string }[]; previewPath: string }>} */
  const plans = {
    milestone: () => {
      const file = meta.fileAbs;
      return {
        mkdirs: [dirname(file)],
        files: [{ path: file, content: body }],
        previewPath: file,
      };
    },
    requirement: () => {
      const dir = meta.dirAbs;
      const mainFile = join(dir, `${meta.basename}.md`);
      return {
        mkdirs: [dir, join(dir, "references"), join(dir, "milestones")],
        files: [{ path: mainFile, content: body }],
        previewPath: mainFile,
      };
    },
    task: () => {
      const dir = meta.dirAbs;
      const mainFile = join(dir, `${meta.basename}.md`);
      return {
        mkdirs: [dir, join(dir, "references")],
        files: [{ path: mainFile, content: body }],
        previewPath: mainFile,
      };
    },
    workflow: () => {
      const dir = meta.dirAbs;
      const mainFile = join(dir, `${meta.basename}.md`);
      return {
        mkdirs: [dir, join(dir, "logs")],
        files: [
          { path: join(dir, "logs", ".gitkeep"), content: "" },
          { path: mainFile, content: body },
        ],
        previewPath: mainFile,
      };
    },
    feedback: () => {
      const dir = meta.dirAbs;
      const inner = join(dir, `${meta.nameSeg}.md`);
      return {
        mkdirs: [dir],
        files: [{ path: inner, content: body }],
        previewPath: inner,
      };
    },
  };
  const build = plans[type];
  if (!build) exitError(`内部错误: 无 ${type} 的落盘计划`);
  return build();
}

/** @param {CliArgs} args */
async function runPrerequisites(args) {
  if (!args.requirementPackage) exitError("prerequisites 须 --requirement-package");
  const absPath = join(args.root, "docs/requirements", args.requirementPackage, "milestones", "prerequisites.md");
  if ((await fileExists(absPath)) && !args.force) {
    exitError(`已存在 ${absPath}，加 --force 覆盖`);
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
}

/** @param {CliArgs} args */
async function runDocBasenameBacked(args) {
  const kind = TYPE_TO_KIND[args.type];
  if (!kind) exitError("内部类型映射失败");

  ARG_VALIDATORS[args.type]?.(args);

  if (!args.name || !String(args.name).trim()) exitError('请提供 --name "..."');

  const meta = await computeDocBasename({
    repoRoot: args.root,
    kind,
    nameInput: args.name,
    task: args.task,
    workflow: undefined,
    requirementPackage: args.requirementPackage,
  });

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
  const plan = writePlanFor(args.type, meta, body);

  if (args.dryRun) {
    console.log(`[dry-run] ${plan.previewPath}`);
    console.log(body.slice(0, 400));
    return;
  }
  for (const d of plan.mkdirs) await mkdir(d, { recursive: true });
  for (const { path, content } of plan.files) await writeFile(path, content, "utf8");
  console.error(`已写入: ${plan.previewPath}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (!args.type || !DOC_TYPES.includes(args.type)) {
    exitError(`请指定 --type ${DOC_TYPES.join(", ")}`);
  }

  const runners = {
    prerequisites: () => runPrerequisites(args),
    default: () => runDocBasenameBacked(args),
  };

  await (runners[args.type] ?? runners.default)();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
