/**
 * 非 Session 文档/目录基名：统一在此计算，供 generate-doc-basename 与 generate-markdown 复用。
 * 禁止在其它文件中手写 r1-/t1w1- 拼接规则。
 */
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  WORKFLOWS_ROOT,
  nextSerialScan,
  nextWorkflowSerial,
  nextStepSerial,
  resolveWorkflowDir,
  takeUpToFiveWords,
  wordsToNameSegment,
} from "./naming-shared.mjs";

export const SIMPLE_KINDS = {
  feedback: { prefix: "f", relativeDir: "docs/feedbacks" },
  requirement: { prefix: "r", relativeDir: "docs/requirements" },
  output: { prefix: "o", relativeDir: "docs/output" },
  preparation: { prefix: "p", relativeDir: "docs/procedure/preparation" },
  distillation: { prefix: "d", relativeDir: "docs/procedure/distillation" },
  evolution: { prefix: "e", relativeDir: "docs/procedure/evolution" },
  task: { prefix: "t", relativeDir: "docs/tasks" },
};

const SIMPLE_KEYS = Object.keys(SIMPLE_KINDS);

/** @param {string} requirementPackage 如 r1-prototype-baseline */
export function parseRequirementIndexFromPackageDirname(requirementPackage) {
  const m = requirementPackage.match(/^r(\d+)-/);
  if (!m) {
    throw new Error(`需求包目录名须以 r{N}- 开头，收到: ${requirementPackage}`);
  }
  return Number.parseInt(m[1], 10);
}

export async function nextMilestoneSerial(milestonesAbsDir, reqNum) {
  const re = new RegExp(`^r${reqNum}m(\\d+)-`);
  let max = 0;
  let entries;
  try {
    entries = await readdir(milestonesAbsDir, { withFileTypes: true });
  } catch {
    return 1;
  }
  for (const e of entries) {
    const m = e.name.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * @param {object} p
 * @param {string} p.repoRoot
 * @param {string} p.kind
 * @param {string} p.nameInput
 * @param {number} [p.task]
 * @param {number} [p.workflow]
 * @param {string} [p.requirementPackage]
 */
export async function computeDocBasename(p) {
  const repoRoot = p.repoRoot;
  const kind = p.kind;
  const words = takeUpToFiveWords(String(p.nameInput));
  if (words.length === 0) {
    throw new Error("computeDocBasename: nameInput 为空");
  }
  const nameSeg = wordsToNameSegment(words) || "untitled";

  if (kind === "workflow") {
    if (p.task == null || Number.isNaN(p.task) || p.task < 1) {
      throw new Error("workflow 须提供 task（正整数）");
    }
    const wfRoot = join(repoRoot, WORKFLOWS_ROOT);
    const w = await nextWorkflowSerial(wfRoot, p.task);
    const basename = `t${p.task}w${w}-${nameSeg}`;
    return {
      kind,
      basename,
      nameSeg,
      taskNum: p.task,
      workflowNum: w,
      dirRel: join(WORKFLOWS_ROOT, basename),
      dirAbs: join(repoRoot, WORKFLOWS_ROOT, basename),
    };
  }

  if (kind === "step") {
    if (p.task == null || Number.isNaN(p.task) || p.task < 1) {
      throw new Error("step 须提供 task");
    }
    if (p.workflow == null || Number.isNaN(p.workflow) || p.workflow < 1) {
      throw new Error("step 须提供 workflow");
    }
    const wfRoot = join(repoRoot, WORKFLOWS_ROOT);
    const wfDir = await resolveWorkflowDir(wfRoot, p.task, p.workflow);
    const s = await nextStepSerial(wfDir, p.task, p.workflow);
    const basename = `t${p.task}w${p.workflow}s${s}-${nameSeg}`;
    const fileAbs = join(wfDir, `${basename}.md`);
    return {
      kind,
      basename,
      nameSeg,
      taskNum: p.task,
      workflowNum: p.workflow,
      stepNum: s,
      fileAbs,
      fileRel: relative(repoRoot, fileAbs),
    };
  }

  if (kind === "milestone") {
    if (!p.requirementPackage) {
      throw new Error("milestone 须提供 requirementPackage（如 r1-prototype-baseline）");
    }
    const reqNum = parseRequirementIndexFromPackageDirname(p.requirementPackage);
    const msDir = join(repoRoot, "docs/requirements", p.requirementPackage, "milestones");
    const m = await nextMilestoneSerial(msDir, reqNum);
    const basename = `r${reqNum}m${m}-${nameSeg}`;
    return {
      kind,
      basename,
      nameSeg,
      requirementPackage: p.requirementPackage,
      fileRel: join("docs/requirements", p.requirementPackage, "milestones", `${basename}.md`),
      fileAbs: join(msDir, `${basename}.md`),
    };
  }

  if (!SIMPLE_KEYS.includes(kind)) {
    throw new Error(`未知 kind: ${kind}`);
  }

  const { prefix, relativeDir } = SIMPLE_KINDS[kind];
  const targetDir = join(repoRoot, relativeDir);
  const serial = await nextSerialScan(targetDir, prefix);
  const basename = `${prefix}${serial}-${nameSeg}`;
  return {
    kind,
    basename,
    nameSeg,
    dirRel: join(relativeDir, basename),
    dirAbs: join(repoRoot, relativeDir, basename),
  };
}
