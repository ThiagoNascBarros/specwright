import { incident } from './graph.js';
import type { Graph } from './types.js';

export interface PathOptions { maxHops: number; includeAmbiguous: boolean }
export interface ShortestPath { nodes: string[]; edges: number[] }

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Undirected BFS. Neighbours are visited by other id, then best score, so parallel edges and ties resolve the same way on every call. */
export function shortestPath(graph: Graph, from: string, to: string, opts: PathOptions): ShortestPath | undefined {
  const via = new Map<string, { parent: string; edge: number }>();
  const seen = new Set([from]);
  let frontier = [from];
  for (let hops = 0; hops < opts.maxHops && frontier.length && !seen.has(to); hops++) {
    const next: string[] = [];
    for (const id of frontier) {
      const neighbours = incident(graph, id, { includeAmbiguous: opts.includeAmbiguous })
        .sort((a, b) => cmp(a.other, b.other) || b.edge.score - a.edge.score || cmp(a.edge.relation, b.edge.relation) || a.index - b.index);
      for (const n of neighbours) {
        if (seen.has(n.other)) continue;
        seen.add(n.other);
        via.set(n.other, { parent: id, edge: n.index });
        next.push(n.other);
      }
    }
    frontier = next;
  }
  if (!seen.has(to)) return undefined;

  const nodes = [to];
  const edges: number[] = [];
  for (let id = to; id !== from; id = via.get(id)!.parent) {
    edges.push(via.get(id)!.edge);
    nodes.push(via.get(id)!.parent);
  }
  return { nodes: nodes.reverse(), edges: edges.reverse() };
}
