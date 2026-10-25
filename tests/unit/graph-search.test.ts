import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph } from '../../src/graph/build.js';
import { factsOf } from '../../src/graph/facts.js';
import { pickSeeds, scoreNodes } from '../../src/graph/search.js';
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

describe('scoreNodes and pickSeeds', () => {
  it('FR-009: "album sorting" scores FR-002 and T005 highest', () => {
    const top = scoreNodes(g, 'album sorting').slice(0, 2).map((x) => x.id).sort();
    expect(top).toEqual(['requirement:001-photo-albums/FR-002', 'task:001-photo-albums/T005']);
  });

  it('FR-009: an id in the question scores 1000', () => {
    const hit = scoreNodes(g, 'What does 001-photo-albums/FR-002 require?').find((x) => x.id === 'requirement:001-photo-albums/FR-002');
    expect(hit?.score).toBeGreaterThanOrEqual(1000);
  });

  it('FR-009: with feature, seeds come from that feature', () => {
    const scoped = scoreNodes(g, 'album', '002-sharing');
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((x) => g.nodes.get(x.id)!.feature === '002-sharing')).toBe(true);
    expect(pickSeeds(g, scoped).every((id) => g.nodes.get(id)!.feature === '002-sharing')).toBe(true);
  });

  it('FR-009: the second seed must score at least half the first', () => {
    expect(pickSeeds(g, [{ id: 'note:a', score: 10 }])).toEqual(['note:a']);
    expect(pickSeeds(g, [{ id: 'note:a', score: 10 }, { id: 'note:b', score: 4 }, { id: 'note:c', score: 5 }])).toEqual(['note:a', 'note:c']);
  });
});
