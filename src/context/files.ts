import { citedPaths } from '../storage/text.js';

export const MAX_FILES = 20;

/**
 * Paths cited in `texts` (in backticks, or bare as in Spec Kit task lines), most cited first, at most MAX_FILES. Pure text work:
 * nothing is read from disk, so pack_context never looks outside the root (NFR-6).
 */
export function extractPaths(texts: string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const seen = citedPaths(text);
    for (const token of seen) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FILES)
    .map(([path]) => path);
}
