import type { Confidence, Graph, GraphEdge, Relation } from './types.js';

export type EdgeTuple = [string, string, string] | [string, string, string, Confidence, number];
export interface Incident { index: number; edge: GraphEdge; other: string; direction: 'out' | 'in' }

/** AMBIGUOUS edges are only traversed when the caller asks for them. */
export const isUsable = (edge: GraphEdge, includeAmbiguous: boolean): boolean => includeAmbiguous || edge.confidence !== 'AMBIGUOUS';

/** Usable edges of a node: outgoing first, then incoming, each in adjacency order. */
export function incident(graph: Graph, id: string, opts: { includeAmbiguous?: boolean } = {}): Incident[] {
  const list = (direction: 'out' | 'in'): Incident[] => (graph[direction].get(id) ?? []).map((index) => {
    const edge = graph.edges[index];
    return { index, edge, other: direction === 'out' ? edge.target : edge.source, direction };
  });
  return [...list('out'), ...list('in')].filter((x) => isUsable(x.edge, opts.includeAmbiguous ?? false));
}

export function degree(graph: Graph, id: string, opts: { ignore?: readonly Relation[] } = {}): number {
  return incident(graph, id).filter((x) => !opts.ignore?.includes(x.edge.relation)).length;
}

/** Compact edge: EXTRACTED edges omit confidence and score. */
export function edgeTuple(edge: GraphEdge): EdgeTuple {
  return edge.confidence === 'EXTRACTED' ? [edge.source, edge.relation, edge.target] : [edge.source, edge.relation, edge.target, edge.confidence, edge.score];
}
