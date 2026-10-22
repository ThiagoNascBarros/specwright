import { describe, it, expect, afterEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, spec } from '../helpers.js';
import { startServer } from '../load/stdio-client.js';

const auth = spec(
  'auth-login',
  `## Context
Users log in with e-mail and password in \`src/auth/login.ts\`.

## Acceptance criteria
- [x] AC-1: valid credentials return a session
- [ ] AC-2: 5 failed attempts lock the account for 15 minutes

## Out of scope
- social login
`,
  { status: 'in-progress', title: 'Login with e-mail' },
);

const diff = `diff --git a/src/auth/lockout.ts b/src/auth/lockout.ts
new file mode 100644
--- /dev/null
+++ b/src/auth/lockout.ts
@@ -0,0 +1,1 @@
+export const MAX_ATTEMPTS = 5;
`;

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

describe('end-to-end agent workflow over stdio (all 10 tools)', () => {
  it('runs the full spec → code → validation → decision → memory → context loop', async () => {
    const { root } = await makeProject({ '.specwright/specs/auth-login.md': auth });
    const server = await startServer(root);
    close = server.close;
    const { call } = server;

    // 1. Discover what to work on.
    const specs = await call('list_specs');
    expect(specs.data.specs).toEqual([expect.objectContaining({ id: 'auth-login', criteria: { done: 1, total: 2 } })]);
    const open = await call('list_open_requirements');
    expect(open.data.open).toEqual([{ spec_id: 'auth-login', ac_id: 'AC-2', text: '5 failed attempts lock the account for 15 minutes' }]);

    // 2. Read only what is needed.
    const section = await call('get_spec', { spec_id: 'auth-login', section: 'acceptance-criteria' });
    expect(section.data.content).toContain('AC-2');
    expect(section.data.content).not.toContain('Users log in');

    // 3. Validate the work before saying "done".
    const check = await call('check_task_against_spec', { spec_id: 'auth-login', diff });
    expect(check.data.open_criteria.map((c: { ac_id: string }) => c.ac_id)).toEqual(['AC-2']);
    expect(check.data.out_of_scope).toEqual(['social login']);
    expect(check.data.diff_summary.totals).toEqual({ files: 1, added: 1, removed: 0 });

    // 4. Record progress, the decision and what was learned.
    const mark = await call('set_criterion_status', { spec_id: 'auth-login', ac_id: 'AC-2', done: true });
    expect(mark.data).toMatchObject({ changed: true, criteria: { done: 2, total: 2 } });
    expect(await readFile(join(root, 'specs/auth-login.md'), 'utf8')).toContain('- [x] AC-2');
    const decision = await call('log_decision', { spec_id: 'auth-login', title: 'Lock by account, not by IP', decision: 'Count failures per account.' });
    expect(decision.data.id).toBe('0001');
    const memory = await call('save_memory', { type: 'pitfall', title: 'Reset the lockout counter', body: 'Reset it after a successful login in `src/auth/lockout.ts`.', tags: ['auth'] });
    expect(memory.data.id).toBe('reset-the-lockout-counter');

    // 5. A later session recovers history and a minimal context.
    const later = await startServer(root);
    const closeFirst = close;
    close = async () => {
      await closeFirst();
      await later.close();
    };
    expect((await later.call('list_open_requirements')).data.open).toEqual([]);
    expect((await later.call('list_decisions', { spec_id: 'auth-login' })).data.decisions).toHaveLength(1);
    // Exact-term search: "account" matches the decision, "lockout" the memory.
    const found = await later.call('search_memory', { query: 'account lockout' });
    expect(found.data.results.map((r: { kind: string }) => r.kind).sort()).toEqual(['decision', 'memory']);
    const ctx = await later.call('pack_context', { task: 'change the account lockout duration', budget_tokens: 1000 });
    expect(ctx.data.used_tokens).toBeLessThanOrEqual(1000);
    expect(ctx.data.items.length).toBeGreaterThan(0);
    expect(ctx.data.files).toContain('src/auth/lockout.ts');
  });
});
