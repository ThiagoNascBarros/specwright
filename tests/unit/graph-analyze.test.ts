import { describe, it, expect } from 'vitest';
import { godNodes, surprisingConnections, suggestQuestions, cohesion, bridges } from '../../src/graph/analyze.js';
import type { Communities } from '../../src/graph/community.js';
import type { Confidence, Graph, GraphEdge, GraphNode, NodeKind, Relation } from '../../src/graph/types.js';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
type Spec = { s: string; t: string; relation?: Relation; confidence?: Confidence; score?: number };

const node = (id: string, kind: NodeKind = 'concept', extra: Partial<GraphNode> = {}): GraphNode => ({ id, kind, label: id, text: '', ...extra });

function graphOf(nodes: GraphNode[], specs: Spec[]): Graph {
  const sorted = [...nodes].sort((a, b) => cmp(a.id, b.id));
  const edges: GraphEdge[] = specs
    .map((x) => ({ source: x.s, target: x.t, relation: x.relation ?? 'related_to', confidence: x.confidence ?? 'EXTRACTED', score: x.score ?? 1, origin: 'derived' as const, path: 'test.md' }))
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target));
  const out = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  const inn = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  edges.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  return { version: 1, nodes: new Map(sorted.map((n) => [n.id, n])), edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

/** Hand-built communities: `groups[i]` is the member list of community i. */
function communitiesOf(groups: string[][], labels: string[] = groups.map((_, i) => `c${i}`)): Communities {
  const byNode = new Map<string, number>();
  const list = groups.map((members, id) => {
    members.forEach((m) => byNode.set(m, id));
    return { id, label: labels[id], members: [...members].sort(cmp) };
  });
  return { byNode, list };
}

describe('analysis heuristics', () => {
  it('FR-017: godNodes ignores contains/belongs_to and file/artifact/feature nodes', () => {
    const g = graphOf(
      [node('hub'), node('a'), node('b'), node('c'), node('f', 'file'), node('art', 'artifact'), node('feat', 'feature')],
      [
        { s: 'hub', t: 'a' }, { s: 'hub', t: 'b' }, { s: 'hub', t: 'c' },
        { s: 'hub', t: 'f', relation: 'contains' }, { s: 'hub', t: 'art', relation: 'belongs_to' },
        { s: 'feat', t: 'hub' }, { s: 'feat', t: 'a' }, { s: 'feat', t: 'b' }, { s: 'feat', t: 'c' },
      ],
    );
    const top = godNodes(g, 10);
    expect(top[0]).toEqual({ id: 'hub', kind: 'concept', label: 'hub', degree: 4 });
    expect(top.map((x) => x.id)).toEqual(['hub', 'a', 'b', 'c']);
  });

  it('FR-018: surprisingConnections scores per the table, keeps one edge per community pair, and every result has a why', () => {
    const g = graphOf(
      [node('a', 'note'), node('b', 'requirement'), node('x')],
      [{ s: 'a', t: 'b', confidence: 'INFERRED', score: 0.7 }, { s: 'a', t: 'x', relation: 'related_to' }, { s: 'x', t: 'b' }],
    );
    // x is in community 0 with a, so the a->x edge is not cross-community and x->b crosses 0 -> 1
    const comms = communitiesOf([['a', 'x'], ['b']], ['left', 'right']);
    const res = surprisingConnections(g, comms, 10);
    expect(res.length).toBe(1);
    // INFERRED +2, different kinds +2, cross-community +1 = 5
    expect(res[0].score).toBe(5);
    expect(res[0].edge).toEqual(['a', 'related_to', 'b', 'INFERRED', 0.7]);
    expect(res.every((r) => r.why.length > 0)).toBe(true);
  });

  it('FR-018: suggestQuestions interleaves generator types, at most 7', () => {
    const nodes = [node('p', 'decision'), node('q', 'decision'), node('r', 'note'), node('s', 'concept'), node('t', 'concept'), node('u', 'concept'), node('v', 'concept'), node('w', 'concept')];
    const specs: Spec[] = [
      { s: 'p', t: 'q', confidence: 'AMBIGUOUS', score: 0.3 },
      { s: 'r', t: 's', confidence: 'AMBIGUOUS', score: 0.3 },
      { s: 't', t: 'u', confidence: 'AMBIGUOUS', score: 0.3 },
      { s: 'v', t: 'w', confidence: 'AMBIGUOUS', score: 0.3 },
      { s: 'p', t: 'r', confidence: 'INFERRED' }, { s: 'p', t: 's', confidence: 'INFERRED' },
    ];
    const g = graphOf(nodes, specs);
    const comms = communitiesOf([['p', 'q', 'r', 's'], ['t', 'u', 'v', 'w']]);
    const qs = suggestQuestions(g, comms);
    expect(qs.length).toBeLessThanOrEqual(7);
    expect(qs[0].type).toBe('ambiguous_edge');
    expect(qs[0].question).toMatch(/^Is .+ really .+\?$/);
    expect(qs.map((q) => q.type)).toContain('isolated');
    expect(qs.filter((q) => q.type === 'ambiguous_edge').length).toBeGreaterThan(1);
  });

  it('FR-018: cohesion of a triangle is 1', () => {
    const g = graphOf([node('a'), node('b'), node('c')], [{ s: 'a', t: 'b' }, { s: 'b', t: 'c' }, { s: 'a', t: 'c' }]);
    expect(cohesion(g, ['a', 'b', 'c'])).toBe(1);
  });

  it('FR-017: bridges lists members linked to other communities, most connected first', () => {
    const g = graphOf(
      [node('a'), node('b'), node('x'), node('z'), node('y')],
      [{ s: 'a', t: 'x' }, { s: 'a', t: 'z' }, { s: 'b', t: 'x' }, { s: 'y', t: 'y' }],
    );
    const comms = communitiesOf([['a', 'b', 'y'], ['x'], ['z']]);
    const res = bridges(g, comms, 0);
    expect(res.map((r) => r.id)).toEqual(['a', 'b']);
    expect(res[0]).toEqual({ id: 'a', label: 'a', communities: [1, 2] });
    expect(res[1].communities).toEqual([1]);
  });
});
