import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph } from '../../src/graph/build.js';
import { factsOf } from '../../src/graph/facts.js';
import { degree, edgeTuple, incident, isUsable } from '../../src/graph/graph.js';
import type { FileFacts, Graph, SourceFile, SourceKind } from '../../src/graph/types.js';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'brain');

function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((n) => {
    const rel = dir ? `${dir}/${n}` : n;
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

function sourceOf(path: string): SourceFile {
  const parts = path.split('/');
  let kind: SourceKind;
  let feature: string | undefined;
  if (parts[0] === 'specs') { feature = parts[1]; kind = parts[2].replace(/\.md$/, '') as SourceKind; }
  else if (path.endsWith('constitution.md')) kind = 'constitution';
  else if (parts[2] === 'decisions') kind = 'decision';
  else if (parts[2] === 'notes') kind = 'note';
  else if (parts[2] === 'relations') kind = 'ledger';
  else kind = 'doc';
  return { path, kind, ...(feature ? { feature } : {}), size: 1, mtimeMs: 1 };
}

const fixtureFacts = (): FileFacts[] => walk('').map((p) => factsOf(sourceOf(p), readFileSync(join(ROOT, p), 'utf8')));
const extra = (path: string, raw: string): FileFacts => factsOf(sourceOf(path), raw);
const find = (g: Graph, s: string, r: string, t: string) => g.edges.find((e) => e.source === s && e.relation === r && e.target === t);

const LEDGER = (rows: string) => `---\nscope: 001-photo-albums\n---\n# Relations\n\n## Relations\n\n| source | relation | target | confidence | score | evidence | date |\n|---|---|---|---|---|---|---|\n${rows}\n`;

describe('buildGraph', () => {
  it('FR-003: task T005 → implements US2, references FR-002, touches file:src/albums/sort.ts', () => {
    const g = buildGraph(fixtureFacts());
    const t = 'task:001-photo-albums/T005';
    expect(find(g, t, 'implements', 'story:001-photo-albums/US2')).toBeDefined();
    expect(find(g, t, 'references', 'requirement:001-photo-albums/FR-002')).toBeDefined();
    expect(find(g, t, 'touches', 'file:src/albums/sort.ts')).toBeDefined();
    expect(g.nodes.get('file:src/albums/sort.ts')?.kind).toBe('file');
  });

  it('FR-003: decision 0002 → belongs_to feature:002-sharing, references decision:0001, links_to note:keep-ids-stable, depends_on decision:0001 (EXTRACTED, origin relation-line)', () => {
    const g = buildGraph(fixtureFacts());
    const d = 'decision:0002';
    expect(find(g, d, 'belongs_to', 'feature:002-sharing')).toBeDefined();
    expect(find(g, d, 'references', 'decision:0001')).toBeDefined();
    expect(find(g, d, 'links_to', 'note:keep-ids-stable')).toBeDefined();
    expect(find(g, d, 'depends_on', 'decision:0001')).toMatchObject({ confidence: 'EXTRACTED', origin: 'relation-line', line: 15 });
  });

  it('FR-003: 002-sharing FR-001 references requirement:001-photo-albums/FR-003 (qualified mention)', () => {
    const g = buildGraph(fixtureFacts());
    expect(find(g, 'requirement:002-sharing/FR-001', 'references', 'requirement:001-photo-albums/FR-003')).toBeDefined();
    expect(g.nodes.has('file:001-photo-albums/FR-003')).toBe(false);
  });

  it('FR-005: every edge has relation, confidence, score, path and line when known', () => {
    const g = buildGraph(fixtureFacts());
    expect(g.edges.length).toBeGreaterThan(20);
    for (const e of g.edges) {
      expect(e.relation && e.confidence && e.path).toBeTruthy();
      expect(typeof e.score).toBe('number');
      expect(g.nodes.has(e.source) && g.nodes.has(e.target)).toBe(true);
      expect(e.source).not.toBe(e.target);
    }
    expect(g.edges.filter((e) => e.origin !== 'ledger').every((e) => typeof e.line === 'number')).toBe(true);
  });

  it('FR-015: the ledger relation note:sorting-pitfall → FR-002 is INFERRED 0.8 with origin ledger', () => {
    const g = buildGraph(fixtureFacts());
    expect(find(g, 'note:sorting-pitfall', 'rationale_for', 'requirement:001-photo-albums/FR-002'))
      .toMatchObject({ confidence: 'INFERRED', score: 0.8, origin: 'ledger', path: '.specify/memory/relations/project.md', line: 18 });
    expect(g.nodes.get('concept:album-ordering')?.kind).toBe('concept');
  });

  it('FR-014: a REJECTED row removes the same INFERRED triple', () => {
    const rejected = extra('.specify/memory/relations/001-photo-albums.md',
      LEDGER('| note:sorting-pitfall | rationale_for | requirement:001-photo-albums/FR-002 | REJECTED | 0 | no | 2026-10-24 |'));
    const g = buildGraph([...fixtureFacts(), rejected]);
    expect(g.rejected.has('note:sorting-pitfall|rationale_for|requirement:001-photo-albums/FR-002')).toBe(true);
    expect(find(g, 'note:sorting-pitfall', 'rationale_for', 'requirement:001-photo-albums/FR-002')).toBeUndefined();
  });

  it('FR-019: a missing wikilink gives broken_link; a ledger row with a missing target gives dangling_relation and no edge', () => {
    const note = extra('.specify/memory/notes/broken.md', '---\ntitle: Broken\n---\nSee [[does-not-exist]].\n');
    const ledger = extra('.specify/memory/relations/001-photo-albums.md',
      LEDGER('| note:broken | uses | concept:missing | INFERRED | 0.7 | x | 2026-10-24 |'));
    const g = buildGraph([...fixtureFacts(), note, ledger]);
    expect(g.diagnostics).toContainEqual(expect.objectContaining({ kind: 'broken_link', path: '.specify/memory/notes/broken.md', line: 4 }));
    expect(g.diagnostics).toContainEqual(expect.objectContaining({ kind: 'dangling_relation', path: '.specify/memory/relations/001-photo-albums.md' }));
    expect(find(g, 'note:broken', 'uses', 'concept:missing')).toBeUndefined();
    expect(g.nodes.has('note:broken')).toBe(true);
  });

  it('FR-026: building twice from shuffled facts gives identical JSON', () => {
    const json = (g: Graph) => JSON.stringify({ ...g, nodes: [...g.nodes], out: [...g.out], in: [...g.in], units: [...g.units], coverage: [...g.coverage], rejected: [...g.rejected] });
    const facts = fixtureFacts();
    const a = buildGraph(facts);
    const b = buildGraph([...facts].reverse());
    expect(a.edges.length).toBeGreaterThan(0);
    expect(json(b)).toBe(json(a));
  });
});

describe('graph helpers', () => {
  const g = buildGraph([...fixtureFacts(), extra('.specify/memory/relations/001-photo-albums.md',
    LEDGER('| note:sorting-pitfall | related_to | note:keep-ids-stable | AMBIGUOUS | 0.3 | x | 2026-10-24 |'))]);
  const ambiguous = find(g, 'note:sorting-pitfall', 'related_to', 'note:keep-ids-stable')!;

  it('FR-015: isUsable hides AMBIGUOUS edges unless asked, and incident follows it', () => {
    expect(isUsable(ambiguous, false)).toBe(false);
    expect(isUsable(ambiguous, true)).toBe(true);
    const others = (o?: { includeAmbiguous?: boolean }) => incident(g, 'note:keep-ids-stable', o).map((x) => `${x.direction}:${x.other}`);
    expect(others()).toContain('out:decision:0001');
    expect(others()).not.toContain('in:note:sorting-pitfall');
    expect(others({ includeAmbiguous: true })).toContain('in:note:sorting-pitfall');
  });

  it('FR-005: degree counts usable edges minus ignored relations; edgeTuple is short for EXTRACTED', () => {
    const d = degree(g, 'task:001-photo-albums/T005');
    expect(d).toBe(5); // contains, implements, references US2 and FR-002, touches
    expect(degree(g, 'task:001-photo-albums/T005', { ignore: ['contains'] })).toBe(4);
    expect(edgeTuple(find(g, 'task:001-photo-albums/T005', 'implements', 'story:001-photo-albums/US2')!)).toEqual(['task:001-photo-albums/T005', 'implements', 'story:001-photo-albums/US2']);
    expect(edgeTuple(ambiguous)).toEqual(['note:sorting-pitfall', 'related_to', 'note:keep-ids-stable', 'AMBIGUOUS', 0.3]);
  });
});
