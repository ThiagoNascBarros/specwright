import { FEATURE_ID_SOURCE, ITEM_ID_SOURCE } from '../storage/text.js';

export type Mention =
  | { type: 'item' | 'story' | 'task'; id: string; feature?: string }
  | { type: 'feature'; id: string }
  | { type: 'decision'; id: string };

const FEAT = FEATURE_ID_SOURCE;
const ITEM = ITEM_ID_SOURCE;
// Alternation order matters: a qualified `<feature>/<item>` must win over its bare feature token.
const TOKEN = new RegExp(
  String.raw`(?<![\p{L}\p{N}_/.-])(?:(${FEAT})/(${ITEM})(?![\p{L}\p{N}_])|(${ITEM})(?![\p{L}\p{N}_])|(${FEAT})(?![\p{L}\p{N}_/]))`,
  'gu',
);
const DECISIONS = /\bdecisions?\s+(\d{4}(?:\s*(?:,|and|e|&|\/)\s*\d{4})*)/gi;

function itemMention(id: string, feature?: string): Mention {
  const type = id.startsWith('US') ? 'story' : id.startsWith('T') ? 'task' : 'item';
  return feature === undefined ? { type, id } : { type, id, feature };
}

/** Id-like tokens in one line, in order of appearance. Whether they exist is decided later. */
export function findMentions(line: string): Mention[] {
  const found: Array<[number, Mention]> = [];
  for (const m of line.matchAll(TOKEN)) {
    if (m[2]) found.push([m.index, itemMention(m[2], m[1])]);
    else if (m[3]) found.push([m.index, itemMention(m[3])]);
    else found.push([m.index, { type: 'feature', id: m[4] }]);
  }
  for (const m of line.matchAll(DECISIONS)) {
    const base = m.index + m[0].length - m[1].length;
    for (const n of m[1].matchAll(/\d{4}/g)) found.push([base + n.index, { type: 'decision', id: n[0] }]);
  }
  return found.sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}
