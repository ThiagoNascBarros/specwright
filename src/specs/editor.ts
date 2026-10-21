import { normalizeKey } from '../storage/markdown.js';
import { isCriteriaKey } from './parser.js';

const FENCE = /^\s{0,3}(```|~~~)/;
const H2 = /^##\s+(.+?)\s*#*\s*$/;
const CHECKBOX = /^(\s*[-*] \[)( |x|X)(\] (AC-\d+):)/;

/**
 * Sets the checkbox of `acId` in the raw spec text, touching only that one character (NFR-5).
 * Returns the same string when the state already matches, or undefined when the criterion is
 * not a checkbox line of the criteria section (fences and other sections are never touched).
 */
export function setCheckbox(raw: string, acId: string, done: boolean): string | undefined {
  // Split keeping each line's terminator, so CRLF/LF and the BOM survive untouched.
  const lines = raw.split(/(?<=\n)/);
  let inFrontmatter = lines[0]?.replace(/^﻿/, '').trimEnd() === '---';
  let inFence = false;
  let inCriteria = false;
  for (let i = inFrontmatter ? 1 : 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r?\n$/, '');
    if (inFrontmatter) {
      if (line.trimEnd() === '---') inFrontmatter = false;
      continue;
    }
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) continue;
    const heading = !line.startsWith('###') ? H2.exec(line) : null;
    if (heading) {
      inCriteria = isCriteriaKey(normalizeKey(heading[1]));
      continue;
    }
    const m = inCriteria ? CHECKBOX.exec(line) : null;
    if (!m || m[4] !== acId) continue;
    if ((m[2] !== ' ') === done) return raw;
    lines[i] = m[1] + (done ? 'x' : ' ') + lines[i].slice(m[1].length + 1);
    return lines.join('');
  }
  return undefined;
}
