import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { edgeTuple } from '../graph.js';
import { resolveNodeRef } from '../node-ref.js';
import { findPathInput } from '../schemas.js';
import { shortestPath } from '../path.js';
import { loadGraph } from '../service.js';

const DEFAULT_MAX_HOPS = 6;

/** Shortest chain of links between two nodes, with every hop (plan.md Tool contracts, find_path). */
export async function runFindPath(config: Config, _deps: Deps, args: z.infer<typeof findPathInput>): Promise<Record<string, unknown>> {
  const { feature } = args;
  if (feature !== undefined) await featureDir(config.root, feature);
  const graph = await loadGraph(config);
  // Both ends resolve first: shortestPath returns a zero-hop path for from === to without checking existence.
  const from = resolveNodeRef(graph, args.from, feature, { allowLabel: true });
  const to = resolveNodeRef(graph, args.to, feature, { allowLabel: true });
  const maxHops = args.max_hops ?? DEFAULT_MAX_HOPS;
  const path = shortestPath(graph, from.id, to.id, { maxHops, includeAmbiguous: args.include_ambiguous ?? false });
  if (!path) return { from: from.id, to: to.id, hops: null, nodes: [], edges: [], reason: `No path within ${maxHops} hops.` };
  return {
    from: from.id,
    to: to.id,
    hops: path.edges.length,
    nodes: path.nodes.map((id) => ({ id, kind: graph.nodes.get(id)!.kind, label: graph.nodes.get(id)!.label })),
    edges: path.edges.map((i) => edgeTuple(graph.edges[i])),
  };
}

export function registerFindPath(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'find_path',
    {
      description:
        'Find the shortest chain of links between two graph nodes, such as a note and a requirement, with every hop. Use it to explain how two things in the project are related.',
      inputSchema: findPathInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof findPathInput>) => runFindPath(config, deps, args)),
  );
}
