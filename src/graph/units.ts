import { parseDocument, stripComments } from '../storage/markdown.js';
import { contentHash } from '../storage/hash.js';
import { tokensOf } from './budget.js';
import type { Unit } from './types.js';

interface Piece { id: string; section?: string; heading?: string; content: string }

/** Splits a source into hashable pieces: one per non-empty `##` section, or the whole body when there is none. */
function piecesOf(path: string, raw: string): Piece[] {
  // Comment-only lines go whole, so a comment leaves no blank line behind to change the hash.
  const { body, sections } = parseDocument(stripComments(raw.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*\n/gm, '')));
  if (sections.length === 0) {
    const content = body.replace(/\n+$/, '');
    return content.trim() === '' ? [] : [{ id: path, content }];
  }
  const seen = new Map<string, number>();
  const pieces: Piece[] = [];
  for (const s of sections) {
    if (s.content.split('\n').slice(1).join('\n').trim() === '') continue;
    const count = (seen.get(s.key) ?? 0) + 1;
    seen.set(s.key, count);
    const key = count === 1 ? s.key : `${s.key}-${count}`;
    pieces.push({ id: `${path}#${key}`, section: s.key, heading: s.heading, content: s.content });
  }
  return pieces;
}

export function unitsOf(input: { path: string; raw: string; node: string; scope: string; title: string }): Unit[] {
  return piecesOf(input.path, input.raw).map((p) => ({
    id: p.id,
    node: input.node,
    path: input.path,
    section: p.section,
    title: p.heading === undefined ? input.title : `${input.title} — ${p.heading}`,
    hash: contentHash(p.content),
    tokens: tokensOf(p.content),
    scope: input.scope,
  }));
}

/** The exact text that `unitsOf` hashed for this unit, or undefined when the unit is no longer in `raw`. */
export function unitContent(raw: string, unit: Pick<Unit, 'id' | 'path' | 'section'>): string | undefined {
  return piecesOf(unit.path, raw).find((p) => p.id === unit.id)?.content;
}
