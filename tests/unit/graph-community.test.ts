import { describe, it, expect, afterEach } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture } from '../helpers.js';
import { DEFAULT_GRAPH_CONFIG, type Config } from '../../src/config.js';
import { communitiesOf, loadGraph, resetGraphCache } from '../../src/graph/service.js';
import { buildGraph } from '../../src/graph/build.js';
import { factsOf } from '../../src/graph/facts.js';
import { detectCommunities } from '../../src/graph/community.js';
import { discoverSources, readSource } from '../../src/graph/repository.js';
import type { Confidence, Graph, GraphEdge, GraphNode, Relation } from '../../src/graph/types.js';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'brain');
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

type Spec = { s: string; t: string; relation?: Relation; confidence?: Confidence; score?: number };

const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({ id, kind: 'concept', label: id, text: '', ...extra });

/** A hand-built graph: nodes and edges sorted as buildGraph sorts them. */
function graphOf(nodes: GraphNode[], specs: Spec[]): Graph {
  const sortedNodes = [...nodes].sort((a, b) => cmp(a.id, b.id));
  const edges: GraphEdge[] = specs
    .map((x) => ({ source: x.s, target: x.t, relation: x.relation ?? 'related_to', confidence: x.confidence ?? 'EXTRACTED', score: x.score ?? 1, origin: 'derived' as const, path: 'test.md' }))
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target));
  const out = new Map<string, number[]>(sortedNodes.map((n) => [n.id, []]));
  const inn = new Map<string, number[]>(sortedNodes.map((n) => [n.id, []]));
  edges.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  return { version: 1, nodes: new Map(sortedNodes.map((n) => [n.id, n])), edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

/** Every pair of ids is connected: a clique. */
const clique = (ids: string[]): Spec[] => ids.flatMap((a, i) => ids.slice(i + 1).map((b) => ({ s: a, t: b })));

afterEach(() => resetGraphCache());
const cfg = (root: string): Config => ({ root, maxResponseChars: 20000, graph: { ...DEFAULT_GRAPH_CONFIG, cache: 'disk' } });

describe('communitiesOf', () => {
  it('FR-018: communitiesOf is memoized per graph version and recomputed after a rebuild', async () => {
    const { root } = await copyFixture('brain');
    const first = await loadGraph(cfg(root));
    expect(communitiesOf(first)).toBe(communitiesOf(first));
    await writeFile(join(root, '.specify/memory/notes/sorting-pitfall.md'), '# Sorting pitfall\n\nMore about 002-sharing.\n');
    const next = await loadGraph(cfg(root));
    expect(next.version).toBeGreaterThan(first.version);
    expect(communitiesOf(next)).not.toBe(communitiesOf(first));
    expect(communitiesOf(next)).toEqual(detectCommunities(next));
  });
});

describe('detectCommunities', () => {
  it('FR-018: two cliques joined by one edge give two communities', () => {
    const left = ['a1', 'a2', 'a3', 'a4'];
    const right = ['b1', 'b2', 'b3', 'b4'];
    const g = graphOf([...left, ...right].map((id) => node(id)), [...clique(left), ...clique(right), { s: 'a1', t: 'b1' }]);
    const { list, byNode } = detectCommunities(g);
    expect(list).toHaveLength(2);
    expect(new Set(left.map((id) => byNode.get(id))).size).toBe(1);
    expect(new Set(right.map((id) => byNode.get(id))).size).toBe(1);
    expect(byNode.get('a1')).not.toBe(byNode.get('b1'));
  });

  it('FR-018: ids are ordered by size desc, then smallest member id', () => {
    // Sizes 4, 3 and 3: the 4-clique is id 0 although its ids sort last; the two 3-cliques tie on size and split by smallest member.
    const z = ['z1', 'z2', 'z3', 'z4'];
    const b = ['b1', 'b2', 'b3'];
    const m = ['m1', 'm2', 'm3'];
    const g = graphOf([...z, ...b, ...m].map((id) => node(id)), [...clique(z), ...clique(b), ...clique(m)]);
    const { list, byNode } = detectCommunities(g);
    expect(list.map((c) => c.id)).toEqual([0, 1, 2]);
    expect(list.map((c) => c.members)).toEqual([z, b, m]);
    expect(byNode.get('b2')).toBe(1);
    expect(byNode.get('m1')).toBe(2);
  });

  it('FR-018: a disconnected community is split into its components', () => {
    // Louvain may group nodes with no path between them; every community must be connected in the input graph.
    let seed = 7;
    const rand = (n: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    for (let round = 0; round < 25; round++) {
      const ids = Array.from({ length: 12 }, (_, i) => `n${String(i).padStart(2, '0')}`);
      const specs: Spec[] = [];
      for (let k = 0; k < 14; k++) specs.push({ s: ids[rand(ids.length)], t: ids[rand(ids.length)] });
      const g = graphOf(ids.map((id) => node(id)), specs.filter((x) => x.s !== x.t));
      const { list, byNode } = detectCommunities(g);
      expect(byNode.size).toBe(ids.length);
      for (const c of list) {
        const members = new Set(c.members);
        const seen = new Set([c.members[0]]);
        const queue = [c.members[0]];
        while (queue.length) {
          const cur = queue.shift()!;
          for (const e of g.edges) {
            const other = e.source === cur ? e.target : e.target === cur ? e.source : undefined;
            if (other && members.has(other) && !seen.has(other)) { seen.add(other); queue.push(other); }
          }
        }
        expect(seen.size).toBe(members.size);
      }
    }
  });

  it('FR-018: labels prefer the top-degree non-file member, prefixed with the feature title when one feature owns more than half of the members', () => {
    const feature = 'feature:001-photo-albums';
    const featureNode = node(feature, { kind: 'feature', label: 'Photo Albums', feature: '001-photo-albums' });
    const reqs = ['requirement:001-photo-albums/FR-001', 'requirement:001-photo-albums/FR-002', 'requirement:001-photo-albums/FR-003', 'requirement:001-photo-albums/FR-004']
      .map((id, i) => node(id, { kind: 'requirement', label: `FR-00${i + 1}`, feature: '001-photo-albums' }));
    const file = node('file:src/albums.ts', { kind: 'file', label: 'src/albums.ts' });
    const extra = node('concept:extra', { label: 'Extra concept' });
    const group1: Spec[] = [
      ...clique(reqs.map((r) => r.id)),
      ...reqs.map((r) => ({ s: file.id, t: r.id, relation: 'touches' as const })),
      { s: 'requirement:001-photo-albums/FR-002', t: extra.id, relation: 'uses' },
      ...reqs.map((r) => ({ s: feature, t: r.id, relation: 'contains' as const })),
    ];
    // Group 2: no feature owns half of its members; all degrees are equal, so the smallest id wins.
    const p = node('concept:p', { label: 'p-label', feature: 'a' });
    const q = node('concept:q', { label: 'q-label', feature: 'b' });
    const r = node('concept:r', { label: 'r-label' });
    const g = graphOf([featureNode, ...reqs, file, extra, p, q, r], [...group1, ...clique([p.id, q.id, r.id])]);
    const { list } = detectCommunities(g);
    const labels = list.map((c) => c.label);
    expect(labels).toContain('Photo Albums: FR-002');
    expect(labels).toContain('p-label');
  });

  it('FR-026: the same graph built from shuffled facts gives identical communities', async () => {
    const sources = await discoverSources(ROOT, []);
    const facts = await Promise.all(sources.map(async (s) => factsOf(s, await readSource(ROOT, s.path, []))));
    const shuffled = [...facts.slice(5), ...facts.slice(0, 5)].reverse();
    expect(detectCommunities(buildGraph(facts)).list.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(detectCommunities(buildGraph(shuffled)))).toBe(JSON.stringify(detectCommunities(buildGraph(facts))));
  });

  it('FR-018: the brain fixture gives at least 2 communities and every node gets one', async () => {
    const sources = await discoverSources(ROOT, []);
    const facts = await Promise.all(sources.map(async (s) => factsOf(s, await readSource(ROOT, s.path, []))));
    const g = buildGraph(facts);
    const { list, byNode } = detectCommunities(g);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(byNode.size).toBe(g.nodes.size);
    for (const id of g.nodes.keys()) expect(byNode.has(id)).toBe(true);
  });
});
