import { degree, incident } from './graph.js';
import type { Incident } from './graph.js';
import type { Graph } from './types.js';

export interface TraverseOptions { mode: 'bfs' | 'dfs'; depth: number; includeAmbiguous: boolean }
export interface Traversal { dist: Map<string, number>; tree: Map<string, number>; edges: number[] }

const HUB_FLOOR = 50;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Hub threshold: max(50, degree at index floor(0.99·n) of the sorted degrees) (plan.md "Query algorithm"). */
function hubThreshold(graph: Graph): number {
  const degrees = [...graph.nodes.keys()].map((id) => degree(graph, id)).sort((a, b) => a - b);
  return Math.max(HUB_FLOOR, degrees[Math.floor(0.99 * degrees.length)] ?? 0);
}

/** BFS/DFS from seeds up to `depth`, recording each node's distance and the edge that first reached it (plan.md "Query algorithm"). */
export function traverse(graph: Graph, seeds: string[], opts: TraverseOptions): Traversal {
  const { depth, includeAmbiguous } = opts;
  const roots = [...new Set(seeds)].filter((id) => graph.nodes.has(id));
  const seedSet = new Set(roots);
  const hub = hubThreshold(graph);
  const expandable = (id: string): boolean => seedSet.has(id) || degree(graph, id) < hub;
  const usable = (id: string): Incident[] => incident(graph, id, { includeAmbiguous });
  const dist = new Map<string, number>();
  const tree = new Map<string, number>();

  if (opts.mode === 'bfs') {
    let frontier = roots;
    for (const id of roots) dist.set(id, 0);
    for (let level = 0; level < depth && frontier.length; level++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (!expandable(id)) continue;
        const neighbours = usable(id).sort((a, b) => cmp(a.other, b.other) || cmp(a.edge.relation, b.edge.relation) || a.index - b.index);
        for (const n of neighbours) {
          if (dist.has(n.other)) continue;
          dist.set(n.other, level + 1);
          tree.set(n.other, n.index);
          next.push(n.other);
        }
      }
      frontier = next;
    }
  } else {
    // Each stack entry is a node reached over `edge` at `depth`; the first pop fixes its distance, so a node first met at the depth limit is never re-reached shallower (plan.md "Query algorithm", DFS).
    const stack: Array<{ id: string; depth: number; edge?: number }> = roots.map((id) => ({ id, depth: 0 })).reverse();
    while (stack.length) {
      const { id, depth: d, edge } = stack.pop()!;
      if (dist.has(id)) continue;
      dist.set(id, d);
      if (edge !== undefined) tree.set(id, edge);
      if (d >= depth || !expandable(id)) continue;
      // Best neighbour first: score desc, then id asc. Pushed in reverse so it is popped first.
      const neighbours = usable(id).sort((a, b) => b.edge.score - a.edge.score || cmp(a.other, b.other) || cmp(a.edge.relation, b.edge.relation) || a.index - b.index);
      for (const n of neighbours.reverse()) {
        if (dist.has(n.other) || seedSet.has(n.other)) continue;
        stack.push({ id: n.other, depth: d + 1, edge: n.index });
      }
    }
  }

  // Induced edges: every usable edge whose endpoints are both visited.
  const edges = new Set<number>();
  for (const id of dist.keys()) for (const n of usable(id)) if (dist.has(n.other)) edges.add(n.index);
  return { dist, tree, edges: [...edges].sort((a, b) => a - b) };
}
