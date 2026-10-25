// Small English + Portuguese stopword list: enough to keep "the"/"de" from dominating scores.
const STOPWORDS = new Set(
  (
    'an and are as at be by for from has have in is it its of on or that the this to was were will with ' +
    'ao aos as com da das de do dos em na nas no nos num numa os ou para pela pelas pelo pelos por que se um uma'
  ).split(' '),
);

/** Lowercase, accent-free terms of 2+ characters, without stopwords. */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

export function countOccurrences(terms: string[], term: string): number {
  let n = 0;
  for (const t of terms) if (t === term) n++;
  return n;
}

/** Up to `max` characters of `text` around the first occurrence of any term, on one line. */
export function snippet(text: string, terms: string[], max = 200): string {
  const flat = text
    .replace(/^#{1,6}\s+(.*)$/gm, '$1:')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= max) return flat;
  const folded = flat.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hits = terms.map((t) => folded.search(new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`))).filter((i) => i >= 0);
  // NFD may lengthen the string; clamp so the window stays inside `flat`.
  const at = Math.min(hits.length ? Math.min(...hits) : 0, flat.length);
  const start = Math.max(0, Math.min(at - Math.floor(max / 3), flat.length - max));
  const window = flat.slice(start, start + max - 2);
  return `${start > 0 ? '…' : ''}${window}${start + max - 2 < flat.length ? '…' : ''}`.slice(0, max);
}

// A backticked token that looks like a file path: has a slash or a file extension, no spaces.
const CODE_SPAN = /`([^`\s]+)`/g;
// A bare path in prose, as Spec Kit tasks write them: "Create Album model in src/models/album.py".
const BARE_PATH = /(?:^|\s)((?:[\w@.-]+\/)+[\w@.-]+\.[a-zA-Z0-9]{1,8})(?=[\s,;:)]|\.(?:\s|$)|$)/g;
/** Feature id and item id patterns (FR/SC/US/T), shared with graph mentions. */
export const FEATURE_ID_SOURCE = String.raw`(?:\d{3,}|\d{8}-\d{6})-[\p{L}\p{N}][\p{L}\p{N}_-]*`;
export const ITEM_ID_SOURCE = String.raw`(?:(?:FR|SC)-\d{3,}|US\d+|T\d{3,})`;
export const QUALIFIED_ID = new RegExp(`^${FEATURE_ID_SOURCE}/${ITEM_ID_SOURCE}$`, 'u');
const PATH_LIKE = /^(?:\.{0,2}\/)?[\w@.-]+(?:\/[\w@.-]+)*\.[a-zA-Z0-9]{1,8}$|^[\w@.-]+(?:\/[\w@.-]+)+\/?$/;

/** Paths cited in backticks or bare in `text`, unique, in order of first appearance. Pure text work. */
export function citedPaths(text: string): string[] {
  const found: Array<[number, string]> = [];
  for (const m of text.matchAll(CODE_SPAN)) if (PATH_LIKE.test(m[1])) found.push([m.index, m[1]]);
  for (const m of text.replace(CODE_SPAN, (c) => ' '.repeat(c.length)).matchAll(BARE_PATH)) found.push([m.index + m[0].indexOf(m[1]), m[1]]);
  return [...new Set(found.sort((a, b) => a[0] - b[0]).map(([, p]) => p).filter((p) => !QUALIFIED_ID.test(p)))];
}
