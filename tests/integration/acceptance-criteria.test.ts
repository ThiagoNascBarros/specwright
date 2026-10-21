import { describe, it, expect } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, connect, spec } from '../helpers.js';

const criteria = (lines: string) => `## Acceptance criteria\n${lines}\n`;

async function project() {
  return makeProject({
    '.specwright/specs/b-auth.md': spec('b-auth', criteria('- [x] AC-1: login\n- [ ] AC-2: lockout\n- [ ] AC-10: audit')),
    '.specwright/specs/a-pay.md': spec('a-pay', criteria('- [ ] AC-1: charge')),
    '.specwright/specs/broken.md': spec('other', criteria('- [ ] AC-1: hidden')),
  });
}

describe('acceptance-criteria: tools', () => {
  it('AC-1: lists open criteria of all valid specs, sorted, without invalid specs', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const { data } = await call('list_open_requirements');
    expect(data.open).toEqual([
      { spec_id: 'a-pay', ac_id: 'AC-1', text: 'charge' },
      { spec_id: 'b-auth', ac_id: 'AC-2', text: 'lockout' },
      { spec_id: 'b-auth', ac_id: 'AC-10', text: 'audit' },
    ]);
  });

  it('AC-2: filters by spec_id and reports unknown or invalid specs', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('list_open_requirements', { spec_id: 'a-pay' })).data.open).toHaveLength(1);
    expect((await call('list_open_requirements', { spec_id: 'nope' })).data).toMatchObject({ code: 'SPEC_NOT_FOUND' });
    expect((await call('list_open_requirements', { spec_id: 'broken' })).data).toMatchObject({
      code: 'INVALID_SPEC',
      hint: expect.stringContaining('id'),
    });
  });

  it('AC-3/AC-10: checks a criterion and returns the new count', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('set_criterion_status', { spec_id: 'b-auth', ac_id: 'AC-2', done: true });
    expect(r.data).toEqual({ spec_id: 'b-auth', ac_id: 'AC-2', done: true, changed: true, criteria: { done: 2, total: 3 } });
    expect(await readFile(join(root, 'specs/b-auth.md'), 'utf8')).toContain('- [x] AC-2: lockout');
    expect((await call('list_open_requirements', { spec_id: 'b-auth' })).data.open.map((o: { ac_id: string }) => o.ac_id)).toEqual(['AC-10']);
  });

  it('AC-4: unchecks a criterion', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('set_criterion_status', { spec_id: 'b-auth', ac_id: 'AC-1', done: false });
    expect(r.data).toMatchObject({ changed: true, criteria: { done: 0, total: 3 } });
  });

  it('AC-5: is idempotent and does not rewrite the file', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const path = join(root, 'specs/b-auth.md');
    const before = (await stat(path)).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    const r = await call('set_criterion_status', { spec_id: 'b-auth', ac_id: 'AC-1', done: true });
    expect(r.data).toMatchObject({ changed: false, criteria: { done: 1, total: 3 } });
    expect((await stat(path)).mtimeMs).toBe(before);
  });

  it('AC-8: unknown criterion and invalid spec are refused without changing the file', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const brokenBefore = await readFile(join(root, 'specs/broken.md'), 'utf8');
    expect((await call('set_criterion_status', { spec_id: 'b-auth', ac_id: 'AC-9', done: true })).data).toMatchObject({
      code: 'CRITERION_NOT_FOUND',
    });
    expect((await call('set_criterion_status', { spec_id: 'broken', ac_id: 'AC-1', done: true })).data).toMatchObject({
      code: 'INVALID_SPEC',
    });
    expect(await readFile(join(root, 'specs/broken.md'), 'utf8')).toBe(brokenBefore);
  });

  it('rejects malformed ac_id at the schema', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('set_criterion_status', { spec_id: 'b-auth', ac_id: 'ac 1', done: true })).isError).toBe(true);
  });
});
