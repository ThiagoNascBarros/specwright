import { describe, it, expect } from 'vitest';
import { parseMemory } from '../../src/memory/repository.js';

describe('FR-002: memory parser', () => {
  it('FR-002: maps frontmatter, tags and the slug to a memory', () => {
    const raw = '---\ntype: pitfall\ntitle: Watch the lock\ntags:\n  - locks\n  - io\ndate: 2026-02-03\n---\nBody text.\n';
    expect(parseMemory('watch-the-lock.md', raw)).toEqual({
      id: 'watch-the-lock',
      type: 'pitfall',
      title: 'Watch the lock',
      tags: ['locks', 'io'],
      date: '2026-02-03',
      path: '.specify/memory/notes/watch-the-lock.md',
      body: 'Body text.',
    });
  });

  it('FR-002: defaults tags to an empty list', () => {
    const raw = '---\ntype: convention\ntitle: Kebab case\n---\nUse kebab-case.\n';
    expect(parseMemory('kebab.md', raw)?.tags).toEqual([]);
  });

  it('FR-002: returns undefined when the title is missing', () => {
    expect(parseMemory('no-title.md', '---\ntype: learning\n---\nbody\n')).toBeUndefined();
  });

  it('FR-002: returns undefined when there is no frontmatter', () => {
    expect(parseMemory('plain.md', 'just text\n')).toBeUndefined();
  });
});
