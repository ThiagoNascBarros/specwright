import { describe, it, expect } from 'vitest';
import { tokenize, countOccurrences, snippet } from '../../src/storage/text.js';

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
