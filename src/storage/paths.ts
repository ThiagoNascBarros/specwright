import { realpath, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { SpecwrightError } from '../errors.js';

/** The only top-level folders the server may touch (Spec Kit's layout). */
export const ALLOWED_TOP_LEVEL = ['specs', '.specify'] as const;

const outside = () =>
  new SpecwrightError('PATH_OUTSIDE_ROOT', 'Path is outside specs/ and .specify/.', 'Only Spec Kit folders can be read or written.');

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

const firstSegment = (path: string) => path.split(sep)[0];

/**
 * Resolves `rel` inside the project root, following symlinks, and rejects anything that is
 * not under specs/ or .specify/ once resolved (NFR-6, FR-001). New files are checked through their parent.
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
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) throw outside();
  if (!ALLOWED_TOP_LEVEL.includes(firstSegment(fromRoot) as never)) throw outside();
  return real;
}
