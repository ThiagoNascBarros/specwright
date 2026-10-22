import { scanTasks, TASK_LINE } from './tasks-parser.js';

/**
 * Sets the checkbox of task `id` in raw `tasks.md`, touching one character: `X` when done (as
 * `/speckit-implement` writes it) or a space. Returns the same string when nothing changes, or
 * undefined when the task is not a real task line (fences and comments are never touched).
 */
export function setTaskCheckbox(raw: string, id: string, done: boolean): string | undefined {
  const target = scanTasks(raw).lines.find((l) => l.task.id === id);
  if (!target) return undefined;
  if (target.task.done === done) return raw;
  const lines = raw.split('\n');
  const bom = target.index === 0 && raw.startsWith('﻿') ? 1 : 0;
  const line = lines[target.index];
  const m = TASK_LINE.exec(line.slice(bom).replace(/\r$/, ''))!;
  const at = bom + m[1].length;
  lines[target.index] = line.slice(0, at) + (done ? 'X' : ' ') + line.slice(at + 1);
  return lines.join('\n');
}
