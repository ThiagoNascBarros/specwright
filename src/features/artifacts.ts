import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ARTIFACT_NAMES, type ArtifactName } from './types.js';

export const FEATURES_DIR = 'specs';

/** Single-file artifacts and the file each one lives in. */
export const ARTIFACT_FILES = {
  spec: 'spec.md',
  plan: 'plan.md',
  tasks: 'tasks.md',
  research: 'research.md',
  'data-model': 'data-model.md',
  quickstart: 'quickstart.md',
} as const;
export type FileArtifact = keyof typeof ARTIFACT_FILES;

/** Folders that hold named artifacts. */
export const ARTIFACT_DIRS = { checklist: 'checklists', contract: 'contracts' } as const;
export type NamedArtifact = keyof typeof ARTIFACT_DIRS;

export const featurePath = (id: string, file?: string) => (file ? `${FEATURES_DIR}/${id}/${file}` : `${FEATURES_DIR}/${id}`);

const exists = (path: string) => stat(path).then(() => true, () => false);

/** Files of a named-artifact folder (empty when missing). */
export async function namedFiles(featureDir: string, kind: NamedArtifact): Promise<string[]> {
  try {
    return (await readdir(join(featureDir, ARTIFACT_DIRS[kind]), { withFileTypes: true }))
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** Which artifacts exist in a feature folder (already resolved inside the root), in Spec Kit's order. */
export async function existingArtifacts(featureDir: string): Promise<ArtifactName[]> {
  const present = await Promise.all(
    ARTIFACT_NAMES.map(async (name) => {
      if (name === 'contracts') return (await namedFiles(featureDir, 'contract')).length > 0;
      if (name === 'checklists') return (await namedFiles(featureDir, 'checklist')).length > 0;
      return exists(join(featureDir, ARTIFACT_FILES[name]));
    }),
  );
  return ARTIFACT_NAMES.filter((_, i) => present[i]);
}
