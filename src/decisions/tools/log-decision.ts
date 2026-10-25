import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { featureIdSchema } from '../../features/schemas.js';
import { createDecision } from '../repository.js';
import type { NewDecision } from '../types.js';

export function registerLogDecision(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'log_decision',
    {
      description:
        'Record a decision made while implementing a feature (decision, rationale, alternatives considered) in .specify/memory/decisions/. Use it for choices a future session must not silently reverse.',
      inputSchema: z.object({
        feature: featureIdSchema,
        title: z.string().trim().min(1).max(200),
        decision: z.string().trim().min(1),
        rationale: z.string().optional(),
        alternatives: z.string().optional(),
      }),
      annotations: { openWorldHint: false, destructiveHint: false },
    },
    tool(config.maxResponseChars, async (input: NewDecision) => {
      await featureDir(config.root, input.feature);
      return createDecision(config.root, input, deps.now());
    }),
  );
}
