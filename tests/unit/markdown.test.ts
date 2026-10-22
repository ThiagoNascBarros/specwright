import { describe, it, expect } from 'vitest';
import { parseDocument, normalizeKey, listItems } from '../../src/storage/markdown.js';

const doc = `---
id: a
title: A
---
Preamble text.

## Context
Some context.
### Detail
Inner detail.

## Acceptance criteria
- [ ] AC-1: first
`;

describe('spec-reading: markdown', () => {
  it('AC-4: splits frontmatter and sections; ### stays in its parent; preamble belongs to no section', () => {
    const parsed = parseDocument(doc);
    expect(parsed.frontmatter).toEqual({ id: 'a', title: 'A' });
    expect(parsed.sections.map((s) => s.key)).toEqual(['context', 'acceptance-criteria']);
    expect(parsed.sections[0].content).toContain('### Detail\nInner detail.');
    expect(parsed.sections.some((s) => s.content.includes('Preamble'))).toBe(false);
  });

  it('AC-4: gives the same sections for LF, CRLF and a UTF-8 BOM', () => {
    const lf = parseDocument(doc);
    const crlf = parseDocument(doc.replace(/\n/g, '\r\n'));
    const bom = parseDocument('﻿' + doc);
    expect(crlf.sections).toEqual(lf.sections);
    expect(bom.sections).toEqual(lf.sections);
    expect(crlf.frontmatter).toEqual(lf.frontmatter);
    expect(bom.frontmatter).toEqual(lf.frontmatter);
  });

  it('ignores ## lines inside fenced code blocks', () => {
    const parsed = parseDocument('---\nid: a\n---\n## Real\n```\n## not a heading\n```\n');
    expect(parsed.sections.map((s) => s.key)).toEqual(['real']);
  });

  it('reports a missing frontmatter', () => {
    const parsed = parseDocument('## Only body\n');
    expect(parsed.frontmatter).toBeUndefined();
    expect(parsed.sections.map((s) => s.key)).toEqual(['only-body']);
  });

  it('reports invalid YAML instead of throwing', () => {
    const parsed = parseDocument('---\nid: [unclosed\n---\n');
    expect(parsed.frontmatterError).toBeTruthy();
  });

  it('handles an empty file and a frontmatter-only file', () => {
    expect(parseDocument('').sections).toEqual([]);
    expect(parseDocument('---\nid: a\n---\n').sections).toEqual([]);
  });

  it('normalizes keys: lowercase, no accents, no emoji, single dashes', () => {
    expect(normalizeKey('Critérios  de   Aceite')).toBe('criterios-de-aceite');
    expect(normalizeKey('🚀 Out of scope')).toBe('out-of-scope');
  });

  it('lists the items of a section', () => {
    expect(listItems('## Out of scope\n- one\n* two\n  - nested\ntext\n')).toEqual(['one', 'two', 'nested']);
  });
});

describe('R4: comments and fences', () => {
  it('stripComments removes single- and multi-line HTML comments', async () => {
    const { stripComments } = await import('../../src/storage/markdown.js');
    expect(stripComments('a <!-- x --> b\n<!--\n- **FR-099**: no\n-->\nc')).toBe('a  b\n\nc');
  });

  it('scanLines marks fenced and commented lines as skipped and keeps CRLF out of the text', async () => {
    const { scanLines } = await import('../../src/storage/markdown.js');
    const lines = scanLines('a\r\n```\nb\n```\n<!--\nc\n-->\nd');
    expect(lines.filter((l) => !l.skip).map((l) => l.text)).toEqual(['a', 'd']);
  });
});
