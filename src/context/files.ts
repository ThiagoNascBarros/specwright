export const MAX_FILES = 20;

// A backticked token that looks like a file path: has a slash or a file extension, no spaces.
const CODE_SPAN = /`([^`\s]+)`/g;
const PATH_LIKE = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.[a-zA-Z0-9]{1,8}$|^[\w@.-]+(?:\/[\w@.-]+)+\/?$/;

/**
 * Paths cited in backticks in `texts`, most cited first, at most MAX_FILES. Pure text work:
 * nothing is read from disk, so pack_context never looks outside the root (NFR-6).
 */
export function extractPaths(texts: string[]): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const [, token] of text.matchAll(CODE_SPAN)) {
      if (PATH_LIKE.test(token) && !/^AC-\d+$/.test(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FILES)
    .map(([path]) => path);
}
