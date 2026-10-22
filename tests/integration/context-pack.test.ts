import { describe, it, expect } from 'vitest';
import { makeProject, connect, spec } from '../helpers.js';

const auth = spec(
  'auth',
  `## Context
Login with e-mail and password. Code lives in \`src/auth/login.ts\`.

## Acceptance criteria
- [ ] AC-1: lockout after 5 failed login attempts

## Out of scope
- social login
`,
  { title: 'Login' },
);

const billing = spec('billing', '## Context\nInvoices and payments in `src/billing/invoice.ts`.\n', { title: 'Billing' });

async function seeded(overrides = {}) {
  const p = await makeProject({
    '.specwright/specs/auth.md': auth,
    '.specwright/specs/billing.md': billing,
    '.specwright/specs/broken.md': spec('other', '## Context\nlogin lockout everywhere login lockout\n'),
  });
  const c = await connect(p.root, overrides);
  await c.call('save_memory', { type: 'pitfall', title: 'Lockout counter resets', body: 'Reset the login counter in `src/auth/lockout.ts` after success.' });
  await c.call('log_decision', { spec_id: 'auth', title: 'Lockout by account', decision: 'Lock by account, not by IP.' });
  return { ...p, ...c };
}

describe('context-pack: pack_context', () => {
  it('AC-1/AC-5: returns ranked spec sections, memories and decisions', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'implement login lockout' });
    const kinds = new Set(data.items.map((i: { kind: string }) => i.kind));
    expect(kinds).toEqual(new Set(['spec-section', 'memory', 'decision']));
    for (const i of data.items) expect(Object.keys(i).sort()).toEqual(['content', 'kind', 'ref', 'score', 'title', 'tokens']);
    const scores = data.items.map((i: { score: number }) => i.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(data.items.some((i: { ref: string }) => i.ref.startsWith('billing'))).toBe(false);
  });

  it('AC-2/AC-3: token accounting and budget', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'login lockout', budget_tokens: 200 });
    for (const i of data.items) expect(i.tokens).toBe(Math.ceil(i.content.length / 4));
    expect(data.used_tokens).toBe(data.items.reduce((s: number, i: { tokens: number }) => s + i.tokens, 0));
    expect(data.used_tokens).toBeLessThanOrEqual(200);
  });

  it('AC-4: spec_id restricts sections and pins acceptance criteria first', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'invoices', spec_id: 'auth' });
    expect(data.items[0].ref).toBe('auth#acceptance-criteria');
    expect(data.items.filter((i: { kind: string }) => i.kind === 'spec-section').every((i: { ref: string }) => i.ref.startsWith('auth#'))).toBe(true);
  });

  it('AC-6: files are the backticked paths of the selected items', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'login lockout' });
    expect(data.files).toContain('src/auth/login.ts');
    expect(data.files).toContain('src/auth/lockout.ts');
    expect(data.files).not.toContain('src/billing/invoice.ts');
  });

  it('AC-7: invalid specs never contribute', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'login lockout' });
    expect(data.items.some((i: { ref: string }) => i.ref.startsWith('broken'))).toBe(false);
  });

  it('AC-8: input errors', async () => {
    const { call } = await seeded();
    expect((await call('pack_context', { task: 'the of ?' })).data).toMatchObject({ code: 'INVALID_INPUT' });
    expect((await call('pack_context', { task: 'login', budget_tokens: 100 })).isError).toBe(true);
    expect((await call('pack_context', { task: 'login', budget_tokens: 100_001 })).isError).toBe(true);
    expect((await call('pack_context', { task: 'login', spec_id: 'nope' })).data).toMatchObject({ code: 'SPEC_NOT_FOUND' });
  });

  it('AC-9: the effective budget is capped by maxResponseChars and the response is never truncated', async () => {
    const { call } = await seeded({ maxResponseChars: 3000 });
    const { data, text } = await call('pack_context', { task: 'login lockout', budget_tokens: 100_000 });
    expect(data.budget_tokens).toBe(Math.floor((3000 - 2000) / 4));
    expect(data.truncated).toBeUndefined();
    expect(text.length).toBeLessThanOrEqual(3000);
  });
});
