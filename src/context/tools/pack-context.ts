import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { featureIdSchema } from '../../features/schemas.js';
import { tokenize } from '../../storage/text.js';
import { loadGraph } from '../../graph/service.js';
import { collectCandidates } from '../candidates.js';
import { boostByGraph } from '../graph-boost.js';
import { extractPaths } from '../files.js';
import { pack } from '../packer.js';

export const DEFAULT_BUDGET = 4000;
/** Characters reserved for the JSON envelope, titles and the file list. */
const ENVELOPE_CHARS = 2000;

export function registerPackContext(server: McpServer, config: Config) {
  server.registerTool(
    'pack_context',
    {
      description:
        'Given a task description, return the most relevant spec and plan sections, open tasks, constitution principles, decisions and notes, plus the file paths they cite, within a token budget; with graph: true it also follows links from the top matches. Call it at the start of a task instead of reading whole documents.',
      inputSchema: z.object({
        task: z.string().min(1).max(2000),
        budget_tokens: z.number().int().min(200).max(100_000).optional(),
        feature: featureIdSchema.optional(),
        graph: z.boolean().optional(),
      }),
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ task, budget_tokens = DEFAULT_BUDGET, feature, graph }: { task: string; budget_tokens?: number; feature?: string; graph?: boolean }) => {
      const terms = tokenize(task);
      if (terms.length === 0) {
        throw new SpecwrightError('INVALID_INPUT', 'The task has no searchable terms.', 'Describe the task with at least one meaningful word.');
      }
      const budget = Math.max(0, Math.min(budget_tokens, Math.floor((config.maxResponseChars - ENVELOPE_CHARS) / 4)));
      const { pinned, ranked } = await collectCandidates(config.root, terms, feature, graph === true);
      const ordered = graph ? boostByGraph(pinned, ranked, await loadGraph(config)) : ranked;
      const result = pack([...pinned, ...ordered], budget);
      const build = () => ({
        budget_tokens: budget,
        used_tokens: result.used,
        items: result.items,
        files: extractPaths(result.items.map((i) => i.content)),
        skipped: result.skipped,
      });
      // JSON escaping can still push a dense response past the limit; drop the lowest items until it fits.
      let response = build();
      while (result.items.length && JSON.stringify(response).length > config.maxResponseChars) {
        const dropped = result.items.pop()!;
        result.used -= dropped.tokens;
        result.skipped++;
        response = build();
      }
      return response;
    }),
  );
}
