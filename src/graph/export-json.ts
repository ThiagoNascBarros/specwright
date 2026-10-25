import type { Communities } from './community.js';
import { GRAPH_DIR } from './types.js';
import type { ExportFile, Graph } from './types.js';

const EXPORT_SCHEMA = 1;

/** graph.json: nodes, links and communities, with no timestamp so it renders byte-identically (plan.md "Exports"). */
export function renderGraphJson(graph: Graph, communities: Communities, generator: string): ExportFile {
  const value = {
    schema: EXPORT_SCHEMA,
    generator,
    directed: true,
    nodes: [...graph.nodes.values()].map((n) => ({
      id: n.id, kind: n.kind, label: n.label,
      ...(n.feature !== undefined ? { feature: n.feature } : {}),
      ...(n.path !== undefined ? { path: n.path } : {}),
      ...(n.line !== undefined ? { line: n.line } : {}),
      community: communities.byNode.get(n.id)!,
    })),
    links: graph.edges.map((e) => ({ source: e.source, target: e.target, relation: e.relation, confidence: e.confidence, score: e.score })),
    communities: communities.list.map((c) => ({ id: c.id, label: c.label, members: c.members })),
  };
  return { path: `${GRAPH_DIR}/graph.json`, content: `${JSON.stringify(value, null, 2)}\n` };
}
