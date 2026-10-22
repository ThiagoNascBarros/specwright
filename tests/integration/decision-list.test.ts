import { describe, it, expect } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, connect, specMd } from '../helpers.js';

const DIR = '.specify/memory/decisions';

async function seeded() {
  const p = await makeProject({ 'specs/001-albums/spec.md': specMd('Albums'), 'specs/002-share/spec.md': specMd('Share') });
  const days = [10, 15, 20];
  let i = 0;
  const { call } = await connect(p.root, {}, () => new Date(2026, 9, days[i++]));
  await call('log_decision', { feature: '001-albums', title: 'A one', decision: 'd' });
  await call('log_decision', { feature: '002-share', title: 'B one', decision: 'd' });
  await call('log_decision', { feature: '001-albums', title: 'A two', decision: 'd' });
  return { ...p, call };
}

describe('US4: list_decisions', () => {
  it('FR-010: lists every decision sorted by id, without body', async () => {
    const { call } = await seeded();
    expect((await call('list_decisions')).data.decisions).toEqual([
      { id: '0001', feature: '001-albums', title: 'A one', date: '2026-10-10', status: 'accepted', path: `${DIR}/0001-a-one.md` },
      { id: '0002', feature: '002-share', title: 'B one', date: '2026-10-15', status: 'accepted', path: `${DIR}/0002-b-one.md` },
      { id: '0003', feature: '001-albums', title: 'A two', date: '2026-10-20', status: 'accepted', path: `${DIR}/0003-a-two.md` },
    ]);
  });

  it('FR-010: filters by feature and by inclusive dates', async () => {
    const { call } = await seeded();
    expect((await call('list_decisions', { feature: '001-albums' })).data.decisions.map((d: { id: string }) => d.id)).toEqual(['0001', '0003']);
    expect((await call('list_decisions', { from: '2026-10-15', to: '2026-10-20' })).data.decisions.map((d: { id: string }) => d.id)).toEqual(['0002', '0003']);
  });

  it('rejects bad dates and from > to', async () => {
    const { call } = await seeded();
    expect((await call('list_decisions', { from: '21/10/2026' })).isError).toBe(true);
    expect((await call('list_decisions', { from: '2026-10-20', to: '2026-10-10' })).data).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('reads a migrated v0.1.0 decision (spec_id, Context/Consequences) and skips malformed files', async () => {
    const { root, call } = await seeded();
    await writeFile(join(root, DIR, '0004-legacy.md'), '---\nid: "0004"\nspec_id: 001-albums\ntitle: Legacy\ndate: 2026-10-21\nstatus: accepted\n---\n## Context\nc\n## Consequences\nx\n');
    await writeFile(join(root, DIR, '0005-broken.md'), 'no frontmatter');
    const { data } = await call('list_decisions', { feature: '001-albums' });
    expect(data.decisions.map((d: { id: string }) => d.id)).toEqual(['0001', '0003', '0004']);
  });

  it('empty when there are no decisions', async () => {
    const { root } = await makeProject({ 'specs/001-albums/spec.md': specMd('Albums') });
    const { call } = await connect(root);
    expect((await call('list_decisions')).data).toEqual({ decisions: [] });
  });
});
