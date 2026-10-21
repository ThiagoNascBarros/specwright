import { describe, it, expect } from 'vitest';
import { makeProject, connect, spec } from '../helpers.js';
import { timed } from '../perf/budget.js';

const body = `## Acceptance criteria
- [x] AC-1: login works
- [ ] AC-2: lockout after 5 attempts

## Out of scope
- social login
- password reset
`;

const diff = `diff --git a/src/lockout.ts b/src/lockout.ts
new file mode 100644
--- /dev/null
+++ b/src/lockout.ts
@@ -0,0 +1,2 @@
+export const SECRET_LINE_CONTENT = 5;
+export const minutes = 15;
`;

async function project() {
  return makeProject({
    '.specwright/specs/auth.md': spec('auth', body),
    '.specwright/specs/broken.md': spec('other', body),
  });
}

describe('check-task: check_task_against_spec', () => {
  it('AC-7: returns criteria, out-of-scope items and the summary, without diff content', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('check_task_against_spec', { spec_id: 'auth', diff });
    expect(r.data).toEqual({
      spec_id: 'auth',
      title: 'Title of auth',
      open_criteria: [{ ac_id: 'AC-2', text: 'lockout after 5 attempts' }],
      met_criteria: [{ ac_id: 'AC-1', text: 'login works' }],
      out_of_scope: ['social login', 'password reset'],
      diff_summary: {
        files: [{ path: 'src/lockout.ts', status: 'added', added: 2, removed: 0, hunks: 1 }],
        totals: { files: 1, added: 2, removed: 0 },
      },
    });
    expect(r.text).not.toContain('SECRET_LINE_CONTENT');
  });

  it.each(['', '   ', 'just some text'])('AC-8: "%s" gives INVALID_DIFF', async (bad) => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('check_task_against_spec', { spec_id: 'auth', diff: bad })).data).toMatchObject({ code: 'INVALID_DIFF' });
  });

  it('AC-8: unknown and invalid specs', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('check_task_against_spec', { spec_id: 'nope', diff })).data).toMatchObject({ code: 'SPEC_NOT_FOUND' });
    expect((await call('check_task_against_spec', { spec_id: 'broken', diff })).data).toMatchObject({ code: 'INVALID_SPEC' });
  });

  it('AC-9: summarizes a 50,000-line diff fast, with a small response', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const lines = Array.from({ length: 50_000 }, (_, i) => `+line ${i}`).join('\n');
    const huge = `--- a/big.txt\n+++ b/big.txt\n@@ -0,0 +1,50000 @@\n${lines}\n`;
    const { ms, value } = await timed(() => call('check_task_against_spec', { spec_id: 'auth', diff: huge }));
    expect(value.data.diff_summary.totals).toEqual({ files: 1, added: 50_000, removed: 0 });
    expect(ms).toBeLessThan(500 * (process.env.CI ? 2 : 1));
    expect(value.text.length).toBeLessThan(2000);
  });
});
