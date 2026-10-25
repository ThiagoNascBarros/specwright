import type { GraphEdge, GraphNode } from './types.js';

const MAX_NODES = 40;
const MAX_EDGES = 100;
const LABEL_CHARS = 40;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A Mermaid flowchart of at most 40 nodes (most connected first) and 100 edges (plan.md "Exports"). */
export function mermaidFlowchart(nodes: GraphNode[], edges: GraphEdge[]): string {
  const ids = new Set(nodes.map((n) => n.id));
  const degree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    degree.set(e.source, degree.get(e.source)! + 1);
    degree.set(e.target, degree.get(e.target)! + 1);
  }
  const kept = [...nodes].sort((a, b) => degree.get(b.id)! - degree.get(a.id)! || cmp(a.id, b.id)).slice(0, MAX_NODES);
  const index = new Map(kept.map((n, i) => [n.id, i]));
  const lines = ['flowchart LR'];
  kept.forEach((n, i) => lines.push(`  n${i}["${n.label.replace(/"/g, '#quot;').slice(0, LABEL_CHARS)}"]`));
  for (const e of edges.filter((x) => index.has(x.source) && index.has(x.target)).slice(0, MAX_EDGES)) {
    const arrow = e.confidence === 'EXTRACTED' ? `-->|${e.relation}|` : `-.->|${e.relation}${e.confidence === 'AMBIGUOUS' ? '?' : ''}|`;
    lines.push(`  n${index.get(e.source)} ${arrow} n${index.get(e.target)}`);
  }
  return lines.join('\n');
}
