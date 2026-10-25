import { randomBytes } from 'node:crypto';
import { readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Writes via a temporary file in the same folder and a rename, so readers never see a partial file (NFR-5). */
export async function writeAtomic(path: string, text: string): Promise<void> {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  try {
    await writeFile(tmp, text);
    await rename(tmp, path);
  } catch (error) {
    await rm(tmp, { force: true });
    throw error;
  }
}

/** Creates a new file, failing with EEXIST instead of overwriting one. */
export async function createExclusive(path: string, text: string): Promise<void> {
  await writeFile(path, text, { flag: 'wx' });
}

/** Reads a UTF-8 file, or returns undefined when it does not exist. */
export async function readTextIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** Names (not paths) of `*.md` files in `dir`, sorted; empty when the directory is missing. */
export async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.md') && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Like writeAtomic, but leaves the file (and its mtime) alone when the content is identical. Returns whether it wrote. */
export async function writeAtomicIfChanged(path: string, text: string): Promise<boolean> {
  if ((await readTextIfExists(path)) === text) return false;
  await writeAtomic(path, text);
  return true;
}

/** Size and mtime of a file, or undefined when it does not exist. */
export async function statIfExists(path: string): Promise<{ size: number; mtimeMs: number } | undefined> {
  try {
    const { size, mtimeMs } = await stat(path);
    return { size, mtimeMs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** `.md` files under `dir`, recursively, as sorted "/"-joined paths relative to `dir`. Skips dot-names, node_modules and symlinked folders. */
export async function listMarkdownTree(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const found: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    if (e.isDirectory()) found.push(...(await listMarkdownTree(join(dir, e.name))).map((p) => `${e.name}/${p}`));
    else if (e.name.endsWith('.md') && (e.isFile() || e.isSymbolicLink())) found.push(e.name);
  }
  return found.sort(cmp);
}
