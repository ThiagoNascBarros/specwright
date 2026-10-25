import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { writeAtomic, writeAtomicIfChanged, statIfExists, listMarkdownTree } from '../../src/storage/files.js';
import { makeProject } from '../helpers.js';

describe('acceptance-criteria: atomic write', () => {
  it('AC-9: replaces the file and leaves no temporary file', async () => {
    const { root } = await makeProject({ 'specs/a.md': 'old' });
    const target = join(root, 'specs/a.md');
    await writeAtomic(target, 'new');
    expect(await fs.readFile(target, 'utf8')).toBe('new');
    expect(await fs.readdir(join(root, 'specs'))).toEqual(['a.md']);
  });

  it('AC-9: removes the temporary file when the rename fails, and keeps the original', async () => {
    const { root } = await makeProject({ 'specs/a.md': 'old' });
    const target = join(root, 'specs/a.md');
    // Renaming a file onto an existing directory fails on every platform.
    await fs.mkdir(join(root, 'specs/dir.md'));
    await expect(writeAtomic(join(root, 'specs/dir.md'), 'new')).rejects.toThrow();
    expect((await fs.readdir(join(root, 'specs'))).sort()).toEqual(['a.md', 'dir.md']);
    expect(await fs.readFile(target, 'utf8')).toBe('old');
  });
});

describe('FR-021: graph file helpers', () => {
  it('FR-021: listMarkdownTree lists nested .md files, skipping hidden, node_modules, symlinked dirs; missing dir gives []', async () => {
    const { root } = await makeProject({
      'd/b.md': 'x', 'd/sub/a.md': 'x', 'd/sub/n.txt': 'x', 'd/.hidden/h.md': 'x', 'd/node_modules/m.md': 'x', 'real/r.md': 'x',
    });
    await fs.symlink(join(root, 'real'), join(root, 'd/link'));
    expect(await listMarkdownTree(join(root, 'd'))).toEqual(['b.md', 'sub/a.md']);
    expect(await listMarkdownTree(join(root, 'missing'))).toEqual([]);
  });

  it('FR-021: writeAtomicIfChanged skips an identical write', async () => {
    const { root } = await makeProject({ 'specs/a.md': 'old' });
    const target = join(root, 'specs/a.md');
    expect(await writeAtomicIfChanged(target, 'new')).toBe(true);
    const before = (await fs.stat(target)).mtimeMs;
    expect(await writeAtomicIfChanged(target, 'new')).toBe(false);
    expect((await fs.stat(target)).mtimeMs).toBe(before);
  });

  it('FR-021: statIfExists returns undefined when missing', async () => {
    const { root } = await makeProject({ 'specs/a.md': 'abc' });
    expect(await statIfExists(join(root, 'nope'))).toBeUndefined();
    expect(await statIfExists(join(root, 'specs/a.md'))).toMatchObject({ size: 3 });
  });
});
