import { SpecwrightError } from '../errors.js';
import { readTextIfExists } from '../storage/files.js';
import { resolveInside } from '../storage/paths.js';
import { parseConstitution } from './parser.js';
import type { Constitution } from './types.js';

export const CONSTITUTION_PATH = '.specify/memory/constitution.md';

/** The parsed constitution, or undefined when the project has none. */
export async function readConstitution(root: string): Promise<Constitution | undefined> {
  const raw = await readTextIfExists(await resolveInside(root, CONSTITUTION_PATH));
  return raw === undefined ? undefined : parseConstitution(raw);
}

/** Like readConstitution, but a constitution that cannot be read safely is skipped (for search and context). */
export async function readConstitutionIfSafe(root: string): Promise<Constitution | undefined> {
  try {
    return await readConstitution(root);
  } catch (error) {
    if (error instanceof SpecwrightError && error.code === 'PATH_OUTSIDE_ROOT') return undefined;
    throw error;
  }
}
