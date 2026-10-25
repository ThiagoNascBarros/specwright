import { SEMANTIC_RELATIONS } from './types.js';

export interface LinkHit { form: 'wiki' | 'markdown'; target: string; embed: boolean; relation?: (typeof SEMANTIC_RELATIONS)[number] }

const WIKI = /(!?)\[\[([^\[\]\n]+?)\]\]/g;
const MARKDOWN = /(!?)\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const NON_NOTE = /\.(?:png|jpe?g|gif|svg|webp|bmp|ico|avif|pdf)$/i;
const RELATION_LINE = /^\s*[-*]\s+([a-z_]+)\s+(\S.*?)\s*$/;

function decode(href: string): string {
  try { return decodeURIComponent(href); } catch { return href; }
}

/** Wikilinks and Markdown links in one line, in order. Inline code is ignored. */
export function parseLinks(line: string): LinkHit[] {
  const text = line.replace(/(`+)[^`]*?\1/g, (c) => ' '.repeat(c.length));
  const found: Array<{ at: number; raw: string; hit: LinkHit }> = [];
  for (const m of text.matchAll(WIKI)) {
    const target = m[2].split('|')[0].split('#')[0].trim();
    if (target === '' || (m[1] && NON_NOTE.test(target))) continue;
    found.push({ at: m.index, raw: m[0], hit: { form: 'wiki', target, embed: m[1] === '!' } });
  }
  for (const m of text.matchAll(MARKDOWN)) {
    if (m[1] || /^[a-z][a-z0-9+.-]*:/i.test(m[3]) || m[3].startsWith('#')) continue;
    const target = decode(m[3].split('#')[0].split('?')[0]);
    if (target === '') continue;
    found.push({ at: m.index, raw: m[0], hit: { form: 'markdown', target, embed: false } });
  }
  found.sort((a, b) => a.at - b.at);
  const rel = RELATION_LINE.exec(text);
  const relation = SEMANTIC_RELATIONS.find((r) => r === rel?.[1]);
  if (relation && found.length === 1 && found[0].raw === rel![2]) found[0].hit.relation = relation;
  return found.map((f) => f.hit);
}
