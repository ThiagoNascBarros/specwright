import { readdir, stat } from 'node:fs/promises';
import { SpecwrightError } from '../errors.js';
import { mapLimit, READ_CONCURRENCY } from '../storage/concurrency.js';
import { readTextIfExists } from '../storage/files.js';
import { ensureRoot, resolveInside } from '../storage/paths.js';
import {
  ARTIFACT_DIRS,
  ARTIFACT_FILES,
  existingArtifacts,
  FEATURES_DIR,
  featurePath,
  namedFiles,
  type FileArtifact,
  type NamedArtifact,
} from './artifacts.js';
import { buildFeature } from './feature.js';
import { FEATURE_ID_PATTERN, type Feature } from './types.js';

const notFound = (id: string) =>
  new SpecwrightError('FEATURE_NOT_FOUND', `Feature "${id}" not found.`, 'Call list_features to see the available ids.');

/** Feature folder names under specs/, sorted; other folders and files are ignored (FR-002). */
export async function listFeatureIds(root: string): Promise<string[]> {
  const realRoot = await ensureRoot(root);
  try {
    const entries = await readdir(`${realRoot}/${FEATURES_DIR}`, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && FEATURE_ID_PATTERN.test(e.name)).map((e) => e.name).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Resolves the folder of a feature, or throws FEATURE_NOT_FOUND. */
export async function featureDir(root: string, id: string): Promise<string> {
  if (!FEATURE_ID_PATTERN.test(id)) throw notFound(id);
  const dir = await resolveInside(root, featurePath(id));
  const isDir = await stat(dir).then((s) => s.isDirectory(), () => false);
  if (!isDir) throw notFound(id);
  return dir;
}

/** Reads and validates one feature. `tasksRaw` is the raw tasks.md text, when present. */
export async function readFeature(root: string, id: string): Promise<{ feature: Feature; tasksRaw?: string; tasksPath: string }> {
  const dir = await featureDir(root, id);
  const tasksPath = await resolveInside(root, featurePath(id, ARTIFACT_FILES.tasks));
  const [spec, tasksRaw, artifacts] = await Promise.all([
    resolveInside(root, featurePath(id, ARTIFACT_FILES.spec)).then(readTextIfExists),
    readTextIfExists(tasksPath),
    existingArtifacts(dir),
  ]);
  return { feature: buildFeature(id, { spec, tasks: tasksRaw }, artifacts), tasksRaw, tasksPath };
}

/** Every feature; one that cannot be read (escaping symlink, unreadable file) is listed as invalid instead of failing the listing. */
export async function readAllFeatures(root: string): Promise<Feature[]> {
  const ids = await listFeatureIds(root);
  return mapLimit(ids, READ_CONCURRENCY, async (id) => {
    try {
      return (await readFeature(root, id)).feature;
    } catch (error) {
      const reason = error instanceof SpecwrightError ? error.message : `cannot read: ${(error as NodeJS.ErrnoException).code ?? 'error'}`;
      return { ...buildFeature(id, {}, []), issues: [reason] };
    }
  });
}

/** Throws INVALID_FEATURE (issues as hint) unless the feature is valid. */
export function assertValid(feature: Feature): void {
  if (!feature.valid) {
    throw new SpecwrightError('INVALID_FEATURE', `Feature "${feature.id}" is invalid.`, `Fix: ${feature.issues.join('; ')}.`);
  }
}

/** Raw text of one artifact of a feature; named artifacts (checklist, contract) need `name`. */
export async function readArtifact(root: string, id: string, artifact: FileArtifact | NamedArtifact, name?: string): Promise<{ raw: string; path: string }> {
  const dir = await featureDir(root, id);
  if (artifact === 'checklist' || artifact === 'contract') {
    if (!name) throw new SpecwrightError('INVALID_INPUT', `"name" is required for a ${artifact}.`);
    const available = await namedFiles(dir, artifact);
    const file = available.find((f) => f === name) ?? available.find((f) => f === `${name}.md`);
    if (!file) {
      throw new SpecwrightError(
        'ARTIFACT_NOT_FOUND',
        `No ${artifact} "${name}" in feature "${id}".`,
        `Available: ${available.map((f) => f.replace(/\.md$/, '')).join(', ') || '(none)'}.`,
      );
    }
    const path = featurePath(id, `${ARTIFACT_DIRS[artifact]}/${file}`);
    return { raw: (await readTextIfExists(await resolveInside(root, path))) ?? '', path };
  }
  const path = featurePath(id, ARTIFACT_FILES[artifact]);
  const raw = await readTextIfExists(await resolveInside(root, path));
  if (raw === undefined) {
    const present = await existingArtifacts(dir);
    throw new SpecwrightError('ARTIFACT_NOT_FOUND', `Feature "${id}" has no ${ARTIFACT_FILES[artifact]}.`, `Available: ${present.join(', ') || '(none)'}.`);
  }
  return { raw, path };
}
