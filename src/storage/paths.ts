import { realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { SpecwrightError } from '../errors.js';

/** The only top-level folders the server may touch (Spec Kit's layout). */
export const ALLOWED_TOP_LEVEL = ['specs', '.specify'] as const;

const outside = (rel: string) =>
  new SpecwrightError('PATH_OUTSIDE_ROOT', `Path "${rel}" is outside specs/ and .specify/.`, 'Only Spec Kit folders can be read or written.');

/** Returns the real path of the project root, or throws NOT_INITIALIZED when it is not a directory. */
export async function ensureRoot(root: string): Promise<string> {
  try {
    const real = await realpath(root);
    if ((await stat(real)).isDirectory()) return real;
  } catch {
    // fall through
  }
  throw new SpecwrightError(
    'NOT_INITIALIZED',
    'The project root does not exist.',
    'Run `specify init` in the project, or set SPECWRIGHT_ROOT to the project root.',
  );
}

/**
 * Real path of `target`, resolving symlinks of its nearest existing ancestor when it does not exist
 * yet, so a later `mkdir -p` cannot follow an escaping symlink (e.g. `.specify` → outside).
 */
async function realpathOfNearest(target: string): Promise<string> {
  const missing: string[] = [];
  let current = target;
  for (;;) {
    try {
      return join(await realpath(current), ...missing.reverse());
    } catch {
      const parent = dirname(current);
      if (parent === current) return target;
      missing.push(current.slice(parent.length).replace(/^[\\/]/, ''));
      current = parent;
    }
  }
}

/**
 * Resolves `rel` inside the project root, following symlinks, and rejects anything that is
 * not under one of `prefixes` once resolved (NFR-6, FR-001, FR-021). New files are checked through their parent.
 */
export async function resolveWithin(root: string, rel: string, prefixes: readonly string[]): Promise<string> {
  // Treat backslashes as separators on every platform so "..\\x" cannot slip through on POSIX.
  const normalized = rel.replace(/\\/g, '/');
  if (isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) throw outside(rel);
  const realRoot = await ensureRoot(root);
  const target = resolve(realRoot, normalized);
  const real = await realpathOfNearest(target);
  const fromRoot = relative(realRoot, real);
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) throw outside(rel);
  if (!prefixes.some((p) => fromRoot === p || fromRoot.startsWith(`${p}${sep}`))) throw outside(rel);
  return real;
}

/** Resolves `rel` inside specs/ or .specify/ (FR-001). */
export const resolveInside = (root: string, rel: string): Promise<string> => resolveWithin(root, rel, ALLOWED_TOP_LEVEL);

/** True for a plain relative folder: no absolute/drive/backslash/`..`/hidden/node_modules segments, and not under specs/. */
export function isSafeRelativeDir(rel: string): boolean {
  if (rel.includes('\\') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) return false;
  const segments = rel.replace(/\/+$/, '').split('/');
  if (segments.some((s) => s === '' || s.startsWith('.') || s === 'node_modules')) return false;
  return segments[0] !== 'specs';
}
