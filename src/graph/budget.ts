/** Token estimate used across the graph (decision 0007): one token per four characters. */
export function tokensOf(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokens(value: unknown): number {
  return tokensOf(JSON.stringify(value));
}

export interface FitInput {
  envelope: Record<string, unknown>;
  nodes: Array<{ id: string; value: unknown }>;
  edges: Array<{ endpoints: [string, string]; value: unknown }>;
  pinned: number;
  budgetTokens: number;
}
export interface FitResult { nodes: unknown[]; edges: unknown[]; usedTokens: number; omitted: { nodes: number; edges: number }; neededTokens: number }

/** Keeps the first `pinned` nodes, then nodes and edges in rank order while the response stays within budget (plan.md "Query algorithm", step 3). */
export function fitToBudget(input: FitInput): FitResult {
  const { envelope, nodes, edges, pinned, budgetTokens } = input;
  const base = JSON.stringify({ ...envelope, nodes: [], edges: [] }).length;
  // Length of a response holding `count` items with `chars` total: the items, plus a comma between each pair.
  const length = (nodeCount: number, nodeChars: number, edgeCount: number, edgeChars: number): number =>
    base + nodeChars + Math.max(0, nodeCount - 1) + edgeChars + Math.max(0, edgeCount - 1);
  const fits = (chars: number): boolean => Math.ceil(chars / 4) <= budgetTokens;

  const keptNodes: unknown[] = [];
  const keptIds = new Set<string>();
  let nodeChars = 0;
  for (const [i, node] of nodes.entries()) {
    const chars = JSON.stringify(node.value).length;
    if (i >= pinned && !fits(length(keptNodes.length + 1, nodeChars + chars, 0, 0))) break;
    keptNodes.push(node.value);
    keptIds.add(node.id);
    nodeChars += chars;
  }

  const keptEdges: unknown[] = [];
  let edgeChars = 0;
  const eligible = edges.filter((e) => keptIds.has(e.endpoints[0]) && keptIds.has(e.endpoints[1]));
  for (const edge of eligible) {
    const chars = JSON.stringify(edge.value).length;
    if (!fits(length(keptNodes.length, nodeChars, keptEdges.length + 1, edgeChars + chars))) break;
    keptEdges.push(edge.value);
    edgeChars += chars;
  }

  const allNodeChars = nodes.reduce((sum, n) => sum + JSON.stringify(n.value).length, 0);
  const allEdgeChars = edges.reduce((sum, e) => sum + JSON.stringify(e.value).length, 0);
  return {
    nodes: keptNodes,
    edges: keptEdges,
    usedTokens: Math.ceil(length(keptNodes.length, nodeChars, keptEdges.length, edgeChars) / 4),
    omitted: { nodes: nodes.length - keptNodes.length, edges: edges.length - keptEdges.length },
    neededTokens: Math.ceil(length(nodes.length, allNodeChars, edges.length, allEdgeChars) / 4),
  };
}
