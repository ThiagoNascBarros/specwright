import { describe, it, expect } from 'vitest';
import { tokenize, countOccurrences, snippet, citedPaths } from '../../src/storage/text.js';

describe('memory: tokenizer', () => {
  it('AC-7: lowercases and strips accents', () => {
    expect(tokenize('Convenção de Nomes')).toEqual(['convencao', 'nomes']);
  });

  it('AC-9: drops stopwords, punctuation and 1-char terms', () => {
    expect(tokenize('the of a, e o de ... ?')).toEqual([]);
  });

  it('snippets drop Markdown heading markers', () => {
    expect(snippet('## Context\nWhy.\n## Decision\nWhat.', ['why'])).toBe('Context: Why. Decision: What.');
  });

  it('counts whole-term occurrences only', () => {
    expect(countOccurrences(tokenize('log logs log catalog'), 'log')).toBe(2);
  });
});

describe('FR-021: citedPaths', () => {
  it('FR-021: finds backticked and bare paths, ignores URLs, dedupes in order', () => {
    const text = 'See `src/a.ts` and src/b/c.py, also https://example.com/x/y.html and `src/a.ts` again.';
    expect(citedPaths(text)).toEqual(['src/a.ts', 'src/b/c.py']);
  });

  it('FR-021: a qualified id like 001-photo-albums/FR-003 is not a path', () => {
    expect(citedPaths('For `001-photo-albums/FR-003` and 002-x/T001 see `src/a.ts`.')).toEqual(['src/a.ts']);
  });
});
