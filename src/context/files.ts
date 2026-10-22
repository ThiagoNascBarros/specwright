export const MAX_FILES = 20;

// A backticked token that looks like a file path: has a slash or a file extension, no spaces.
const CODE_SPAN = /`([^`\s]+)`/g;
// A bare path in prose, as Spec Kit tasks write them: "Create Album model in src/models/album.py".
const BARE_PATH = /(?:^|\s)((?:[\w@.-]+\/)+[\w@.-]+\.[a-zA-Z0-9]{1,8})(?=[\s,;:)]|\.(?:\s|$)|$)/g;
const PATH_LIKE = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.[a-zA-Z0-9]{1,8}$|^[\w@.-]+(?:\/[\w@.-]+)+\/?$/;

/**
 * Paths cited in `texts` (in backticks, or bare as in Spec Kit task lines), most cited first, at most MAX_FILES. Pure text work:
 * nothing is read from disk, so pack_context never looks outside the root (NFR-6).
 */
export function extractPaths(texts: string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const seen = new Set<string>();
    for (const [, token] of text.matchAll(CODE_SPAN)) {
      if (PATH_LIKE.test(token)) seen.add(token);
    }
    for (const [, token] of text.replace(CODE_SPAN, ' ').matchAll(BARE_PATH)) seen.add(token);
    for (const token of seen) counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FILES)
    .map(([path]) => path);
}
