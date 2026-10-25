import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { tool } from '../../errors.js';
import { summarize } from '../feature.js';
import { readAllFeatures } from '../repository.js';

export function registerListFeatures(server: McpServer, config: Config) {
  server.registerTool(
    'list_features',
    {
      description:
        'List the Spec Kit features in specs/ with title, status, artifacts present and task progress. Call it first to find the feature your task belongs to.',
      inputSchema: z.object({ status: z.string().min(1).optional() }),
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ status }: { status?: string }) => {
      const features = await readAllFeatures(config.root);
      const wanted = status?.toLowerCase();
      return { features: features.filter((f) => !wanted || f.status.toLowerCase() === wanted).map(summarize) };
    }),
  );
}
