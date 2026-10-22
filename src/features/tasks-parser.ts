import { scanLines, type ScannedLine } from '../storage/markdown.js';
import type { Task } from './types.js';

/** `- [ ] T012 [P] [US1] description`; labels are optional and in this order (Spec Kit's tasks template). */
export const TASK_LINE = /^(\s*[-*] \[)( |x|X)(\] )(T\d{3,})(?=\s|$)( \[P\])?( \[(US\d+)\])?(?:\s+(.*?))?\s*$/;
const CHECKBOX = /^\s*[-*] \[( |x|X)\]/;
const PHASE = /^##\s+Phase\s+\d+:\s*(.+?)\s*$/;
const H2 = /^##\s/;

export interface TaskLine {
  /** Index of the line in the raw text split on "\n". */
  index: number;
  task: Task;
}

/**
 * Lines of `tasks.md` that may hold tasks: the leading YAML frontmatter, code fences and
 * HTML comments are skipped. Shared by the parser and the editor, so both see the same tasks.
 */
export function contentLines(raw: string): ScannedLine[] {
  const lines = scanLines(raw.replace(/^﻿/, ''));
  if (lines[0]?.text.trim() === '---') {
    lines[0].skip = true;
    for (let i = 1; i < lines.length; i++) {
      lines[i].skip = true;
      if (lines[i].text.trim() === '---') break;
    }
  }
  return lines;
}

/** Every task with the index of its line, plus warnings for checkbox lines without a T### id. */
export function scanTasks(raw: string): { lines: TaskLine[]; warnings: string[] } {
  const found: TaskLine[] = [];
  const warnings: string[] = [];
  let phase = '';
  contentLines(raw).forEach(({ text, skip }, index) => {
    if (skip) return;
    const p = PHASE.exec(text);
    if (p) phase = p[1];
    else if (H2.test(text)) phase = '';
    const m = TASK_LINE.exec(text);
    if (m) {
      found.push({ index, task: { id: m[4], done: m[2] !== ' ', parallel: m[5] !== undefined, story: m[7], phase, text: m[8] ?? '' } });
    } else if (CHECKBOX.test(text)) {
      warnings.push(`task without id ignored: "${text.trim()}"`);
    }
  });
  return { lines: found, warnings };
}

/** Parses `tasks.md` (FR-004). Never throws. */
export function parseTasks(raw: string): { tasks: Task[]; warnings: string[] } {
  const { lines, warnings } = scanTasks(raw);
  return { tasks: lines.map((l) => l.task), warnings };
}
