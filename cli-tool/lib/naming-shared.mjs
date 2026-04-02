/**
 * cli-tool 共享纯逻辑（非 CLI 入口）：序号扫描与 name 词片处理。
 * 供 lib/session-id、lib/doc-basename 及 CLI 复用。
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const WORKFLOWS_ROOT = "docs/tasks/workflows";

export async function nextSerialScan(absDir, prefix) {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(\\d+)-`);
  let max = 0;
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return 1;
  }
  for (const e of entries) {
    const m = e.name.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

export async function nextWorkflowSerial(absWorkflowsRoot, taskNum) {
  const re = new RegExp(`^t${taskNum}w(\\d+)-`);
  let max = 0;
  let entries;
  try {
    entries = await readdir(absWorkflowsRoot, { withFileTypes: true });
  } catch {
    return 1;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = e.name.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

export async function resolveWorkflowDir(absWorkflowsRoot, taskNum, workflowNum) {
  const prefix = `t${taskNum}w${workflowNum}-`;
  let entries;
  try {
    entries = await readdir(absWorkflowsRoot, { withFileTypes: true });
  } catch (e) {
    throw new Error(`无法读取工作流目录: ${absWorkflowsRoot}（${e.message}）`);
  }
  const dirs = entries.filter((e) => e.isDirectory() && e.name.startsWith(prefix));
  if (dirs.length === 0) {
    throw new Error(`未找到与 ${prefix}* 匹配的工作流目录；请先创建 t${taskNum}w${workflowNum}-… 目录。`);
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  if (dirs.length > 1) {
    console.error(`提示: 存在多个 ${prefix}* 目录，使用 ${dirs[0].name} 统计步骤序号。`);
  }
  return join(absWorkflowsRoot, dirs[0].name);
}

export async function nextStepSerial(workflowDirAbs, taskNum, workflowNum) {
  const entries = await readdir(workflowDirAbs, { withFileTypes: true });
  const re = new RegExp(`^t${taskNum}w${workflowNum}s(\\d+)-`);
  let max = 0;
  for (const e of entries) {
    const m = e.name.match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return max + 1;
}

export function takeUpToFiveWords(text) {
  const parts = text.trim().split(/\s+/u).filter(Boolean);
  return parts.slice(0, 5);
}

/** 将最多 5 个词转为路径安全的 name 段。 */
export function wordsToNameSegment(words) {
  const forbidden = /[<>:"/\\|?*\x00-\x1f]/g;
  return words
    .map((w) => {
      const cleaned = w.replace(forbidden, "");
      const isAsciiWord = /^[\w.-]+$/u.test(cleaned) && /[a-zA-Z]/.test(cleaned);
      if (isAsciiWord) return cleaned.toLowerCase();
      return cleaned;
    })
    .filter(Boolean)
    .join("-");
}
