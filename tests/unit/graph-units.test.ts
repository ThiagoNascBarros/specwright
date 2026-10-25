import { describe, it, expect } from 'vitest';
import { unitsOf, unitContent } from '../../src/graph/units.js';
import { tokensOf, estimateTokens } from '../../src/graph/budget.js';

const input = (raw: string, path = 'specs/010-x/spec.md') => ({ path, raw, node: `artifact:010-x/${path}`, scope: '010-x', title: 'Spec' });

describe('graph: extraction units', () => {
  it('FR-013: one unit per ## section with stable ids and hashes', () => {
    const raw = '# Title\n\n## Goals\nAlpha.\n\n## Non-goals\nBeta.\n';
    const units = unitsOf(input(raw));
    expect(units.map((u) => u.id)).toEqual(['specs/010-x/spec.md#goals', 'specs/010-x/spec.md#non-goals']);
    expect(units[0]).toMatchObject({ path: 'specs/010-x/spec.md', section: 'goals', title: 'Spec — Goals', scope: '010-x', node: 'artifact:010-x/specs/010-x/spec.md' });
    expect(units[0].hash).toMatch(/^[0-9a-f]{16}$/);
    expect(units[0].tokens).toBe(tokensOf(unitContent(raw, units[0]) ?? ''));
    expect(unitsOf(input(raw))).toEqual(units);
  });

  it('FR-013: duplicate headings get -2', () => {
    const raw = '## Notes\none\n\n## Notes\ntwo\n\n## Notes\nthree\n';
    const ids = unitsOf(input(raw)).map((u) => u.id);
    expect(ids).toEqual(['specs/010-x/spec.md#notes', 'specs/010-x/spec.md#notes-2', 'specs/010-x/spec.md#notes-3']);
    expect(unitContent(raw, { id: ids[1], path: 'specs/010-x/spec.md', section: 'notes' })).toContain('two');
  });

  it('FR-013: a file without sections is one unit', () => {
    const units = unitsOf(input('Just a paragraph.\n', 'docs/note.md'));
    expect(units).toHaveLength(1);
    expect(units[0].id).toBe('docs/note.md');
    expect(units[0].section).toBeUndefined();
    expect(unitContent('Just a paragraph.\n', units[0])).toBe('Just a paragraph.');
  });

  it('FR-013: empty sections are skipped', () => {
    const units = unitsOf(input('## Empty\n\n## Full\ntext\n'));
    expect(units.map((u) => u.section)).toEqual(['full']);
  });

  it('FR-013: HTML comments do not change the hash', () => {
    const plain = '## Goals\nAlpha.\n';
    const commented = '## Goals\n<!-- ACTION REQUIRED: fill in -->\nAlpha.\n';
    expect(unitsOf(input(commented))[0].hash).toBe(unitsOf(input(plain))[0].hash);
  });

  it('SC-002: editing one section changes only that unit\'s hash', () => {
    const before = '## Goals\nAlpha.\n\n## Scope\nBeta.\n';
    const after = '## Goals\nAlpha edited.\n\n## Scope\nBeta.\n';
    const a = unitsOf(input(before));
    const b = unitsOf(input(after));
    expect(b[0].hash).not.toBe(a[0].hash);
    expect(b[1].hash).toBe(a[1].hash);
  });

  it('FR-013: token estimate is ceil(chars / 4) and estimateTokens serializes JSON', () => {
    expect(tokensOf('')).toBe(0);
    expect(tokensOf('abcde')).toBe(2);
    expect(estimateTokens({ a: 1 })).toBe(tokensOf('{"a":1}'));
  });
});
