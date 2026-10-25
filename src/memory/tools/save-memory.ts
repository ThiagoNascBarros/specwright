import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { createMemory } from '../repository.js';
import { MEMORY_TYPES, type NewMemory } from '../types.js';

export function registerSaveMemory(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'save_memory',
    {
      description:
        'Save a project convention, learning or pitfall as a Markdown note that later sessions can find. Use it when you discover something a future agent should not have to rediscover.',
      inputSchema: z.object({
        type: z.enum(MEMORY_TYPES),
        title: z.string().trim().min(1).max(200),
        body: z.string().trim().min(1),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      }),
      annotations: { openWorldHint: false, destructiveHint: false },
    },
    tool(config.maxResponseChars, (input: NewMemory) => createMemory(config.root, input, deps.now())),
  );
}
