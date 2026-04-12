/**
 * ID generation for ring artifacts.
 * Prefixes follow schema conventions (s1-, t1-, r1-, eval-, run-, fb-, dist-, r1m1-).
 * Random suffix ensures uniqueness.
 */

import { randomBytes } from 'node:crypto';

/** Produce a 6-char alphanumeric random string with >=2 digits. */
function randomSuffix() {
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = alpha + digits;

  // Ensure first & last are alpha, at least 2 digits in the middle
  const bytes = randomBytes(6);
  const chars = [];
  chars.push(alpha[bytes[0] % alpha.length]);         // pos 0: alpha
  chars.push(digits[bytes[1] % digits.length]);        // pos 1: digit
  chars.push(digits[bytes[2] % digits.length]);        // pos 2: digit
  chars.push(all[bytes[3] % all.length]);              // pos 3: any
  chars.push(all[bytes[4] % all.length]);              // pos 4: any
  chars.push(alpha[bytes[5] % alpha.length]);          // pos 5: alpha
  return chars.join('');
}

/** YYYYMMDD date string */
function dateSuffix() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
}

/** Slug a name: lowercase, collapse non-alnum to dashes, max 5 words, trim dashes. */
export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 5)
    .join('-');
}

/**
 * Scan existing files in a directory to find the next numeric index
 * for a given prefix pattern like /^s\d+$/ or /^t\d+$/.
 * @param {string[]} existingIds  IDs already present (just the id strings).
 * @param {string} prefix         The letter prefix, e.g. "s", "t", "r".
 * @returns {number}
 */
export function nextIndex(existingIds, prefix) {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)`);
  for (const id of existingIds) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/**
 * Generate an artifact ID.
 *
 * @param {"session"|"requirement"|"milestone"|"task"|"workflow"|"workflow-run"|"evaluation"|"feedback"|"distillation"} type
 * @param {object} opts
 * @param {string} opts.name       Human-readable name (max 5 words).
 * @param {string[]} [opts.existingIds]  Existing IDs in the directory (for auto-numbering).
 * @param {number}   [opts.index]        Explicit numeric index (overrides auto-scan).
 * @param {string}   [opts.parentId]     For milestone: the requirement id (e.g. "r1-..."). For workflow-run: the task id.
 * @returns {string}
 */
export function generateId(type, opts) {
  const slug = slugify(opts.name);
  const rs = randomSuffix();
  const ds = dateSuffix();

  switch (type) {
    case 'session': {
      const n = opts.index ?? nextIndex(opts.existingIds ?? [], 's');
      return `s${n}-${slug}-${rs}${ds}`;
    }
    case 'requirement': {
      const n = opts.index ?? nextIndex(opts.existingIds ?? [], 'r');
      return `r${n}-${slug}`;
    }
    case 'milestone': {
      // parentId should be the requirement's id, e.g. "r2-dashboard"
      // Extract the rN prefix from it.
      const rMatch = opts.parentId?.match(/^(r\d+)/);
      const rPrefix = rMatch ? rMatch[1] : 'r0';
      const n = opts.index ?? nextIndex(opts.existingIds ?? [], `${rPrefix}m`);
      return `${rPrefix}m${n}-${slug}`;
    }
    case 'task': {
      const n = opts.index ?? nextIndex(opts.existingIds ?? [], 't');
      return `t${n}-${slug}`;
    }
    case 'workflow': {
      return `wf-${slug}`;
    }
    case 'workflow-run': {
      return `run-${slug}-${rs}${ds}`;
    }
    case 'evaluation': {
      // Typically keyed by session id
      return `eval-${slug}-${rs}${ds}`;
    }
    case 'feedback': {
      const n = opts.index ?? nextIndex(opts.existingIds ?? [], 'fb-');
      return `fb-${n}-${slug}`;
    }
    case 'distillation': {
      return `dist-${slug}-${rs}${ds}`;
    }
    default:
      throw new Error(`Unknown artifact type for ID generation: "${type}"`);
  }
}
