import { realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { SpecwrightError } from '../errors.js';

const outside = () =>
  new SpecwrightError('PATH_OUTSIDE_ROOT', 'Path resolves outside the Specwright root.', 'Use a path relative to the root.');

/** Returns the real path of the root, or throws NOT_INITIALIZED when it is not a directory. */
export async function ensureRoot(root: string): Promise<string> {
  try {
    const real = await realpath(root);
    if ((await stat(real)).isDirectory()) return real;
  } catch {
    // fall through
  }
  throw new SpecwrightError(
    'NOT_INITIALIZED',
    'The Specwright root does not exist.',
    'Create .specwright/specs/ in the project (or set SPECWRIGHT_DIR to an absolute path).',
  );
}

/**
 * Resolves `rel` inside `root`, following symlinks, and rejects anything that escapes it (NFR-6).
 * A path that does not exist yet is checked through its parent directory.
 */
export async function resolveInside(root: string, rel: string): Promise<string> {
  // Treat backslashes as separators on every platform so "..\\x" cannot slip through on POSIX.
  const normalized = rel.replace(/\\/g, '/');
  if (isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized)) throw outside();
  const realRoot = await ensureRoot(root);
  const target = resolve(realRoot, normalized);
  let real: string;
  try {
    real = await realpath(target);
  } catch {
    try {
      real = resolve(await realpath(dirname(target)), basename(target));
    } catch {
      real = target;
    }
  }
  const fromRoot = relative(realRoot, real);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) throw outside();
  return real;
}
