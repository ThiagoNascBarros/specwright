import { describe, it, expect } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, connect, spec } from '../helpers.js';

async function seeded() {
  const p = await makeProject({
    '.specwright/specs/auth.md': spec('auth'),
    '.specwright/specs/billing.md': spec('billing'),
  });
  const days = [10, 15, 20];
  let i = 0;
  const { call } = await connect(p.root, {}, () => new Date(2026, 9, days[i++]));
  await call('log_decision', { spec_id: 'auth', title: 'A one', decision: 'd' });
  await call('log_decision', { spec_id: 'billing', title: 'B one', decision: 'd' });
  await call('log_decision', { spec_id: 'auth', title: 'A two', decision: 'd' });
  return { ...p, call };
}

describe('decision-list: list_decisions', () => {
  it('AC-1: lists every decision sorted by id, without body', async () => {
    const { call } = await seeded();
    const { data } = await call('list_decisions');
    expect(data.decisions).toEqual([
      { id: '0001', spec_id: 'auth', title: 'A one', date: '2026-10-10', status: 'accepted', path: 'decisions/0001-a-one.md' },
      { id: '0002', spec_id: 'billing', title: 'B one', date: '2026-10-15', status: 'accepted', path: 'decisions/0002-b-one.md' },
      { id: '0003', spec_id: 'auth', title: 'A two', date: '2026-10-20', status: 'accepted', path: 'decisions/0003-a-two.md' },
    ]);
  });

  it('AC-2: filters by spec_id', async () => {
    const { call } = await seeded();
    expect((await call('list_decisions', { spec_id: 'auth' })).data.decisions.map((d: { id: string }) => d.id)).toEqual(['0001', '0003']);
  });

  it('AC-3: from and to are inclusive', async () => {
    const { call } = await seeded();
    const { data } = await call('list_decisions', { from: '2026-10-15', to: '2026-10-20' });
    expect(data.decisions.map((d: { id: string }) => d.id)).toEqual(['0002', '0003']);
  });

  it('AC-4: rejects bad dates and from > to', async () => {
    const { call } = await seeded();
    expect((await call('list_decisions', { from: '21/10/2026' })).isError).toBe(true);
    expect((await call('list_decisions', { from: '2026-10-20', to: '2026-10-10' })).data).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('AC-5: skips malformed files', async () => {
    const { root, call } = await seeded();
    await writeFile(join(root, 'decisions/0009-broken.md'), 'no frontmatter here');
    expect((await call('list_decisions')).data.decisions).toHaveLength(3);
  });

  it('AC-6: empty when decisions/ is missing', async () => {
    const { root } = await makeProject({ '.specwright/specs/auth.md': spec('auth') });
    const { call } = await connect(root);
    expect((await call('list_decisions')).data).toEqual({ decisions: [] });
  });
});
