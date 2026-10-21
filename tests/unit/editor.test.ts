import { describe, it, expect } from 'vitest';
import { setCheckbox } from '../../src/specs/editor.js';

const raw = `---
id: a
title: A
status: draft
---
## Acceptance criteria
- [ ] AC-1: one
- [x] AC-10: ten
* [X] AC-2: two

\`\`\`
- [ ] AC-3: inside a fence
\`\`\`

## Notes
- [ ] AC-4: outside the section
`;

const diffBytes = (a: string, b: string) => [...Buffer.from(a)].filter((byte, i) => byte !== Buffer.from(b)[i]).length;

describe('acceptance-criteria: editor', () => {
  it('AC-3: checks one box and changes exactly one byte', () => {
    const out = setCheckbox(raw, 'AC-1', true)!;
    expect(out).toContain('- [x] AC-1: one');
    expect(out.length).toBe(raw.length);
    expect(diffBytes(raw, out)).toBe(1);
  });

  it('AC-4: unchecks [x] and [X]', () => {
    expect(setCheckbox(raw, 'AC-10', false)).toContain('- [ ] AC-10: ten');
    expect(setCheckbox(raw, 'AC-2', false)).toContain('* [ ] AC-2: two');
  });

  it('AC-5: returns the same text when the state already matches', () => {
    expect(setCheckbox(raw, 'AC-10', true)).toBe(raw);
    expect(setCheckbox(raw, 'AC-2', true)).toBe(raw);
  });

  it('AC-6: preserves CRLF and BOM byte for byte', () => {
    const crlf = '﻿' + raw.replace(/\n/g, '\r\n');
    const out = setCheckbox(crlf, 'AC-1', true)!;
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.length).toBe(crlf.length);
    expect(out.replace('- [x] AC-1', '- [ ] AC-1')).toBe(crlf);
  });

  it('AC-7: AC-1 does not match AC-10', () => {
    expect(setCheckbox(raw, 'AC-1', true)).toContain('- [x] AC-10: ten');
    expect(setCheckbox(raw, 'AC-10', false)).toContain('- [ ] AC-1: one');
  });

  it('AC-7: never touches lines in a fence or outside the criteria section', () => {
    expect(setCheckbox(raw, 'AC-3', true)).toBeUndefined();
    expect(setCheckbox(raw, 'AC-4', true)).toBeUndefined();
  });

  it('AC-8: returns undefined for an unknown criterion', () => {
    expect(setCheckbox(raw, 'AC-99', true)).toBeUndefined();
  });
});
