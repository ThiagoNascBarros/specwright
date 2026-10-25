import { parseSpecification } from './spec-parser.js';
import { parseTasks } from './tasks-parser.js';
import type { ArtifactName, Feature, FeatureSummary } from './types.js';

const duplicates = (ids: string[]) => [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

/** Builds a feature from its raw files and validates it (FR-015). Never throws. */
export function buildFeature(id: string, files: { spec?: string; tasks?: string }, artifacts: ArtifactName[]): Feature {
  const errors: string[] = [];
  const warnings: string[] = [];
  const spec = files.spec === undefined ? undefined : parseSpecification(files.spec);
  const { tasks, warnings: taskWarnings } = files.tasks === undefined ? { tasks: [], warnings: [] } : parseTasks(files.tasks);

  if (!spec) errors.push('missing spec.md');
  else {
    if (!spec.title) errors.push('spec.md has no "# Feature Specification: <title>" heading');
    if (!spec.status) warnings.push('spec.md has no **Status** line');
    warnings.push(...spec.warnings);
    for (const dup of duplicates(spec.requirements.map((r) => r.id))) errors.push(`duplicate requirement ${dup}`);
    for (const dup of duplicates(spec.successCriteria.map((r) => r.id))) errors.push(`duplicate success criterion ${dup}`);
  }
  for (const dup of duplicates(tasks.map((t) => t.id))) errors.push(`duplicate task ${dup}`);
  warnings.push(...taskWarnings);

  return {
    id,
    title: spec?.title ?? '',
    status: spec?.status ?? '',
    artifacts,
    valid: errors.length === 0,
    issues: [...errors, ...warnings],
    spec,
    tasks,
  };
}

export const taskProgress = (feature: Pick<Feature, 'tasks'>) => ({
  done: feature.tasks.filter((t) => t.done).length,
  total: feature.tasks.length,
});

export function summarize(feature: Feature): FeatureSummary {
  const summary: FeatureSummary = {
    id: feature.id,
    title: feature.title,
    status: feature.status,
    valid: feature.valid,
    artifacts: feature.artifacts,
    tasks: taskProgress(feature),
    open_clarifications: feature.spec?.clarifications.length ?? 0,
  };
  if (feature.issues.length) summary.issues = feature.issues;
  return summary;
}
