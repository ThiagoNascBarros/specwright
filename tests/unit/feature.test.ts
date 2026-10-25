import { describe, it, expect } from 'vitest';
import { buildFeature, summarize } from '../../src/features/feature.js';
import { FEATURE_ID_PATTERN } from '../../src/features/types.js';
import { specMd, tasksMd } from '../helpers.js';

const spec = specMd('Albums', '## Requirements\n\n- **FR-001**: a\n- **FR-002**: b\n\n## Success Criteria\n\n- **SC-001**: c\n');

describe('FR-002 / FR-015: features', () => {
  it.each(['001-photo-albums', '1234-x', '20261021-143000-photo-albums'])('FR-002: "%s" is a feature id', (id) => {
    expect(FEATURE_ID_PATTERN.test(id)).toBe(true);
  });

  it.each(['01-short', 'archive', '001_photo', '001-', '001-a/b', '-001-x'])('FR-002: "%s" is not a feature id', (id) => {
    expect(FEATURE_ID_PATTERN.test(id)).toBe(false);
  });

  it('builds a valid feature with task progress and clarifications', () => {
    const f = buildFeature('001-a', { spec: spec + '- **FR-003**: [NEEDS CLARIFICATION: which?]\n', tasks: tasksMd(['- [X] T001 a', '- [ ] T002 b']) }, ['spec', 'tasks']);
    expect(summarize(f)).toEqual({
      id: '001-a',
      title: 'Albums',
      status: 'Draft',
      valid: true,
      artifacts: ['spec', 'tasks'],
      tasks: { done: 1, total: 2 },
      open_clarifications: 1,
    });
  });

  it.each([
    ['missing spec.md', { tasks: tasksMd(['- [ ] T001 a']) }, /spec\.md/],
    ['missing title heading', { spec: '## Requirements\n' }, /Feature Specification/],
    ['duplicate task id', { spec, tasks: tasksMd(['- [ ] T001 a', '- [x] T001 b']) }, /T001/],
    ['duplicate FR id', { spec: spec + '- **FR-001**: again\n' }, /FR-001/],
    ['duplicate SC id', { spec: spec + '- **SC-001**: again\n' }, /SC-001/],
  ])('FR-015: %s makes the feature invalid', (_name, files, issue) => {
    const f = buildFeature('001-a', files as { spec?: string; tasks?: string }, []);
    expect(f.valid).toBe(false);
    expect(f.issues.some((i) => issue.test(i))).toBe(true);
  });

  it('FR-015: warnings (task without id, missing status) keep the feature valid', () => {
    const f = buildFeature('001-a', { spec: '# Feature Specification: A\n', tasks: tasksMd(['- [ ] TXXX x']) }, []);
    expect(f.valid).toBe(true);
    expect(f.issues).toHaveLength(2);
  });
});
