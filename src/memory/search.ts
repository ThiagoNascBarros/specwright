import type { Decision } from '../decisions/types.js';
import { countOccurrences, snippet, tokenize } from '../storage/text.js';
import type { Memory, SearchResult } from './types.js';

export const WEIGHTS = { title: 3, tags: 2, body: 1 } as const;

interface Searchable {
  result: Omit<SearchResult, 'score' | 'snippet'>;
  title: string;
  tags: string[];
  body: string;
}

const fromMemory = (m: Memory): Searchable => ({
  result: { kind: 'memory', id: m.id, title: m.title, type: m.type, tags: m.tags, date: m.date, path: m.path },
  title: m.title,
  tags: m.tags,
  body: m.body,
});

const fromDecision = (d: Decision): Searchable => ({
  result: { kind: 'decision', id: d.id, title: d.title, type: 'decision', spec_id: d.spec_id, date: d.date, path: d.path },
  title: d.title,
  tags: [],
  body: d.body,
});

export function score(terms: string[], item: Pick<Searchable, 'title' | 'tags' | 'body'>): number {
  const title = tokenize(item.title);
  const tags = tokenize(item.tags.join(' '));
  const body = tokenize(item.body);
  return terms.reduce(
    (sum, t) =>
      sum + countOccurrences(title, t) * WEIGHTS.title + countOccurrences(tags, t) * WEIGHTS.tags + countOccurrences(body, t) * WEIGHTS.body,
    0,
  );
}

/** Ranks memories and decisions for `terms`: score, then newest date, then id. */
export function rank(terms: string[], memories: Memory[], decisions: Decision[], limit: number): SearchResult[] {
  const unique = [...new Set(terms)];
  return [...memories.map(fromMemory), ...decisions.map(fromDecision)]
    .map((item) => ({ item, score: score(unique, item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.item.result.date.localeCompare(a.item.result.date) || a.item.result.id.localeCompare(b.item.result.id))
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item.result, score, snippet: snippet(item.body, unique) }));
}
