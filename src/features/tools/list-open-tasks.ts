import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { tool } from '../../errors.js';
import { assertValid, readAllFeatures, readFeature } from '../repository.js';
import { featureIdSchema, storySchema } from '../schemas.js';
import type { Feature } from '../types.js';

const openOf = (feature: Feature, story?: string) =>
  feature.tasks
    .filter((t) => !t.done && (!story || t.story === story))
    .map((t) => ({ feature: feature.id, id: t.id, parallel: t.parallel, ...(t.story ? { story: t.story } : {}), phase: t.phase, text: t.text }));

export function registerListOpenTasks(server: McpServer, config: Config) {
  server.registerTool(
    'list_open_tasks',
    {
      description:
        'List the open tasks (T###) from tasks.md, for one feature or all valid ones, optionally for one user story such as US1. Use it to pick what to implement next.',
      inputSchema: z.object({ feature: featureIdSchema.optional(), story: storySchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ feature, story }: { feature?: string; story?: string }) => {
      if (feature) {
        const { feature: f } = await readFeature(config.root, feature);
        assertValid(f);
        return { open: openOf(f, story) };
      }
      const features = await readAllFeatures(config.root);
      return { open: features.filter((f) => f.valid).flatMap((f) => openOf(f, story)) };
    }),
  );
}
