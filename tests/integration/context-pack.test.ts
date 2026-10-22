import { describe, it, expect } from 'vitest';
import { copyFixture, connect, makeProject, specMd, tasksMd } from '../helpers.js';

async function seeded(overrides = {}) {
  const p = await copyFixture('speckit');
  const c = await connect(p.root, overrides);
  await c.call('save_memory', { type: 'pitfall', title: 'Album sorting is by taken date', body: 'Sort albums by `taken_at`, never by upload time, see `src/services/albums.py`.' });
  await c.call('log_decision', { feature: '001-photo-albums', title: 'Albums sorted newest first', decision: 'Sort albums newest first.' });
  return { ...p, ...c };
}

type Item = { kind: string; ref: string; score: number; tokens: number; content: string };

describe('US5: pack_context', () => {
  it('US5-AS1 / FR-012: draws from spec and plan sections, tasks, constitution, decisions and notes', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'album sorting by month, test first', budget_tokens: 4000 });
    const kinds = new Set(data.items.map((i: Item) => i.kind));
    for (const k of ['spec-section', 'task', 'constitution', 'decision', 'memory']) expect(kinds).toContain(k);
    const refs = data.items.map((i: Item) => i.ref);
    expect(refs).toContain('001-photo-albums/tasks.md#T010');
    expect(refs.some((r: string) => /^001-photo-albums\/spec\.md#/.test(r))).toBe(true);
    expect(refs).toContain('constitution#ii-test-first-non-negotiable');
    for (const i of data.items) expect(Object.keys(i).sort()).toEqual(['content', 'kind', 'ref', 'score', 'title', 'tokens']);
  });

  it('FR-012: plan sections are candidates too', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'sqlite metadata storage' });
    expect(data.items.some((i: Item) => i.kind === 'plan-section' && i.ref.startsWith('001-photo-albums/plan.md#'))).toBe(true);
  });

  it('US5-AS1: with a feature, its open tasks come first in file order and their paths are in files', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'add album sorting', feature: '001-photo-albums', budget_tokens: 1000 });
    const tasks = data.items.filter((i: Item) => i.kind === 'task');
    expect(data.items.slice(0, tasks.length).every((i: Item) => i.kind === 'task')).toBe(true);
    expect(tasks.map((i: Item) => i.ref.split('#')[1])).toEqual(['T003', 'T004', 'T005', 'T006', 'T007', 'T008', 'T009', 'T010', 'T011']);
    expect(data.items.every((i: Item) => !i.ref.startsWith('002-sharing'))).toBe(true);
    expect(data.files).toContain('src/models/album.py');
    expect(data.used_tokens).toBeLessThanOrEqual(1000);
  });

  it('FR-012: stays within the budget and accounts tokens as ceil(chars/4)', async () => {
    const { call } = await seeded();
    const { data } = await call('pack_context', { task: 'photos albums upload', budget_tokens: 200 });
    for (const i of data.items) expect(i.tokens).toBe(Math.ceil(i.content.length / 4));
    expect(data.used_tokens).toBeLessThanOrEqual(200);
    expect(data.skipped).toBeGreaterThan(0);
  });

  it('invalid features never contribute; errors for bad input', async () => {
    const { root } = await makeProject({
      'specs/001-ok/spec.md': specMd('Ok', '## Requirements\n\n- **FR-001**: login works\n'),
      'specs/002-bad/tasks.md': tasksMd(['- [ ] T001 login login login']),
    });
    const { call } = await connect(root);
    const { data } = await call('pack_context', { task: 'login' });
    expect(data.items.every((i: Item) => !i.ref.startsWith('002-bad'))).toBe(true);
    expect((await call('pack_context', { task: 'the of ?' })).data).toMatchObject({ code: 'INVALID_INPUT' });
    expect((await call('pack_context', { task: 'login', feature: '009-nope' })).data).toMatchObject({ code: 'FEATURE_NOT_FOUND' });
    expect((await call('pack_context', { task: 'login', feature: '002-bad' })).data).toMatchObject({ code: 'INVALID_FEATURE' });
  });

  it('the effective budget is capped by maxResponseChars and the response is never truncated', async () => {
    const { call } = await seeded({ maxResponseChars: 3000 });
    const { data, text } = await call('pack_context', { task: 'album photos', budget_tokens: 100_000 });
    expect(data.budget_tokens).toBe(Math.floor((3000 - 2000) / 4));
    expect(data.truncated).toBeUndefined();
    expect(text.length).toBeLessThanOrEqual(3000);
  });
});
