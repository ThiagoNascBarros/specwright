import { describe, it, expect } from 'vitest';
import { lintGraph, severityOf } from '../../src/graph/lint.js';
import type { Confidence, Diagnostic, Graph, GraphEdge, GraphNode, LintKind, NodeKind, Relation, Unit } from '../../src/graph/types.js';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
type Spec = { s: string; t: string; relation?: Relation; confidence?: Confidence; origin?: GraphEdge['origin'] };
const node = (id: string, kind: NodeKind = 'concept', label = id, feature?: string): GraphNode => ({ id, kind, label, text: '', ...(feature ? { feature } : {}) });

function graphOf(nodes: GraphNode[], specs: Spec[], extra: Partial<Graph> = {}): Graph {
  const sorted = [...nodes].sort((a, b) => cmp(a.id, b.id));
  const edges: GraphEdge[] = specs
    .map((x) => ({ source: x.s, target: x.t, relation: x.relation ?? 'related_to', confidence: x.confidence ?? 'EXTRACTED', score: 1, origin: x.origin ?? 'derived', path: 'test.md' }) as GraphEdge)
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target));
  const out = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  const inn = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  edges.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  return { version: 1, nodes: new Map(sorted.map((n) => [n.id, n])), edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [], ...extra };
}

const diag = (kind: LintKind, path: string, line?: number): Diagnostic => ({ kind, path, ...(line !== undefined ? { line } : {}), message: `${kind} at ${path}`, fix: 'fix it' });

describe('lintGraph', () => {
  it('FR-019: severity mapping: broken_link is an error, ambiguous_link a warning, orphan info', () => {
    expect(severityOf('broken_link')).toBe('error');
    expect(severityOf('dangling_relation')).toBe('error');
    expect(severityOf('invalid_row')).toBe('error');
    expect(severityOf('ambiguous_link')).toBe('warning');
    expect(severityOf('contradiction')).toBe('warning');
    expect(severityOf('orphan')).toBe('info');
    expect(severityOf('stale_coverage')).toBe('info');
    const g = graphOf([node('c1')], [], { diagnostics: [diag('ambiguous_link', 'a.md'), diag('broken_link', 'b.md')] });
    const issues = lintGraph(g);
    expect(issues.map((i) => [i.kind, i.severity])).toEqual([['broken_link', 'error'], ['ambiguous_link', 'warning'], ['orphan', 'info']]);
  });

  it('FR-019: sorts by severity, then path, then line, then kind', () => {
    const g = graphOf([], [], { diagnostics: [diag('orphan' as LintKind, 'z.md'), diag('broken_link', 'b.md', 9), diag('broken_link', 'b.md', 2), diag('ambiguous_link', 'a.md', 1)] });
    const issues = lintGraph(g).map((i) => `${i.severity}:${i.path}:${i.line ?? 0}`);
    expect(issues).toEqual(['error:b.md:2', 'error:b.md:9', 'warning:a.md:1', 'info:z.md:0']);
  });

  it('FR-019: orphan applies to decisions, notes, docs and concepts whose only edges are belongs_to, or with none', () => {
    const g = graphOf(
      [node('lonely', 'concept'), node('tied', 'concept'), node('other', 'concept'), node('req', 'requirement'), node('d', 'decision'), node('feat', 'feature')],
      [{ s: 'tied', t: 'feat', relation: 'belongs_to' }, { s: 'tied', t: 'other', relation: 'related_to' }, { s: 'req', t: 'other' }],
    );
    const orphans = lintGraph(g).filter((i) => i.kind === 'orphan').map((i) => i.node);
    expect(orphans).toContain('lonely');
    expect(orphans).toContain('d');
    expect(orphans).not.toContain('req');
    expect(orphans).not.toContain('other');
  });

  it('FR-019: duplicate_label compares labels case-insensitively and only for notes, concepts and docs', () => {
    const g = graphOf([node('note:a', 'note', 'Sorting Pitfall'), node('note:b', 'note', 'sorting pitfall'), node('dec:c', 'decision', 'sorting pitfall'), node('x')], [{ s: 'note:a', t: 'x' }, { s: 'note:b', t: 'x' }, { s: 'dec:c', t: 'x' }]);
    const dups = lintGraph(g).filter((i) => i.kind === 'duplicate_label');
    expect(dups.map((i) => i.node).sort()).toEqual(['note:a', 'note:b']);
  });

  it('FR-019: one stale_coverage issue per scope, with a count', () => {
    const unit = (id: string, scope: string): Unit => ({ id, node: id, path: 'p.md', title: id, hash: 'h2', tokens: 1, scope });
    const coverage = new Map([
      ['u1', { unit: 'u1', hash: 'old', version: 1, date: '2026-10-01', line: 1 }],
      ['u2', { unit: 'u2', hash: 'old', version: 1, date: '2026-10-01', line: 2 }],
      ['u3', { unit: 'u3', hash: 'old', version: 1, date: '2026-10-01', line: 3 }],
    ]);
    const units = new Map([unit('u1', '001-a'), unit('u2', '001-a'), unit('u3', 'project')].map((u) => [u.id, u]));
    const issues = lintGraph(graphOf([node('x')], [], { coverage, units })).filter((i) => i.kind === 'stale_coverage');
    expect(issues.length).toBe(2);
    expect(issues.find((i) => i.path.includes('001-a'))?.message).toContain('2');
    expect(issues.find((i) => i.message.includes('project'))?.message).toContain('1');
  });

  it('FR-019: contradiction is any contradicts edge, ambiguous_relation any AMBIGUOUS ledger row', () => {
    const g = graphOf([node('a'), node('b')], [{ s: 'a', t: 'b', relation: 'contradicts' }, { s: 'b', t: 'a', relation: 'uses', confidence: 'AMBIGUOUS', origin: 'ledger' }]);
    const issues = lintGraph(g);
    expect(issues.some((i) => i.kind === 'contradiction' && i.severity === 'warning')).toBe(true);
    expect(issues.some((i) => i.kind === 'ambiguous_relation' && i.severity === 'info')).toBe(true);
  });
});
