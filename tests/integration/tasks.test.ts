import { describe, it, expect } from 'vitest';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, connect, makeProject, specMd, tasksMd } from '../helpers.js';

const TASKS = 'specs/001-photo-albums/tasks.md';

describe('US2: list_open_tasks', () => {
  it('US2-AS1 / FR-007: lists open tasks of all features with id, parallel flag, story, phase and text', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const { data } = await call('list_open_tasks');
    expect(data.open.map((t: { feature: string; id: string }) => `${t.feature}:${t.id}`)).toEqual([
      ...['T003', 'T004', 'T005', 'T006', 'T007', 'T008', 'T009', 'T010', 'T011'].map((id) => `001-photo-albums:${id}`),
      '002-sharing:T001',
      '002-sharing:T002',
    ]);
    expect(data.open[4]).toEqual({
      feature: '001-photo-albums',
      id: 'T007',
      parallel: true,
      story: 'US1',
      phase: 'User Story 1 - Upload photos (Priority: P1) 🎯 MVP',
      text: 'Create Photo model in src/models/photo.py',
    });
    expect(data.open[0]).not.toHaveProperty('story');
  });

  it('FR-007: filters by feature and by story', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const { data } = await call('list_open_tasks', { feature: '001-photo-albums', story: 'US2' });
    expect(data.open.map((t: { id: string }) => t.id)).toEqual(['T009', 'T010']);
  });

  it('skips invalid features, and an explicit invalid feature gives INVALID_FEATURE', async () => {
    const { root } = await makeProject({
      'specs/001-ok/spec.md': specMd('Ok'),
      'specs/001-ok/tasks.md': tasksMd(['- [ ] T001 a']),
      'specs/002-bad/spec.md': specMd('Bad'),
      'specs/002-bad/tasks.md': tasksMd(['- [ ] T001 a', '- [ ] T001 b']),
    });
    const { call } = await connect(root);
    expect((await call('list_open_tasks')).data.open.map((t: { feature: string }) => t.feature)).toEqual(['001-ok']);
    expect((await call('list_open_tasks', { feature: '002-bad' })).data).toMatchObject({ code: 'INVALID_FEATURE', hint: expect.stringContaining('T001') });
  });
});

describe('US2: set_task_status', () => {
  it('US2-AS2 / FR-008: marks a task done and returns the new progress', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const r = await call('set_task_status', { feature: '001-photo-albums', task_id: 'T007', done: true });
    expect(r.data).toEqual({ feature: '001-photo-albums', task_id: 'T007', done: true, changed: true, tasks: { done: 3, total: 11 } });
    expect(await readFile(join(root, TASKS), 'utf8')).toContain('- [X] T007 [P] [US1]');
  });

  it('FR-008: is idempotent and does not rewrite the file', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const before = (await stat(join(root, TASKS))).mtimeMs;
    await new Promise((r) => setTimeout(r, 20));
    expect((await call('set_task_status', { feature: '001-photo-albums', task_id: 'T001', done: true })).data).toMatchObject({ changed: false });
    expect((await stat(join(root, TASKS))).mtimeMs).toBe(before);
  });

  it('errors: TASK_NOT_FOUND, ARTIFACT_NOT_FOUND (no tasks.md), INVALID_FEATURE, FEATURE_NOT_FOUND', async () => {
    const { root } = await makeProject({
      'specs/001-ok/spec.md': specMd('Ok'),
      'specs/001-ok/tasks.md': tasksMd(['- [ ] T001 a']),
      'specs/002-no-tasks/spec.md': specMd('No tasks'),
      'specs/003-bad/tasks.md': tasksMd(['- [ ] T001 a']),
    });
    const { call } = await connect(root);
    expect((await call('set_task_status', { feature: '001-ok', task_id: 'T009', done: true })).data).toMatchObject({ code: 'TASK_NOT_FOUND', hint: expect.stringContaining('T001') });
    expect((await call('set_task_status', { feature: '002-no-tasks', task_id: 'T001', done: true })).data).toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });
    expect((await call('set_task_status', { feature: '003-bad', task_id: 'T001', done: true })).data).toMatchObject({ code: 'INVALID_FEATURE' });
    expect((await call('set_task_status', { feature: '009-nope', task_id: 'T001', done: true })).data).toMatchObject({ code: 'FEATURE_NOT_FOUND' });
    expect(await readFile(join(root, 'specs/003-bad/tasks.md'), 'utf8')).toContain('- [ ] T001 a');
  });

  it('US2-AS3: rejects anything that is not a T### id, so checklist items cannot be marked', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const checklist = join(root, 'specs/001-photo-albums/checklists/ux.md');
    const before = await readFile(checklist, 'utf8');
    expect((await call('set_task_status', { feature: '001-photo-albums', task_id: 'CHK001', done: true })).isError).toBe(true);
    expect(await readFile(checklist, 'utf8')).toBe(before);
    expect(await readdir(join(root, 'specs/001-photo-albums'))).not.toContain('.tasks.md.tmp');
  });
});
