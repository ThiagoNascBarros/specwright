import { describe, it, expect } from 'vitest';
import { parseDecision, DECISION_FILE } from '../../src/decisions/repository.js';

const RAW = [
  '---',
  'id: "0007"',
  'feature: 006-memory',
  'title: Store metadata in frontmatter',
  "date: '2026-01-02'",
  'status: accepted',
  '---',
  '## Decision',
  'Use YAML frontmatter.',
  '',
].join('\n');

describe('FR-002: decision parser', () => {
  it('FR-002: maps frontmatter fields and the file number to a decision', () => {
    expect(parseDecision('0007-store-metadata.md', RAW)).toEqual({
      id: '0007',
      feature: '006-memory',
      title: 'Store metadata in frontmatter',
      date: '2026-01-02',
      status: 'accepted',
      path: '.specify/memory/decisions/0007-store-metadata.md',
      body: '## Decision\nUse YAML frontmatter.\n',
    });
  });

  it('FR-002: reads the legacy spec_id as the feature', () => {
    const raw = '---\ntitle: Old one\nspec_id: 003-legacy\n---\nbody\n';
    expect(parseDecision('0001-old.md', raw)?.feature).toBe('003-legacy');
  });

  it('FR-002: returns undefined when the file has no frontmatter', () => {
    expect(parseDecision('0002-plain.md', '# Just a heading\n')).toBeUndefined();
  });

  it('FR-002: DECISION_FILE matches only numbered decision names', () => {
    expect(DECISION_FILE.test('0003-use-zod.md')).toBe(true);
    expect(DECISION_FILE.test('notes.md')).toBe(false);
  });
});
