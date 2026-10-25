import { edgeTuple } from './graph.js';
import { fitToBudget, tokensOf } from './budget.js';
import { pickSeeds, scoreNodes } from './search.js';
import { traverse } from './traverse.js';
import type { Graph } from './types.js';

export type QueryInput = { question: string; feature?: string; mode: 'bfs' | 'dfs'; depth: number; budgetTokens: number; includeAmbiguous: boolean };

const NO_MATCH_HINT = 'No node matches; try different words, get_node with an id, or search_memory.';
const PLACEHOLDER = 99999999; // widest value the counters can take, so the first fit never undercounts
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Iterates `used_tokens` to a fixed point: only the digit width of the counter can change the estimate, so it settles in one or two steps. */
function settle(build: (used: number) => Record<string, unknown>, start: number): number {
  let used = start;
  for (let i = 0; i < 4; i++) {
    const next = tokensOf(JSON.stringify(build(used)));
    if (next === used) break;
    used = next;
  }
  return used;
}

/** Answers a question with a ranked subgraph that fits the token budget (plan.md "Query algorithm", query.ts). */
export function queryGraph(graph: Graph, input: QueryInput): Record<string, unknown> {
  const { question, feature, mode, depth, budgetTokens, includeAmbiguous } = input;
  const scored = scoreNodes(graph, question, feature);
  const seeds = pickSeeds(graph, scored);
  const traversal = traverse(graph, seeds, { mode, depth, includeAmbiguous });
  const termScore = new Map(scored.map((x) => [x.id, x.score]));
  const seedRank = new Map(seeds.map((id, i) => [id, i]));
  const { dist, tree } = traversal;

  // Rank nodes: seeds in seed order, then distance, tree-edge score, term score, id.
  const edgeScoreOf = (id: string): number => (tree.has(id) ? graph.edges[tree.get(id)!].score : 0);
  const ids = [...dist.keys()].sort((a, b) =>
    (seedRank.get(a) ?? seeds.length) - (seedRank.get(b) ?? seeds.length)
    || dist.get(a)! - dist.get(b)!
    || edgeScoreOf(b) - edgeScoreOf(a)
    || (termScore.get(b) ?? 0) - (termScore.get(a) ?? 0)
    || cmp(a, b));
  const rank = new Map(ids.map((id, i) => [id, i]));

  // Rank edges: tree edges by child rank, then the other induced edges by max endpoint rank, score, and tuple.
  const treeEdges = ids.filter((id) => tree.has(id)).map((id) => tree.get(id)!);
  const treeSet = new Set(treeEdges);
  const maxRank = (i: number): number => Math.max(rank.get(graph.edges[i].source)!, rank.get(graph.edges[i].target)!);
  const otherEdges = traversal.edges.filter((i) => !treeSet.has(i)).sort((i, j) => {
    const a = graph.edges[i];
    const b = graph.edges[j];
    return maxRank(i) - maxRank(j) || b.score - a.score || cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target);
  });
  const edgeIndexes = [...treeEdges, ...otherEdges];

  const nodeItems = ids.map((id) => {
    const node = graph.nodes.get(id)!;
    return { id, value: { id, kind: node.kind, label: node.label, d: dist.get(id)!, ...(node.path !== undefined ? { path: node.path } : {}), ...(node.line !== undefined ? { line: node.line } : {}) } };
  });
  const edgeItems = edgeIndexes.map((i) => ({ endpoints: [graph.edges[i].source, graph.edges[i].target] as [string, string], value: edgeTuple(graph.edges[i]) }));

  const hint = seeds.length === 0 ? { hint: NO_MATCH_HINT } : {};
  const shape = (used: number, nodes: unknown[], edges: unknown[], omitted: { nodes: number; edges: number }, needed?: number): Record<string, unknown> => ({
    question,
    seeds,
    nodes,
    edges,
    budget_tokens: budgetTokens,
    used_tokens: used,
    omitted,
    ...(needed === undefined ? {} : { truncated: true, needed_budget_tokens: needed }),
    ...hint,
  });

  // Placeholder counters are the widest the fields can take, so the first fit never undercounts the real response.
  const placeholderOmitted = { nodes: PLACEHOLDER, edges: PLACEHOLDER };
  const fit = fitToBudget({
    envelope: shape(PLACEHOLDER, [], [], placeholderOmitted, PLACEHOLDER),
    nodes: nodeItems,
    edges: edgeItems,
    pinned: seeds.length,
    budgetTokens,
  });
  const truncated = fit.omitted.nodes + fit.omitted.edges > 0;

  // Plan step 4: needed_budget_tokens is the estimate of the full, untruncated response (fixed point on its own used_tokens).
  const needed = settle((u) => shape(u, nodeItems.map((n) => n.value), edgeItems.map((e) => e.value), { nodes: 0, edges: 0 }), 0);
  const used = settle((u) => shape(u, fit.nodes, fit.edges, fit.omitted, truncated ? needed : undefined), fit.usedTokens);
  return shape(used, fit.nodes, fit.edges, fit.omitted, truncated ? needed : undefined);
}
