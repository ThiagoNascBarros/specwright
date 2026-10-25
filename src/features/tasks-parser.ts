import { scanLines, type ScannedLine } from '../storage/markdown.js';
import type { Task } from './types.js';

/** `- [ ] T012 [P] [US1] description`. Group 1 is the prefix up to the checkbox mark, used by the editor. */
export const TASK_LINE = /^(\s*[-*] \[)( |x|X)(\] )(T\d{3,})(?=\s|$)(.*)$/;
// Labels after the id, in any order and case, separated by any whitespace (agent-written variants).
const LABEL = /^\s+\[(P|US\d+)\]/i;
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
      let rest = m[5];
      let parallel = false;
      let story: string | undefined;
      for (let l = LABEL.exec(rest); l; l = LABEL.exec(rest)) {
        if (l[1].toUpperCase() === 'P') parallel = true;
        else story = l[1].toUpperCase();
        rest = rest.slice(l[0].length);
      }
      found.push({ index, task: { id: m[4], done: m[2] !== ' ', parallel, story, phase, text: rest.trim() } });
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
