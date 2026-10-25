import { mkdir } from 'node:fs/promises';
import { stringify } from 'yaml';
import { SpecwrightError } from '../errors.js';
import { mapLimit, READ_CONCURRENCY } from '../storage/concurrency.js';
import { createExclusive, listMarkdown, readTextIfExists } from '../storage/files.js';
import { parseDocument } from '../storage/markdown.js';
import { withLock } from '../storage/lock.js';
import { ensureRoot, resolveInside } from '../storage/paths.js';
import { localDate, slugify } from '../storage/slug.js';
import type { Decision, NewDecision } from './types.js';

/** Next to Spec Kit's constitution, in the project memory folder. */
export const DECISIONS_DIR = '.specify/memory/decisions';
export const DECISION_FILE = /^(\d{4})-.+\.md$/;
const MAX_ATTEMPTS = 5;
/** Lock directory shared by every server process writing to the same root. */
const LOCK = '.lock';

// Serializes creations in this process; the directory lock serializes other processes (TRD §5.1).
let queue: Promise<unknown> = Promise.resolve();

/** Spec Kit's research format: Decision / Rationale / Alternatives considered; empty sections are omitted. */
export function renderDecision(id: string, input: NewDecision, date: string): string {
  const frontmatter = stringify({ id, feature: input.feature, title: input.title, date, status: 'accepted' });
  const sections = [
    ['Decision', input.decision],
    ['Rationale', input.rationale],
    ['Alternatives considered', input.alternatives],
  ]
    .filter(([, text]) => text?.trim())
    .map(([heading, text]) => `## ${heading}\n${text!.trim()}\n`);
  return `---\n${frontmatter}---\n${sections.join('\n')}`;
}

async function nextNumber(dir: string): Promise<number> {
  const numbers = (await listMarkdown(dir)).map((name) => DECISION_FILE.exec(name)?.[1]).filter(Boolean).map(Number);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

/** Creates the next decision file. The caller must have checked that the feature exists. */
export function createDecision(root: string, input: NewDecision, now: Date): Promise<{ id: string; path: string }> {
  const run = queue.then(async () => {
    const dir = await resolveInside(root, DECISIONS_DIR);
    await mkdir(dir, { recursive: true });
    const slug = slugify(input.title) || 'decision';
    // The number is only unique if no other process picks it between listing and creating.
    return withLock(`${dir}/${LOCK}`, async () => {
      let number = await nextNumber(dir);
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++, number++) {
        const id = String(number).padStart(4, '0');
        const path = `${DECISIONS_DIR}/${id}-${slug}.md`;
        try {
          await createExclusive(await resolveInside(root, path), renderDecision(id, input, localDate(now)));
          return { id, path };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      }
      throw new SpecwrightError('INTERNAL', `Could not allocate a decision number after ${MAX_ATTEMPTS} attempts.`);
    });
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Pure: parses one decision file. Files without a valid frontmatter or a numbered name give `undefined`. */
export function parseDecision(name: string, raw: string): Decision | undefined {
  const number = DECISION_FILE.exec(name)?.[1];
  const doc = parseDocument(raw);
  const fm = (doc.frontmatter ?? {}) as Record<string, unknown>;
  if (!number || !doc.frontmatter || typeof fm.title !== 'string') return undefined;
  return {
    id: number,
    // v0.1.0 decisions used spec_id; migrated files may still carry it.
    feature: String(fm.feature ?? fm.spec_id ?? ''),
    title: fm.title,
    date: String(fm.date ?? ''),
    status: String(fm.status ?? ''),
    path: `${DECISIONS_DIR}/${name}`,
    body: doc.body.replace(/^\n+/, ''),
  };
}

/** Reads every decision, sorted by id. Files without a valid frontmatter are skipped. */
export async function readDecisions(root: string): Promise<Decision[]> {
  const realRoot = await ensureRoot(root);
  const names = (await listMarkdown(`${realRoot}/${DECISIONS_DIR}`)).filter((n) => DECISION_FILE.test(n));
  const decisions = await mapLimit(names, READ_CONCURRENCY, async (name): Promise<Decision | undefined> => {
    let raw: string | undefined;
    try {
      raw = await readTextIfExists(await resolveInside(realRoot, `${DECISIONS_DIR}/${name}`));
    } catch (error) {
      if (error instanceof SpecwrightError) return undefined;
      throw error;
    }
    return raw === undefined ? undefined : parseDecision(name, raw);
  });
  return decisions.filter((d): d is Decision => d !== undefined);
}
