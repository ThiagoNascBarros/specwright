import { SpecwrightError } from '../errors.js';
import { refIdCandidates } from './ids.js';
import { scoreNodes } from './search.js';
import type { Graph, GraphNode } from './types.js';

const MAX_CANDIDATES = 10;
const MAX_CLOSEST = 5;

/** Resolves a reference (id, short id, source path, or label) to one node (plan.md "Tool contracts", node references). */
export function resolveNodeRef(graph: Graph, ref: string, feature: string | undefined, options: { allowLabel: boolean }): GraphNode {
  const exact = graph.nodes.get(ref);
  if (exact) return exact;

  const shortId = refIdCandidates(ref, feature).find((id) => graph.nodes.has(id));
  if (shortId !== undefined) return graph.nodes.get(shortId)!;

  // A source path names its file's node: the line-1 artifact, note, decision or doc (a spec's feature node is excluded).
  const byPath = pathNodes(graph, ref);
  if (byPath.length) return single(ref, byPath);

  if (options.allowLabel) {
    const wanted = ref.toLowerCase();
    const byLabel = matching(graph, (n) => n.label.toLowerCase() === wanted);
    if (byLabel.length) return single(ref, byLabel);
  }

  const closest = scoreNodes(graph, ref, feature).slice(0, MAX_CLOSEST).map((x) => x.id);
  throw new SpecwrightError(
    'NODE_NOT_FOUND',
    `No node matches "${ref}".`,
    closest.length ? `Closest: ${closest.join(', ')}` : 'Call query_graph to search.',
  );
}

/** Nodes that name a source file: its line-1 node, except a spec's feature node (shared with search.ts). */
export function pathNodes(graph: Graph, path: string): GraphNode[] {
  return matching(graph, (n) => n.path === path && n.kind !== 'feature' && n.line === 1);
}

function matching(graph: Graph, keep: (node: GraphNode) => boolean): GraphNode[] {
  return [...graph.nodes.values()].filter(keep);
}

function single(ref: string, matches: GraphNode[]): GraphNode {
  if (matches.length === 1) return matches[0];
  const ids = matches.map((n) => n.id).sort().slice(0, MAX_CANDIDATES);
  throw new SpecwrightError('NODE_AMBIGUOUS', `"${ref}" matches ${matches.length} nodes.`, `Candidates: ${ids.join(', ')}`);
}
