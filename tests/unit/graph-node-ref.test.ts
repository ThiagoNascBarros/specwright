import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildGraph } from '../../src/graph/build.js';
import { factsOf } from '../../src/graph/facts.js';
import { resolveNodeRef } from '../../src/graph/node-ref.js';
import { SpecwrightError } from '../../src/errors.js';
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

const fixtureGraph = () => buildGraph(walk('').map((p) => factsOf(sourceOf(p), readFileSync(join(ROOT, p), 'utf8'))));

/** The error a call throws, or a failure when nothing is thrown. */
function errorOf(fn: () => unknown): SpecwrightError {
  try {
    fn();
  } catch (error) {
    return error as SpecwrightError;
  }
  throw new Error('expected the call to throw');
}

describe('resolveNodeRef', () => {
  const g = fixtureGraph();
  const idOf = (ref: string, feature?: string) => resolveNodeRef(g, ref, feature, { allowLabel: false }).id;

  it('FR-012: resolves exact ids, 001-photo-albums/FR-002, FR-002 with feature, 0002, keep-ids-stable, specs/001-photo-albums/spec.md and an exact label', () => {
    expect(idOf('requirement:001-photo-albums/FR-002')).toBe('requirement:001-photo-albums/FR-002');
    expect(idOf('001-photo-albums/FR-002')).toBe('requirement:001-photo-albums/FR-002');
    expect(idOf('FR-002', '001-photo-albums')).toBe('requirement:001-photo-albums/FR-002');
    expect(idOf('0002')).toBe('decision:0002');
    expect(idOf('keep-ids-stable')).toBe('note:keep-ids-stable');
    expect(idOf('specs/001-photo-albums/spec.md')).toBe('artifact:001-photo-albums/spec');
    const label = g.nodes.get('requirement:001-photo-albums/FR-002')!.label;
    expect(resolveNodeRef(g, label, undefined, { allowLabel: true }).id).toBe('requirement:001-photo-albums/FR-002');
  });

  it('US1-AS5: a label shared by two nodes → NODE_AMBIGUOUS listing both ids; an unknown label → NODE_NOT_FOUND with suggestions', () => {
    const shared = buildGraph([{
      path: 'x/a.md', kind: 'note', issues: [], links: [], mentions: [], paths: [], units: [], edges: [],
      nodes: [
        { id: 'note:alpha', kind: 'note', label: 'Shared label', path: 'x/a.md', line: 1, text: '' },
        { id: 'note:beta', kind: 'note', label: 'shared LABEL', path: 'x/a.md', line: 1, text: '' },
      ],
    }]);
    expect(resolveNodeRef(shared, 'note:alpha', undefined, { allowLabel: false }).label).toBe('Shared label');
    const ambiguous = errorOf(() => resolveNodeRef(shared, 'Shared label', undefined, { allowLabel: true }));
    expect(ambiguous).toBeInstanceOf(SpecwrightError);
    expect(ambiguous.code).toBe('NODE_AMBIGUOUS');
    expect(ambiguous.hint).toBe('Candidates: note:alpha, note:beta');

    const missing = errorOf(() => resolveNodeRef(g, 'sorting by date', undefined, { allowLabel: true }));
    expect(missing.code).toBe('NODE_NOT_FOUND');
    expect(missing.hint).toMatch(/^Closest: /);
    expect(missing.hint).toContain('requirement:001-photo-albums/FR-002');
  });
});
