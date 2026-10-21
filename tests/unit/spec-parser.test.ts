import { describe, it, expect } from 'vitest';
import { parseSpec, findSection } from '../../src/specs/parser.js';

const valid = `---
id: auth
title: Auth
status: in-progress
---
## Context
c
## Acceptance criteria
- [x] AC-1: one
- [ ] AC-10: ten
* [X] AC-2: two
- [ ] no id here
## Out of scope
- social login
`;

describe('spec-reading: spec parser', () => {
  it('extracts criteria with exact ids (AC-1 and AC-10 are distinct)', () => {
    const s = parseSpec('auth', valid);
    expect(s.criteria.map((c) => [c.id, c.done])).toEqual([
      ['AC-1', true],
      ['AC-10', false],
      ['AC-2', true],
    ]);
    expect(s.valid).toBe(true);
  });

  it('a checkbox without AC id is an issue but keeps the spec valid', () => {
    const s = parseSpec('auth', valid);
    expect(s.issues.some((i) => i.includes('no id here'))).toBe(true);
    expect(s.valid).toBe(true);
  });

  it('reads out-of-scope items', () => {
    expect(parseSpec('auth', valid).outOfScope).toEqual(['social login']);
  });

  it('a spec without criteria section has zero criteria', () => {
    expect(parseSpec('a', '---\nid: a\ntitle: A\nstatus: draft\n---\n## Context\n').criteria).toEqual([]);
  });

  it('accepts the Portuguese alias for the criteria section', () => {
    const s = parseSpec('a', '---\nid: a\ntitle: A\nstatus: draft\n---\n## Critérios de aceite\n- [ ] AC-1: x\n');
    expect(s.criteria).toHaveLength(1);
  });

  it.each([
    ['missing frontmatter', '## Context\n', /frontmatter/],
    ['missing title', '---\nid: a\nstatus: draft\n---\n', /title/],
    ['id mismatch', '---\nid: b\ntitle: A\nstatus: draft\n---\n', /id/],
    ['bad status', '---\nid: a\ntitle: A\nstatus: wip\n---\n', /status/],
    ['duplicate AC', '---\nid: a\ntitle: A\nstatus: draft\n---\n## Acceptance criteria\n- [ ] AC-1: x\n- [ ] AC-1: y\n', /AC-1/],
    ['duplicate heading', '---\nid: a\ntitle: A\nstatus: draft\n---\n## Context\n## Context\n', /heading/],
    ['invalid yaml', '---\nid: [x\n---\n', /frontmatter/],
  ])('AC-5: %s makes the spec invalid', (_name, text, issue) => {
    const s = parseSpec('a', text);
    expect(s.valid).toBe(false);
    expect(s.issues.some((i) => issue.test(i))).toBe(true);
  });

  it('AC-5: reports one issue per problem', () => {
    const s = parseSpec('a', '---\nid: b\nstatus: wip\n---\n');
    expect(s.issues).toHaveLength(3);
  });

  it('AC-9: finds a section by key, original heading or alias', () => {
    const s = parseSpec('auth', valid);
    expect(findSection(s, 'acceptance-criteria')?.key).toBe('acceptance-criteria');
    expect(findSection(s, 'Acceptance criteria')?.key).toBe('acceptance-criteria');
    expect(findSection(s, 'critérios de aceite')?.key).toBe('acceptance-criteria');
    expect(findSection(s, 'missing')).toBeUndefined();
  });
});
