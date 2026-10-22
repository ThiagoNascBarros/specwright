import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTasks } from '../../src/features/tasks-parser.js';

const raw = readFileSync(new URL('../fixtures/speckit/specs/001-photo-albums/tasks.md', import.meta.url), 'utf8');

describe('FR-004: tasks.md parser', () => {
  const { tasks, warnings } = parseTasks(raw);

  it('FR-004: reads every task outside comments and fences, in file order', () => {
    expect(tasks.map((t) => t.id)).toEqual(['T001', 'T002', 'T003', 'T004', 'T005', 'T006', 'T007', 'T008', 'T009', 'T010', 'T011']);
  });

  it('FR-004: [x] and [X] both mean done', () => {
    expect(tasks.filter((t) => t.done).map((t) => t.id)).toEqual(['T001', 'T002']);
  });

  it('FR-004: reads the [P] flag, the [USn] story, the phase and the text', () => {
    expect(tasks.find((t) => t.id === 'T007')).toEqual({
      id: 'T007',
      done: false,
      parallel: true,
      story: 'US1',
      phase: 'User Story 1 - Upload photos (Priority: P1) 🎯 MVP',
      text: 'Create Photo model in src/models/photo.py',
    });
    expect(tasks.find((t) => t.id === 'T003')).toMatchObject({ parallel: true, story: undefined, phase: 'Setup (Shared Infrastructure)' });
    expect(tasks.find((t) => t.id === 'T008')).toMatchObject({ parallel: false, story: 'US1' });
  });

  it('FR-004: reports checkbox lines without a T### id as warnings', () => {
    expect(warnings).toEqual(['task without id ignored: "- [ ] TXXX Security hardening"']);
  });

  it('FR-004: T001 and T0010 are distinct ids', () => {
    const r = parseTasks('- [ ] T001 a\n- [ ] T0010 b\n');
    expect(r.tasks.map((t) => t.id)).toEqual(['T001', 'T0010']);
  });

  it('FR-004: CRLF and a BOM give the same tasks', () => {
    expect(parseTasks('﻿' + raw.replace(/\n/g, '\r\n')).tasks).toEqual(tasks);
  });

  it('FR-004: a task without description still parses', () => {
    expect(parseTasks('- [ ] T001\n').tasks[0]).toMatchObject({ id: 'T001', text: '' });
  });
});
