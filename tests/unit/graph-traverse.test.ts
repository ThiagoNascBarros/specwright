import { describe, it, expect } from 'vitest';
import { traverse } from '../../src/graph/traverse.js';
import type { Confidence, Graph, GraphEdge, GraphNode, Relation } from '../../src/graph/types.js';

type Spec = [string, Relation, string, Confidence?];

/** A small in-memory graph: nodes are `note:<name>`; out/in lists are sorted by (other id, relation) as the contract requires. */
function graphOf(names: string[], specs: Spec[]): Graph {
  const nodes = new Map<string, GraphNode>(names.map((n) => [`note:${n}`, { id: `note:${n}`, kind: 'note', label: n, text: n }]));
  const edges: GraphEdge[] = specs
    .map(([s, relation, t, confidence = 'EXTRACTED']) => ({ source: `note:${s}`, target: `note:${t}`, relation, confidence, score: 1, origin: 'derived' as const, path: 'x.md' }))
    .sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : a.relation < b.relation ? -1 : a.relation > b.relation ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  const out = new Map<string, number[]>();
  const inn = new Map<string, number[]>();
  edges.forEach((e, i) => {
    out.set(e.source, [...(out.get(e.source) ?? []), i]);
    inn.set(e.target, [...(inn.get(e.target) ?? []), i]);
  });
  const byOther = (side: 'source' | 'target') => (a: number, b: number): number => {
    const x = edges[a];
    const y = edges[b];
    const ox = side === 'target' ? x.target : x.source;
    const oy = side === 'target' ? y.target : y.source;
    return ox < oy ? -1 : ox > oy ? 1 : x.relation < y.relation ? -1 : x.relation > y.relation ? 1 : 0;
  };
  for (const list of out.values()) list.sort(byOther('target'));
  for (const list of inn.values()) list.sort(byOther('source'));
  return { version: 1, nodes, edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

const indexOf = (g: Graph, s: string, t: string): number => g.edges.findIndex((e) => e.source === `note:${s}` && e.target === `note:${t}`);

describe('traverse', () => {
  it('FR-009: BFS distances and tree edges; the hub guard stops expansion through a node of degree ≥ max(50, p99) unless it is a seed', () => {
    // Diamond: s→a, s→b, a→c, b→c, c→d. The tree edge of c is the first one found in adjacency order (a before b).
    const diamond = graphOf(['s', 'a', 'b', 'c', 'd'], [['s', 'uses', 'a'], ['s', 'uses', 'b'], ['a', 'uses', 'c'], ['b', 'uses', 'c'], ['c', 'uses', 'd']]);
    const r = traverse(diamond, ['note:s'], { mode: 'bfs', depth: 3, includeAmbiguous: false });
    expect(r.dist.get('note:s')).toBe(0);
    expect(r.dist.get('note:a')).toBe(1);
    expect(r.dist.get('note:c')).toBe(2);
    expect(r.dist.get('note:d')).toBe(3);
    expect(r.tree.get('note:c')).toBe(indexOf(diamond, 'a', 'c'));
    expect(r.tree.get('note:d')).toBe(indexOf(diamond, 'c', 'd'));

    // Hub: a seed s reaches h, which has 60 leaves (degree 61 ≥ max(50, p99) = 61), so h is reached but not expanded.
    const leaves = Array.from({ length: 60 }, (_, i) => `l${String(i).padStart(2, '0')}`);
    const hub = graphOf(['s', 'h', ...leaves], [['s', 'uses', 'h'], ...leaves.map((l): Spec => ['h', 'uses', l])]);
    const guarded = traverse(hub, ['note:s'], { mode: 'bfs', depth: 3, includeAmbiguous: false });
    expect(guarded.dist.get('note:h')).toBe(1);
    expect(guarded.dist.has('note:l00')).toBe(false);

    // A hub that is itself a seed is expanded.
    const seeded = traverse(hub, ['note:h'], { mode: 'bfs', depth: 1, includeAmbiguous: false });
    expect(seeded.dist.get('note:l00')).toBe(1);
  });

  it('FR-009: neighbours are taken sorted by other id, then relation, across both directions', () => {
    // s has an incoming edge from n1 and an outgoing edge to n2; both reach x. n1 sorts first, so x's tree edge is n1→x.
    const g = graphOf(['s', 'n1', 'n2', 'x'], [['n1', 'uses', 's'], ['s', 'uses', 'n2'], ['n1', 'uses', 'x'], ['n2', 'uses', 'x']]);
    const r = traverse(g, ['note:s'], { mode: 'bfs', depth: 2, includeAmbiguous: false });
    expect(r.dist.get('note:x')).toBe(2);
    expect(r.tree.get('note:x')).toBe(indexOf(g, 'n1', 'x'));
  });

  it('FR-009: AMBIGUOUS edges are skipped unless includeAmbiguous', () => {
    const g = graphOf(['s', 'x', 'y'], [['s', 'uses', 'x', 'AMBIGUOUS'], ['s', 'uses', 'y']]);
    const without = traverse(g, ['note:s'], { mode: 'bfs', depth: 1, includeAmbiguous: false });
    expect(without.dist.get('note:y')).toBe(1);
    expect(without.dist.has('note:x')).toBe(false);
    const withIt = traverse(g, ['note:s'], { mode: 'bfs', depth: 1, includeAmbiguous: true });
    expect(withIt.dist.get('note:x')).toBe(1);
    expect(withIt.edges).toContain(indexOf(g, 's', 'x'));
  });

  it('FR-009: DFS respects depth', () => {
    const chain = graphOf(['s', 'a', 'b', 'c', 'd'], [['s', 'uses', 'a'], ['a', 'uses', 'b'], ['b', 'uses', 'c'], ['c', 'uses', 'd']]);
    const shallow = traverse(chain, ['note:s'], { mode: 'dfs', depth: 2, includeAmbiguous: false });
    expect(shallow.dist.get('note:a')).toBe(1);
    expect(shallow.dist.get('note:b')).toBe(2);
    expect(shallow.dist.has('note:c')).toBe(false);
    const deep = traverse(chain, ['note:s'], { mode: 'dfs', depth: 4, includeAmbiguous: false });
    expect(deep.dist.get('note:d')).toBe(4);
    expect(deep.tree.get('note:d')).toBe(indexOf(chain, 'c', 'd'));
  });
});
