import { describe, it, expect } from 'vitest';
import { parseLinks } from '../../src/graph/links.js';

describe('graph: links', () => {
  it('FR-004: [[Note|alias]], [[Note#H]], [[Note#^b]], ![[Note]] give target "Note"', () => {
    const hits = parseLinks('[[Note|alias]] [[Note#H]] [[Note#^b]] ![[Note]]');
    expect(hits.map((h) => h.target)).toEqual(['Note', 'Note', 'Note', 'Note']);
    expect(hits.map((h) => h.embed)).toEqual([false, false, false, true]);
  });
  it('FR-004: [text](../a%20b.md#x) gives "../a b.md"', () => {
    expect(parseLinks('[text](../a%20b.md#x)')).toEqual([{ form: 'markdown', target: '../a b.md', embed: false }]);
  });
  it('FR-004: http(s), mailto, #anchor-only and ![img](x.png) are ignored', () => {
    expect(parseLinks('[a](https://x.io) [b](mailto:a@b.c) [c](#top) ![img](x.png) [[#H]] ![[pic.png]]')).toEqual([]);
  });
  it('FR-004: links inside inline code are ignored', () => {
    expect(parseLinks('`[[X]]` and `` [y](z.md) `` but [[Real]]').map((h) => h.target)).toEqual(['Real']);
  });
  it('FR-003: "- depends_on [[X]]" carries relation depends_on, and "- foo [[X]]" carries none', () => {
    expect(parseLinks('- depends_on [[X]]')[0].relation).toBe('depends_on');
    expect(parseLinks('- foo [[X]]')[0].relation).toBeUndefined();
  });
});
