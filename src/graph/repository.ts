import { mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DECISION_FILE, DECISIONS_DIR } from '../decisions/repository.js';
import { FEATURE_ID_PATTERN } from '../features/types.js';
import { MEMORY_DIR } from '../memory/repository.js';
import { createExclusive, listMarkdown, listMarkdownTree, readTextIfExists, writeAtomic } from '../storage/files.js';
import { ALLOWED_TOP_LEVEL, resolveInside, resolveWithin } from '../storage/paths.js';
import { EXTRACTOR_VERSION, GRAPH_DIR, RELATIONS_DIR, SNAPSHOT_SCHEMA } from './types.js';
import type { FileFacts, SourceFile, SourceKind } from './types.js';

export type Snapshot = { schema: number; extractor: number; files: Record<string, { size: number; mtimeMs: number; facts: FileFacts }> };

const CACHE_FILE = `${GRAPH_DIR}/cache.json`;
const ARTIFACTS: Array<[string, SourceKind]> = [['data-model.md', 'data-model'], ['plan.md', 'plan'], ['quickstart.md', 'quickstart'], ['research.md', 'research'], ['spec.md', 'spec'], ['tasks.md', 'tasks']];
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Source files with their stat, in plan order. `include` is honoured from Task 27. Escaping symlinks are skipped. */
export async function discoverSources(root: string, _include: readonly string[]): Promise<SourceFile[]> {
  const candidates: Array<Omit<SourceFile, 'size' | 'mtimeMs'>> = [];
  const specs = await resolveInside(root, 'specs');
  let folders: string[] = [];
  try {
    folders = (await readdir(specs, { withFileTypes: true })).filter((e) => e.isDirectory() && FEATURE_ID_PATTERN.test(e.name)).map((e) => e.name).sort(cmp);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  for (const feature of folders) {
    const names = new Set(await listMarkdown(join(specs, feature)));
    const own: Array<Omit<SourceFile, 'size' | 'mtimeMs'>> = ARTIFACTS.filter(([n]) => names.has(n)).map(([n, kind]) => ({ path: `specs/${feature}/${n}`, kind, feature }));
    for (const c of await listMarkdownTree(join(specs, feature, 'contracts'))) own.push({ path: `specs/${feature}/contracts/${c}`, kind: 'contract', feature });
    candidates.push(...own.sort((a, b) => cmp(a.path, b.path)));
  }
  candidates.push({ path: '.specify/memory/constitution.md', kind: 'constitution' });
  const flat = async (dir: string, kind: SourceKind, keep: (n: string) => boolean = () => true): Promise<void> => {
    for (const n of (await listMarkdown(await resolveInside(root, dir))).filter(keep)) candidates.push({ path: `${dir}/${n}`, kind });
  };
  await flat(DECISIONS_DIR, 'decision', (n) => DECISION_FILE.test(n));
  await flat(MEMORY_DIR, 'note');
  await flat(RELATIONS_DIR, 'ledger');

  const sources: SourceFile[] = [];
  for (const c of candidates) {
    try {
      const s = await stat(await resolveInside(root, c.path));
      if (s.isFile()) sources.push({ ...c, size: s.size, mtimeMs: s.mtimeMs });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'ENOENT' && code !== 'PATH_OUTSIDE_ROOT') throw error;
    }
  }
  return sources;
}

/** Reads one source through resolveWithin (specs/, .specify/ and the include folders). */
export async function readSource(root: string, path: string, include: readonly string[]): Promise<string> {
  return readFile(await resolveWithin(root, path, [...ALLOWED_TOP_LEVEL, ...include]), 'utf8');
}

/** The disk snapshot, or undefined when missing, unparsable or from another schema/extractor. */
export async function readSnapshot(root: string): Promise<Snapshot | undefined> {
  const raw = await readTextIfExists(await resolveInside(root, CACHE_FILE));
  if (raw === undefined) return undefined;
  try {
    const s = JSON.parse(raw) as Snapshot;
    return s?.schema === SNAPSHOT_SCHEMA && s.extractor === EXTRACTOR_VERSION && s.files && typeof s.files === 'object' ? s : undefined;
  } catch {
    return undefined;
  }
}

export async function writeSnapshot(root: string, snapshot: Snapshot): Promise<void> {
  await ensureGraphDir(root);
  await writeAtomic(await resolveInside(root, CACHE_FILE), JSON.stringify(snapshot));
}

/** Creates .specify/graph/ and its `.gitignore` ("*"), never overwriting an existing one (FR-008). */
export async function ensureGraphDir(root: string): Promise<void> {
  await mkdir(await resolveInside(root, GRAPH_DIR), { recursive: true });
  try {
    await createExclusive(await resolveInside(root, `${GRAPH_DIR}/.gitignore`), '*\n');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}
