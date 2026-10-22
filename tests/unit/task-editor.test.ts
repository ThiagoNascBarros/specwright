import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { setTaskCheckbox } from '../../src/features/task-editor.js';

const raw = readFileSync(new URL('../fixtures/speckit/specs/001-photo-albums/tasks.md', import.meta.url), 'utf8');
const diffBytes = (a: string, b: string) => [...Buffer.from(a)].filter((byte, i) => byte !== Buffer.from(b)[i]).length;

describe('US2: task editor', () => {
  it('US2-AS2 / SC-002: marking a task done writes [X] and changes exactly one byte', () => {
    const out = setTaskCheckbox(raw, 'T007', true)!;
    expect(out).toContain('- [X] T007 [P] [US1] Create Photo model in src/models/photo.py');
    expect(out.length).toBe(raw.length);
    expect(diffBytes(raw, out)).toBe(1);
  });

  it('FR-008: reopening a task writes a space, for [X] and for lowercase [x]', () => {
    expect(setTaskCheckbox(raw, 'T001', false)).toContain('- [ ] T001 Create project structure');
    expect(setTaskCheckbox(raw, 'T002', false)).toContain('- [ ] T002 Initialize');
  });

  it('FR-008: is idempotent (same text when the state already matches)', () => {
    expect(setTaskCheckbox(raw, 'T001', true)).toBe(raw);
    expect(setTaskCheckbox(raw, 'T002', true)).toBe(raw);
    expect(setTaskCheckbox(raw, 'T003', false)).toBe(raw);
  });

  it('FR-008: preserves CRLF and a BOM byte for byte', () => {
    const crlf = '﻿' + raw.replace(/\n/g, '\r\n');
    const out = setTaskCheckbox(crlf, 'T010', true)!;
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.replace('- [X] T010', '- [ ] T010')).toBe(crlf);
  });

  it('FR-004: T001 does not match T0010', () => {
    const text = '- [ ] T0010 b\n- [ ] T001 a\n';
    expect(setTaskCheckbox(text, 'T001', true)).toBe('- [ ] T0010 b\n- [X] T001 a\n');
  });

  it('never touches task-like lines in a code fence or an HTML comment', () => {
    expect(setTaskCheckbox(raw, 'T999', true)).toBeUndefined();
    expect(setTaskCheckbox(raw, 'T900', true)).toBeUndefined();
  });
});
