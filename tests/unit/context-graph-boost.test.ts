import { describe, it, expect } from 'vitest';
import { boostByGraph } from '../../src/context/graph-boost.js';
import type { ContextItem } from '../../src/context/types.js';
import type { Graph, GraphEdge, GraphNode } from '../../src/graph/types.js';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function graphOf(nodes: GraphNode[], pairs: Array<[string, string]>): Graph {
  const sorted = [...nodes].sort((a, b) => cmp(a.id, b.id));
  const edges: GraphEdge[] = pairs
    .map(([s, t]) => ({ source: s, target: t, relation: 'related_to' as const, confidence: 'EXTRACTED' as const, score: 1, origin: 'derived' as const, path: 'x.md' }))
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.target, b.target));
  const out = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  const inn = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  edges.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  return { version: 1, nodes: new Map(sorted.map((n) => [n.id, n])), edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({ id, kind: 'concept', label: id, text: '', ...extra });
const item = (kind: ContextItem['kind'], ref: string, score: number): ContextItem => ({ kind, ref, title: ref, score, tokens: 10, content: ref });

describe('boostByGraph', () => {
  it('FR-024: an item linked to a top-3 item gets max(score, 0.5 × seed score); boosts do not stack; pinned items are not seeds', () => {
    const graph = graphOf(
      [node('decision:0001', { kind: 'decision' }), node('note:sorting-pitfall', { kind: 'note' }), node('decision:0004', { kind: 'decision' }), node('note:x-note', { kind: 'note' }),
        node('task:001-photo-albums/T1', { kind: 'task' }), node('requirement:001-photo-albums/FR-002', { kind: 'requirement', path: 'specs/001-photo-albums/spec.md', section: 'requirements' })],
      [['decision:0001', 'note:x-note'], ['decision:0001', 'decision:0004'], ['note:sorting-pitfall', 'decision:0004'], ['task:001-photo-albums/T1', 'requirement:001-photo-albums/FR-002']],
    );
    const pinned = [item('task', '001-photo-albums/tasks.md#T1', 100)];
    const seedA = item('decision', '0001', 10);
    const seedB = item('memory', 'sorting-pitfall', 8);
    const seedC = item('memory', 'unrelated-note', 6);
    const linkedOnce = item('memory', 'x-note', 1);
    const linkedTwice = item('decision', '0004', 0.4);
    const onlyPinned = item('spec-section', '001-photo-albums/spec.md#requirements', 0.5);
    const out = boostByGraph(pinned, [seedA, seedB, seedC, linkedOnce, linkedTwice, onlyPinned], graph);

    const score = (ref: string) => out.find((i) => i.ref === ref)?.score;
    expect(score('x-note')).toBe(5);       // 0.5 × 10 from seed A
    expect(score('0004')).toBe(5);         // max(0.5 × 10, 0.5 × 8), not the sum 9
    expect(score('sorting-pitfall')).toBe(8);
    expect(score('001-photo-albums/spec.md#requirements')).toBe(0.5); // the pinned task is not a seed
    expect(out.some((i) => i.ref.endsWith('#T1'))).toBe(false);      // pinned items are not in the ranked list
    expect(out.map((i) => i.ref)).toEqual(['0001', 'sorting-pitfall', 'unrelated-note', '0004', 'x-note', '001-photo-albums/spec.md#requirements']);
  });
});
