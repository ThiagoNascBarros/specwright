import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { communitiesOf, loadGraph } from '../service.js';
import { edgeTuple, degree, incident, type Incident } from '../graph.js';
import { resolveNodeRef } from '../node-ref.js';
import { getNodeInput } from '../schemas.js';
import type { Graph, GraphNode } from '../types.js';

const DEFAULT_LIMIT = 30;
const EXCERPT_CHARS = 500;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Where a feature node's text lives: `specs/<feature>/<artifact>.md`, read by its `##` heading. */
function readOf(node: GraphNode): { artifact: string; feature: string; section: string } | undefined {
  if (node.feature === undefined || node.path === undefined || node.heading === undefined) return undefined;
  const prefix = `specs/${node.feature}/`;
  if (!node.path.startsWith(prefix) || node.path.slice(prefix.length).includes('/')) return undefined;
  return { artifact: node.path.slice(prefix.length).replace(/\.md$/, ''), feature: node.feature, section: node.heading };
}

/** `[relation, other, otherLabel]`, plus confidence and score unless the edge is EXTRACTED. */
function link(graph: Graph, x: Incident, other: string): Array<string | number> {
  const row: Array<string | number> = [x.edge.relation, other, graph.nodes.get(other)!.label];
  return x.edge.confidence === 'EXTRACTED' ? row : [...row, x.edge.confidence, x.edge.score];
}

/** Shows one node with its excerpt and its links (plan.md Tool contracts, get_node). */
export async function runGetNode(config: Config, _deps: Deps, args: z.infer<typeof getNodeInput>): Promise<Record<string, unknown>> {
  const { ref, feature, relation } = args;
  if (feature !== undefined) await featureDir(config.root, feature);
  const graph = await loadGraph(config);
  const node = resolveNodeRef(graph, ref, feature, { allowLabel: true });
  const limit = args.limit ?? DEFAULT_LIMIT;

  const usable = incident(graph, node.id, { includeAmbiguous: true }).filter((x) => relation === undefined || x.edge.relation === relation);
  const byRelationThenId = (a: Incident, b: Incident): number => cmp(a.edge.relation, b.edge.relation) || cmp(a.other, b.other);
  const outs = usable.filter((x) => x.direction === 'out').sort(byRelationThenId);
  const ins = usable.filter((x) => x.direction === 'in').sort(byRelationThenId);

  const read = readOf(node);
  return {
    node: {
      id: node.id,
      kind: node.kind,
      label: node.label,
      ...(node.feature !== undefined ? { feature: node.feature } : {}),
      ...(node.path !== undefined ? { path: node.path } : {}),
      ...(node.line !== undefined ? { line: node.line } : {}),
      ...(node.tags !== undefined ? { tags: node.tags } : {}),
      ...(node.type !== undefined ? { type: node.type } : {}),
      ...(node.done !== undefined ? { done: node.done } : {}),
      excerpt: node.text.slice(0, EXCERPT_CHARS),
      ...(read ? { read } : {}),
    },
    degree: degree(graph, node.id),
    community: communitiesOf(graph).byNode.get(node.id),
    out: outs.slice(0, limit).map((x) => link(graph, x, x.other)),
    in: ins.slice(0, limit).map((x) => link(graph, x, x.other)),
    omitted: { out: Math.max(0, outs.length - limit), in: Math.max(0, ins.length - limit) },
  };
}

export function registerGetNode(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'get_node',
    {
      description:
        'Show one graph node (requirement, task, decision, note, file, concept…) with its excerpt, outgoing links and backlinks. Use it when you know what you are looking for, by id, short id such as FR-003 with a feature, or exact title.',
      inputSchema: getNodeInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof getNodeInput>) => runGetNode(config, deps, args)),
  );
}
