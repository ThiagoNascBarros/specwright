import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { readSpec } from '../../specs/repository.js';
import { specIdSchema } from '../../specs/schemas.js';
import { createDecision } from '../repository.js';
import type { NewDecision } from '../types.js';

export function registerLogDecision(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'log_decision',
    {
      description:
        'Record a decision made while implementing a spec (context, decision, consequences) as a reviewable Markdown file. Use it for choices a future session must not silently reverse.',
      inputSchema: z.object({
        spec_id: specIdSchema,
        title: z.string().trim().min(1).max(200),
        decision: z.string().trim().min(1),
        context: z.string().optional(),
        consequences: z.string().optional(),
      }),
      annotations: { destructiveHint: false },
    },
    tool(config.maxResponseChars, async (input: NewDecision) => {
      await readSpec(config.root, input.spec_id);
      return createDecision(config.root, input, deps.now());
    }),
  );
}
