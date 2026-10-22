import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { writeAtomic } from '../../storage/files.js';
import { taskProgress } from '../feature.js';
import { assertValid, readFeature } from '../repository.js';
import { featureIdSchema, taskIdSchema } from '../schemas.js';
import { setTaskCheckbox } from '../task-editor.js';
import { parseTasks } from '../tasks-parser.js';

export function registerSetTaskStatus(server: McpServer, config: Config) {
  server.registerTool(
    'set_task_status',
    {
      description:
        'Mark one task (T###) of tasks.md as done ([X]) or open, editing only its checkbox exactly like /speckit-implement. Call it after the task is implemented and verified.',
      inputSchema: z.object({ feature: featureIdSchema, task_id: taskIdSchema, done: z.boolean() }),
      annotations: { idempotentHint: true, destructiveHint: false },
    },
    tool(config.maxResponseChars, async ({ feature, task_id, done }: { feature: string; task_id: string; done: boolean }) => {
      const { feature: f, tasksRaw, tasksPath } = await readFeature(config.root, feature);
      if (tasksRaw === undefined) {
        throw new SpecwrightError('ARTIFACT_NOT_FOUND', `Feature "${feature}" has no tasks.md.`, 'Generate it with /speckit-tasks.');
      }
      assertValid(f);
      const updated = setTaskCheckbox(tasksRaw, task_id, done);
      if (updated === undefined) {
        throw new SpecwrightError('TASK_NOT_FOUND', `Task ${task_id} not found in ${feature}/tasks.md.`, `Available: ${f.tasks.map((t) => t.id).join(', ') || '(none)'}.`);
      }
      const changed = updated !== tasksRaw;
      if (changed) await writeAtomic(tasksPath, updated);
      return { feature, task_id, done, changed, tasks: taskProgress(parseTasks(updated)) };
    }),
  );
}
