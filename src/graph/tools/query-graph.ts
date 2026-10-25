import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { SpecwrightError, tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { tokenize } from '../../storage/text.js';
import { loadGraph } from '../service.js';
import { queryGraph } from '../query.js';
import { scoreNodes } from '../search.js';
import { queryGraphInput } from '../schemas.js';

const RESPONSE_OVERHEAD_CHARS = 500; // envelope room left under maxResponseChars (plan.md Tool contracts)

/** Answers a question with a ranked subgraph that fits the token budget. */
export async function runQueryGraph(config: Config, _deps: Deps, args: z.infer<typeof queryGraphInput>): Promise<Record<string, unknown>> {
  const { question, feature } = args;
  if (feature !== undefined) await featureDir(config.root, feature);
  const graph = await loadGraph(config);
  if (tokenize(question).length === 0 && scoreNodes(graph, question, feature).length === 0) {
    throw new SpecwrightError('INVALID_INPUT', 'The question has no searchable terms.', 'Use at least one word that is not a stopword, or a node id.');
  }
  const cap = Math.floor((config.maxResponseChars - RESPONSE_OVERHEAD_CHARS) / 4);
  return queryGraph(graph, {
    question,
    feature,
    mode: args.mode ?? 'bfs',
    depth: args.depth ?? 2,
    budgetTokens: Math.min(args.budget_tokens ?? 1500, cap),
    includeAmbiguous: args.include_ambiguous ?? false,
  });
}

export function registerQueryGraph(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'query_graph',
    {
      description:
        'Answer a question about the project from its knowledge graph of specs, tasks, decisions, notes and cited files, returning a small ranked subgraph within a token budget. Call it before reading whole files or searching, and read only the files it points to.',
      inputSchema: queryGraphInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof queryGraphInput>) => runQueryGraph(config, deps, args)),
  );
}
