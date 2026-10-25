import { describe, it, expect } from 'vitest';
import { buildLinkIndex, resolveMarkdown, resolveWiki } from '../../src/graph/link-index.js';

const idx = buildLinkIndex([
  { path: 'docs/01-prd.md', node: 'doc:docs/01-prd.md' },
  { path: 'docs/guide/setup.md', node: 'doc:docs/guide/setup.md' },
  { path: '.specify/memory/notes/a/x.md', node: 'note:ax' },
  { path: '.specify/memory/notes/b/x.md', node: 'note:bx' },
]);

describe('link index', () => {
  it('FR-004: wikilink resolves by exact path, then unique suffix, then unique basename, case-insensitive with .md optional', () => {
    expect(resolveWiki(idx, 'docs/01-prd')).toEqual({ node: 'doc:docs/01-prd.md' });
    expect(resolveWiki(idx, 'Guide/Setup.md')).toEqual({ node: 'doc:docs/guide/setup.md' });
    expect(resolveWiki(idx, '01-PRD')).toEqual({ node: 'doc:docs/01-prd.md' });
    expect(resolveWiki(idx, 'nothing')).toEqual({ missing: true });
  });
  it('FR-004: two notes named x.md in different folders → ambiguous with both paths', () => {
    expect(resolveWiki(idx, 'x')).toEqual({ ambiguous: ['.specify/memory/notes/a/x.md', '.specify/memory/notes/b/x.md'] });
    expect(resolveWiki(idx, 'b/x')).toEqual({ node: 'note:bx' });
  });
  it('FR-004: a relative Markdown link resolves from the linking file\'s folder', () => {
    expect(resolveMarkdown(idx, 'docs/guide/setup.md', '../01-prd.md')).toEqual({ node: 'doc:docs/01-prd.md' });
    expect(resolveMarkdown(idx, 'docs/01-prd.md', 'guide/setup.md')).toEqual({ node: 'doc:docs/guide/setup.md' });
  });
  it('FR-004: ../outside-root → ignore; unknown .md → missing; ../src/a.ts → file', () => {
    expect(resolveMarkdown(idx, 'a.md', '../outside-root')).toEqual({ ignore: true });
    expect(resolveMarkdown(idx, 'docs/01-prd.md', 'nope.md')).toEqual({ missing: true });
    expect(resolveMarkdown(idx, 'docs/01-prd.md', '../src/a.ts')).toEqual({ file: 'src/a.ts' });
    expect(resolveMarkdown(idx, 'docs/01-prd.md', 'somefolder')).toEqual({ ignore: true });
  });
});
