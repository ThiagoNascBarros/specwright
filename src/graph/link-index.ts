import { posix } from 'node:path';

export type LinkResolution = { node: string } | { file: string } | { missing: true } | { ambiguous: string[] } | { ignore: true };
export interface LinkIndex { byPath: Map<string, { path: string; node: string }>; entries: Array<{ path: string; node: string; lower: string }> }

export function buildLinkIndex(entries: Array<{ path: string; node: string }>): LinkIndex {
  return {
    byPath: new Map(entries.map((e) => [e.path, e])),
    entries: entries.map((e) => ({ ...e, lower: e.path.toLowerCase() })),
  };
}

const pick = (hits: Array<{ path: string; node: string }>): LinkResolution | undefined =>
  hits.length === 1 ? { node: hits[0].node } : hits.length > 1 ? { ambiguous: hits.map((h) => h.path).sort() } : undefined;

/** Wikilink: exact path, then unique suffix, then unique basename; case-insensitive, `.md` optional. */
export function resolveWiki(index: LinkIndex, target: string): LinkResolution {
  const t = posix.normalize(target.trim().replace(/\\/g, '/')).replace(/^\.?\/+/, '').toLowerCase().replace(/\.md$/, '');
  const exact = index.entries.filter((e) => e.lower === `${t}.md`);
  const suffix = index.entries.filter((e) => e.lower.endsWith(`/${t}.md`));
  const base = index.entries.filter((e) => (e.lower.split('/').pop() ?? '').replace(/\.[^.]+$/, '') === t);
  return pick(exact) ?? pick(suffix) ?? pick(base) ?? { missing: true };
}

/** Markdown link, resolved from the linking file's folder. */
export function resolveMarkdown(index: LinkIndex, fromPath: string, href: string): LinkResolution {
  const path = posix.normalize(posix.join(posix.dirname(fromPath), href));
  if (path === '..' || path.startsWith('../')) return { ignore: true };
  const hit = index.byPath.get(path);
  if (hit) return { node: hit.node };
  if (path.endsWith('.md')) return { missing: true };
  return posix.extname(path) ? { file: path } : { ignore: true }; // no extension: probably a folder
}
