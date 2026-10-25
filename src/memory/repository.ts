import { mkdir } from 'node:fs/promises';
import { stringify } from 'yaml';
import { SpecwrightError } from '../errors.js';
import { mapLimit, READ_CONCURRENCY } from '../storage/concurrency.js';
import { createExclusive, listMarkdown, readTextIfExists } from '../storage/files.js';
import { parseDocument } from '../storage/markdown.js';
import { ensureRoot, resolveInside } from '../storage/paths.js';
import { localDate, slugify } from '../storage/slug.js';
import type { Memory, NewMemory } from './types.js';

/** Notes live next to Spec Kit's constitution, in the project memory folder. */
export const MEMORY_DIR = '.specify/memory/notes';
const MAX_SUFFIX = 1000;

export function renderMemory(id: string, input: NewMemory, date: string): string {
  const tags = [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))];
  return `---\n${stringify({ id, type: input.type, title: input.title, tags, date })}---\n${input.body.trim()}\n`;
}

/** Creates `memory/<slug>.md`, adding `-2`, `-3`… when the slug is taken. Never overwrites. */
export async function createMemory(root: string, input: NewMemory, now: Date): Promise<{ id: string; path: string }> {
  const dir = await resolveInside(root, MEMORY_DIR);
  await mkdir(dir, { recursive: true });
  const base = slugify(input.title) || 'memory';
  for (let n = 1; n <= MAX_SUFFIX; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    const path = `${MEMORY_DIR}/${id}.md`;
    try {
      await createExclusive(await resolveInside(root, path), renderMemory(id, input, localDate(now)));
      return { id, path };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new SpecwrightError('INTERNAL', `Too many memories titled "${input.title}".`);
}

/** Pure: parses one note file. Files without frontmatter or a title give `undefined`. */
export function parseMemory(name: string, raw: string): Memory | undefined {
  const doc = parseDocument(raw);
  const fm = (doc.frontmatter ?? {}) as Record<string, unknown>;
  if (!doc.frontmatter || typeof fm.title !== 'string') return undefined;
  return {
    id: name.slice(0, -3),
    type: String(fm.type ?? ''),
    title: fm.title,
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    date: String(fm.date ?? ''),
    path: `${MEMORY_DIR}/${name}`,
    body: doc.body.trim(),
  };
}

/** Reads every memory; files without frontmatter or title are skipped. */
export async function readMemories(root: string): Promise<Memory[]> {
  const realRoot = await ensureRoot(root);
  const names = await listMarkdown(`${realRoot}/${MEMORY_DIR}`);
  const memories = await mapLimit(names, READ_CONCURRENCY, async (name): Promise<Memory | undefined> => {
    let raw: string | undefined;
    try {
      raw = await readTextIfExists(await resolveInside(realRoot, `${MEMORY_DIR}/${name}`));
    } catch (error) {
      if (error instanceof SpecwrightError) return undefined;
      throw error;
    }
    return raw === undefined ? undefined : parseMemory(name, raw);
  });
  return memories.filter((m): m is Memory => m !== undefined);
}
