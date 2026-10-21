import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { tool } from '../../errors.js';
import { summarize } from '../parser.js';
import { readAllSpecs } from '../repository.js';
import { SPEC_STATUSES } from '../types.js';

export function registerListSpecs(server: McpServer, config: Config) {
  server.registerTool(
    'list_specs',
    {
      description:
        'List the project specs with id, title, status and acceptance-criteria progress. Call it first to find which spec covers your task.',
      inputSchema: z.object({ status: z.enum(SPEC_STATUSES).optional() }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ status }: { status?: string }) => {
      const specs = await readAllSpecs(config.root);
      return { specs: specs.filter((s) => !status || s.status === status).map(summarize) };
    }),
  );
}
