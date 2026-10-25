import { describe, it, expect } from 'vitest';
import { renderGraphJson } from '../../src/graph/export-json.js';
import { renderReport } from '../../src/graph/export-report.js';
import { renderVault } from '../../src/graph/export-obsidian.js';
import type { Communities } from '../../src/graph/community.js';
import type { Confidence, Graph, GraphEdge, GraphNode, NodeKind, Relation } from '../../src/graph/types.js';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
type Spec = { s: string; t: string; relation?: Relation; confidence?: Confidence };
const node = (id: string, kind: NodeKind = 'concept', extra: Partial<GraphNode> = {}): GraphNode => ({ id, kind, label: id, text: '', ...extra });

function graphOf(nodes: GraphNode[], specs: Spec[]): Graph {
  const sorted = [...nodes].sort((a, b) => cmp(a.id, b.id));
  const edges: GraphEdge[] = specs
    .map((x) => ({ source: x.s, target: x.t, relation: x.relation ?? 'related_to', confidence: x.confidence ?? 'EXTRACTED', score: 1, origin: 'derived' as const, path: 'x.md', line: 3 }))
    .sort((a, b) => cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target));
  const out = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  const inn = new Map<string, number[]>(sorted.map((n) => [n.id, []]));
  edges.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  return { version: 1, nodes: new Map(sorted.map((n) => [n.id, n])), edges, out, in: inn, units: new Map(), coverage: new Map(), rejected: new Set(), diagnostics: [] };
}

function communitiesOf(groups: string[][], labels: string[]): Communities {
  const byNode = new Map<string, number>();
  const list = groups.map((members, id) => {
    members.forEach((m) => byNode.set(m, id));
    return { id, label: labels[id], members: [...members].sort(cmp) };
  });
  return { byNode, list };
}

const graph = graphOf(
  [node('concept:album-ordering', 'concept', { label: 'Album ordering', text: 'About #tag and more' }), node('decision:0001', 'decision', { label: 'Keep plain files', feature: '001-photo-albums', path: '.specify/memory/decisions/0001-d.md', line: 1 }), node('concept:ação', 'concept', { label: 'Ação', text: '' }), node('file:x.md', 'file', { label: 'x.md' })],
  [{ s: 'decision:0001', t: 'concept:album-ordering', relation: 'rationale_for', confidence: 'INFERRED' }, { s: 'concept:album-ordering', t: 'concept:ação' }, { s: 'decision:0001', t: 'file:x.md', relation: 'touches' }],
);
const comms = communitiesOf([['concept:album-ordering', 'decision:0001', 'file:x.md'], ['concept:ação']], ['Album group', 'Accent group']);

describe('exports', () => {
  it('FR-020: graph.json has schema, generator, nodes, links and communities, with no timestamp, identical on two renders', () => {
    const a = renderGraphJson(graph, comms, 'specwright 0.2.0');
    const b = renderGraphJson(graph, comms, 'specwright 0.2.0');
    expect(a.path).toBe('.specify/graph/graph.json');
    expect(a.content).toBe(b.content);
    const value = JSON.parse(a.content);
    expect(value).toMatchObject({ schema: 1, generator: 'specwright 0.2.0', directed: true });
    expect(value.nodes.length).toBe(4);
    expect(value.links[0]).toEqual({ source: 'concept:album-ordering', target: 'concept:ação', relation: 'related_to', confidence: 'EXTRACTED', score: 1 });
    expect(value.communities[0]).toEqual({ id: 0, label: 'Album group', members: ['concept:album-ordering', 'decision:0001', 'file:x.md'] });
    expect(a.content).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('US7-AS4: the report has the section headings of plan.md § Exports and one mermaid block per top community', () => {
    const report = renderReport(graph, comms, []);
    expect(report.path).toBe('.specify/graph/GRAPH_REPORT.md');
    const headings = report.content.split('\n').filter((l) => l.startsWith('## ') || l.startsWith('# '));
    expect(headings).toEqual(['# Project graph', '## Most connected', '## Communities', '## Surprising connections', '## Suggested questions', '## Health', '## Extraction']);
    expect(report.content.split('```mermaid').length - 1).toBe(2);
    expect(report.content).toContain('### 0. Album group (3)');
    expect(report.content).toContain('<details>');
  });

  it('FR-020: the vault has one note per non-file node at <kind>/<slug>.md with frontmatter id/kind/community, Links lines as wikilinks with aliases, and _community-<n>.md notes', () => {
    const files = renderVault(graph, comms, '.specify/graph/vault');
    const paths = files.map((f) => f.path);
    expect(paths).toContain('.specify/graph/vault/concept/album-ordering.md');
    expect(paths).toContain('.specify/graph/vault/decision/0001.md');
    expect(paths).toContain('.specify/graph/vault/_community-0.md');
    expect(paths.some((p) => p.includes('file'))).toBe(false);
    const decision = files.find((f) => f.path.endsWith('decision/0001.md'))!.content;
    expect(decision).toMatch(/^---\nid: "decision:0001"\nkind: "decision"/);
    expect(decision).toContain('community: 0');
    expect(decision).toContain('- rationale_for [[concept/album-ordering|Album ordering]]');
    expect(decision).toContain('(INFERRED 1)');
    expect(decision).toContain('Source: `.specify/memory/decisions/0001-d.md`');
    expect(files.find((f) => f.path.endsWith('_community-0.md'))!.content).toContain('[[concept/album-ordering|Album ordering]]');
  });

  it('Review Focus 2: an accented label yields an ASCII slug path and keeps the label in the title', () => {
    const files = renderVault(graph, comms, '.specify/graph/vault');
    const note = files.find((f) => f.path === '.specify/graph/vault/concept/acao.md');
    expect(note).toBeDefined();
    expect(note!.content).toContain('# Ação');
  });

  it('FR-020: "#tag" in an excerpt is escaped', () => {
    const files = renderVault(graph, comms, '.specify/graph/vault');
    const note = files.find((f) => f.path.endsWith('concept/album-ordering.md'))!.content;
    expect(note).toContain('About \\#tag and more');
  });
});
