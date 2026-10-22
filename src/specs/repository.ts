import { SpecwrightError } from '../errors.js';
import { mapLimit, READ_CONCURRENCY } from '../storage/concurrency.js';
import { listMarkdown, readTextIfExists } from '../storage/files.js';
import { ensureRoot, resolveInside } from '../storage/paths.js';
import { parseSpec } from './parser.js';
import { SPEC_ID_PATTERN, type Spec } from './types.js';

export const SPECS_DIR = 'specs';

export const specPath = (id: string) => `${SPECS_DIR}/${id}.md`;

/** Reads one spec by id; throws SPEC_NOT_FOUND when the file does not exist. */
export async function readSpec(root: string, id: string): Promise<{ spec: Spec; path: string; raw: string }> {
  if (!SPEC_ID_PATTERN.test(id)) throw new SpecwrightError('SPEC_NOT_FOUND', `Invalid spec id "${id}".`);
  const path = await resolveInside(root, specPath(id));
  const raw = await readTextIfExists(path);
  if (raw === undefined) {
    throw new SpecwrightError('SPEC_NOT_FOUND', `Spec "${id}" not found.`, 'Call list_specs to see the available ids.');
  }
  return { spec: parseSpec(id, raw), path, raw };
}

/** Throws INVALID_SPEC (with the issues as hint) unless the spec is valid. */
export function assertValid(spec: Spec): void {
  if (!spec.valid) {
    throw new SpecwrightError('INVALID_SPEC', `Spec "${spec.id}" is invalid.`, `Fix: ${spec.issues.join('; ')}.`);
  }
}

/** Reads every spec, sorted by id. Files that escape the root are reported as invalid, never read. */
export async function readAllSpecs(root: string): Promise<Spec[]> {
  const realRoot = await ensureRoot(root);
  const names = await listMarkdown(`${realRoot}/${SPECS_DIR}`);
  return mapLimit(names, READ_CONCURRENCY, async (name) => {
    const id = name.slice(0, -3);
    try {
      const raw = (await readTextIfExists(await resolveInside(realRoot, `${SPECS_DIR}/${name}`))) ?? '';
      return parseSpec(id, raw);
    } catch (error) {
      if (!(error instanceof SpecwrightError)) throw error;
      return { ...parseSpec(id, ''), issues: [error.message] };
    }
  });
}
