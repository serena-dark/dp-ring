/**
 * `session_id` 推荐字面值生成（可编程复用）：语义与适用环节见 docs/sessions/sessions.md；三段式 basename 与 documentation-standards 规则 3.1 一致。
 * CLI generate-session-id 与本仓库其它脚本须由此模块推导字面值，禁止复制随机/日期逻辑。
 */
import { join } from "node:path";
import { randomInt } from "node:crypto";
import { nextSerialScan, takeUpToFiveWords, wordsToNameSegment } from "./naming-shared.mjs";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export const SESSION_PREFIX = "s";
export const SESSION_ARCHIVE_DIR = "docs/sessions/archive";

export function formatLocalDateYYYYMMDD(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** 6 位：首尾字母，中间四位至少两位数字。 */
export function randomNonce6() {
  const pickLetter = () => LETTERS[randomInt(0, 26)];
  const pickDigit = () => String(randomInt(0, 10));
  const first = pickLetter();
  const last = pickLetter();
  const digitPositions = new Set();
  while (digitPositions.size < 2) {
    digitPositions.add(randomInt(0, 4));
  }
  let middle = "";
  for (let i = 0; i < 4; i++) {
    middle += digitPositions.has(i) ? pickDigit() : pickLetter();
  }
  return first + middle + last;
}

/**
 * 生成推荐的 `session_id` 字面值（basename，三段式：s{N}-{name}-{6位}{YYYYMMDD}），并给出标准归档相对/绝对路径。
 * `basename` 即为与其它文档引用的同源串；`relDir`/`absDir` 对应 `docs/sessions/archive/<basename>/`。
 * @param {string} repoRoot 仓库根绝对路径
 * @param {string} nameInput 概括短语（将截断为最多 5 词）
 * @param {Date} [when] 默认当前本地日
 * @returns {Promise<{ basename: string, nameSeg: string, relDir: string, absDir: string }>}
 */
export async function buildSessionArchiveBasename(repoRoot, nameInput, when = new Date()) {
  const words = takeUpToFiveWords(String(nameInput));
  if (words.length === 0) {
    throw new Error("buildSessionArchiveBasename: nameInput 为空");
  }
  let nameSeg = wordsToNameSegment(words);
  if (!nameSeg) nameSeg = "untitled";

  const archiveDir = join(repoRoot, SESSION_ARCHIVE_DIR);
  const serial = await nextSerialScan(archiveDir, SESSION_PREFIX);
  const nonce = randomNonce6();
  const datePart = formatLocalDateYYYYMMDD(when);
  const basename = `${SESSION_PREFIX}${serial}-${nameSeg}-${nonce}${datePart}`;
  const relDir = join(SESSION_ARCHIVE_DIR, basename);
  const absDir = join(repoRoot, relDir);

  return { basename, nameSeg, relDir, absDir };
}
