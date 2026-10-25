import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph } from '../../src/graph/build.js';
import { factsOf } from '../../src/graph/facts.js';
import { queryGraph } from '../../src/graph/query.js';
import type { SourceFile, SourceKind } from '../../src/graph/types.js';

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

const g = buildGraph(walk('').map((p) => factsOf(sourceOf(p), readFileSync(join(ROOT, p), 'utf8'))));
const base = { mode: 'bfs' as const, depth: 2, includeAmbiguous: false };
const album = { ...base, question: 'album sorting', feature: '001-photo-albums' };
type Out = { seeds: string[]; nodes: Array<{ id: string }>; edges: unknown[]; used_tokens: number; budget_tokens: number; needed_budget_tokens?: number; omitted: { nodes: number; edges: number } };

describe('queryGraph', () => {
  it('US1-AS1 (unit): on the brain graph, "album sorting" with feature 001-photo-albums returns T005, US2, FR-002, file:src/albums/sort.ts and the implements/references/touches tuples', () => {
    const r = queryGraph(g, { ...album, budgetTokens: 1500 }) as unknown as Out;
    const ids = r.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining([
      'task:001-photo-albums/T005',
      'story:001-photo-albums/US2',
      'requirement:001-photo-albums/FR-002',
      'file:src/albums/sort.ts',
    ]));
    expect(r.seeds).toContain('task:001-photo-albums/T005');
    expect(r.edges).toEqual(expect.arrayContaining([
      ['task:001-photo-albums/T005', 'implements', 'story:001-photo-albums/US2'],
      ['task:001-photo-albums/T005', 'references', 'requirement:001-photo-albums/FR-002'],
      ['task:001-photo-albums/T005', 'touches', 'file:src/albums/sort.ts'],
    ]));
  });

  it('FR-009: a 200-token budget keeps every seed, reports omitted counts and needed_budget_tokens', () => {
    const r = queryGraph(g, { ...album, budgetTokens: 200 }) as unknown as Out;
    const ids = r.nodes.map((n) => n.id);
    expect(r.budget_tokens).toBe(200);
    for (const seed of r.seeds) expect(ids).toContain(seed);
    expect(r).not.toHaveProperty('truncated');
    expect(r.needed_budget_tokens).toBeGreaterThan(200);
    expect(r.omitted.nodes).toBeGreaterThan(0);
  });

  it('FR-027: used_tokens stays within budget_tokens when non-seed items fit', () => {
    const r = queryGraph(g, { ...album, budgetTokens: 1500 }) as unknown as Out;
    expect(r.nodes.length).toBeGreaterThan(r.seeds.length);
    expect(r.used_tokens).toBeLessThanOrEqual(1500);
  });

  it('FR-009: needed_budget_tokens is the exact used_tokens of the untruncated response', () => {
    // The budget is echoed in the response, so the two budgets have the same width (4 digits) and the lengths are comparable.
    const truncated = queryGraph(g, { ...album, budgetTokens: 1000 }) as unknown as Out;
    const full = queryGraph(g, { ...album, budgetTokens: 2000 }) as unknown as Out;
    expect(full).not.toHaveProperty('needed_budget_tokens');
    expect(full.needed_budget_tokens).toBeUndefined();
    expect(truncated.needed_budget_tokens).toBe(full.used_tokens);
  });

  it('FR-009: a question with no matching node gives empty arrays and the search hint', () => {
    const r = queryGraph(g, { ...base, question: 'zyxwvu qponm', budgetTokens: 1500 });
    expect(r).toMatchObject({ seeds: [], nodes: [], edges: [], hint: 'No node matches; try different words, get_node with an id, or search_memory.' });
  });
});
