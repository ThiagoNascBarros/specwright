import { describe, it, expect } from 'vitest';
import { copyFixture, connect, makeProject, specMd } from '../helpers.js';

const diff = `diff --git a/src/models/photo.py b/src/models/photo.py
new file mode 100644
--- /dev/null
+++ b/src/models/photo.py
@@ -0,0 +1,2 @@
+class SECRET_LINE_CONTENT:
+    pass
`;

describe('US3: check_against_spec', () => {
  it('US3-AS1 / FR-009: returns requirements, criteria, stories, edge cases, assumptions, tasks and the diff summary', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const r = await call('check_against_spec', { feature: '001-photo-albums', diff });
    const d = r.data;
    expect(d).toMatchObject({ feature: '001-photo-albums', title: 'Photo albums', status: 'Draft' });
    expect(d.requirements.map((x: { id: string }) => x.id)).toEqual(['FR-001', 'FR-002', 'FR-003', 'FR-004', 'FR-005']);
    expect(d.success_criteria.map((x: { id: string }) => x.id)).toEqual(['SC-001', 'SC-002']);
    expect(d.user_stories.map((s: { number: number; priority: string; scenarios: string[] }) => [s.number, s.priority, s.scenarios.length])).toEqual([
      [1, 'P1', 2],
      [2, 'P2', 1],
    ]);
    expect(d.edge_cases).toHaveLength(2);
    expect(d.assumptions).toHaveLength(2);
    expect(d.tasks.done).toBe(2);
    expect(d.tasks.total).toBe(11);
    expect(d.tasks.open[0]).toEqual({ id: 'T003', text: 'Configure linting and formatting tools' });
    expect(d.tasks.open.find((t: { id: string }) => t.id === 'T007')).toEqual({ id: 'T007', story: 'US1', text: 'Create Photo model in src/models/photo.py' });
    expect(d.diff_summary).toEqual({
      files: [{ path: 'src/models/photo.py', status: 'added', added: 2, removed: 0, hunks: 1 }],
      totals: { files: 1, added: 2, removed: 0 },
    });
    expect(r.text).not.toContain('SECRET_LINE_CONTENT');
  });

  it('US3-AS2: lists open clarifications', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    expect((await call('check_against_spec', { feature: '001-photo-albums', diff })).data.open_clarifications).toEqual(['size limit not specified']);
  });

  it.each(['', 'not a diff'])('INVALID_DIFF for "%s"', async (bad) => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    expect((await call('check_against_spec', { feature: '001-photo-albums', diff: bad })).data).toMatchObject({ code: 'INVALID_DIFF' });
  });

  it('FEATURE_NOT_FOUND and INVALID_FEATURE', async () => {
    const { root } = await makeProject({ 'specs/001-bad/spec.md': specMd('Bad', '- **FR-001**: a\n- **FR-001**: b\n') });
    const { call } = await connect(root);
    expect((await call('check_against_spec', { feature: '009-nope', diff })).data).toMatchObject({ code: 'FEATURE_NOT_FOUND' });
    expect((await call('check_against_spec', { feature: '001-bad', diff })).data).toMatchObject({ code: 'INVALID_FEATURE' });
  });
});
