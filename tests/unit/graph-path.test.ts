import { describe, it, expect } from 'vitest';
import { shortestPath } from '../../src/graph/path.js';
import type { Confidence, Graph, GraphEdge, GraphNode, Relation } from '../../src/graph/types.js';

type Spec = [string, Relation, string, { confidence?: Confidence; score?: number }?];

/** Builds a graph whose node ids are given verbatim; edge indexes follow the order of `specs`. */
function graphOf(ids: string[], specs: Spec[]): Graph {
  const nodes = new Map<string, GraphNode>(ids.map((id) => [id, { id, kind: 'note', label: id, text: id }]));
  const edges: GraphEdge[] = specs.map(([source, relation, target, o = {}]) => ({
    source, target, relation, confidence: o.confidence ?? 'EXTRACTED', score: o.score ?? 1, origin: 'derived' as const, path: 'x.md',
  }));
  const out = new Map<string, number[]>();
  const inn = new Map<string, number[]>();
  edges.forEach((e, i) => {
    out.set(e.source, [...(out.get(e.source) ?? []), i]);
    inn.set(e.target, [...(inn.get(e.target) ?? []), i]);
  });
  return { version: 1, nodes, edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

const NOTE = 'note:keep-ids-stable';
const FR1 = 'requirement:001-photo-albums/FR-001';

describe('shortestPath', () => {
  it('FR-011: note:keep-ids-stable → requirement:001-photo-albums/FR-001 returns the shortest path and the same path on every call', () => {
    // Two 2-hop routes (via decision:0007 and via note:b) and one 3-hop route. The 2-hop route through the lower id wins.
    const g = graphOf([NOTE, 'decision:0007', 'note:a', 'note:b', 'note:c', FR1], [
      [NOTE, 'rationale_for', 'decision:0007'],
      ['decision:0007', 'implements', FR1],
      [NOTE, 'related_to', 'note:b'],
      ['note:b', 'related_to', FR1],
      [NOTE, 'related_to', 'note:a'],
      ['note:a', 'related_to', 'note:c'],
      ['note:c', 'related_to', FR1],
    ]);
    const first = shortestPath(g, NOTE, FR1, { maxHops: 6, includeAmbiguous: false });
    expect(first).toEqual({ nodes: [NOTE, 'decision:0007', FR1], edges: [0, 1] });
    expect(shortestPath(g, NOTE, FR1, { maxHops: 6, includeAmbiguous: false })).toEqual(first);
  });

  it('FR-011: between two parallel edges the higher score wins', () => {
    const g = graphOf(['note:a', 'note:b'], [
      ['note:a', 'related_to', 'note:b', { score: 0.4 }],
      ['note:a', 'uses', 'note:b', { score: 0.9 }],
    ]);
    expect(shortestPath(g, 'note:a', 'note:b', { maxHops: 1, includeAmbiguous: false })).toEqual({ nodes: ['note:a', 'note:b'], edges: [1] });
  });

  it('FR-011: no path within maxHops → undefined', () => {
    // Anchor: the 3-hop chain is found with maxHops 3, so the undefined result below is not a stub artifact.
    const g = graphOf(['note:a', 'note:b', 'note:c', 'note:d'], [
      ['note:a', 'uses', 'note:b'],
      ['note:b', 'uses', 'note:c'],
      ['note:c', 'uses', 'note:d'],
    ]);
    expect(shortestPath(g, 'note:a', 'note:d', { maxHops: 3, includeAmbiguous: false })).toEqual({
      nodes: ['note:a', 'note:b', 'note:c', 'note:d'], edges: [0, 1, 2],
    });
    expect(shortestPath(g, 'note:a', 'note:d', { maxHops: 2, includeAmbiguous: false })).toBeUndefined();
  });

  it('FR-011: from === to → a 0-hop path', () => {
    const g = graphOf(['note:a'], []);
    expect(shortestPath(g, 'note:a', 'note:a', { maxHops: 6, includeAmbiguous: false })).toEqual({ nodes: ['note:a'], edges: [] });
  });

  it('FR-011: the path is undirected, and AMBIGUOUS edges are used only when includeAmbiguous is set', () => {
    // Anchor: b → a is traversed against its direction; the AMBIGUOUS c → b edge is skipped by default.
    const g = graphOf(['note:a', 'note:b', 'note:c'], [
      ['note:b', 'uses', 'note:a'],
      ['note:c', 'uses', 'note:b', { confidence: 'AMBIGUOUS' }],
    ]);
    expect(shortestPath(g, 'note:a', 'note:b', { maxHops: 1, includeAmbiguous: false })).toEqual({ nodes: ['note:a', 'note:b'], edges: [0] });
    expect(shortestPath(g, 'note:a', 'note:c', { maxHops: 2, includeAmbiguous: false })).toBeUndefined();
    expect(shortestPath(g, 'note:a', 'note:c', { maxHops: 2, includeAmbiguous: true })).toEqual({
      nodes: ['note:a', 'note:b', 'note:c'], edges: [0, 1],
    });
  });
});
