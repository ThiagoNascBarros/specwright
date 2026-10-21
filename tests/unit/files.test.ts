import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { writeAtomic } from '../../src/storage/files.js';
import { makeProject } from '../helpers.js';

describe('acceptance-criteria: atomic write', () => {
  it('AC-9: replaces the file and leaves no temporary file', async () => {
    const { root } = await makeProject({ '.specwright/specs/a.md': 'old' });
    const target = join(root, 'specs/a.md');
    await writeAtomic(target, 'new');
    expect(await fs.readFile(target, 'utf8')).toBe('new');
    expect(await fs.readdir(join(root, 'specs'))).toEqual(['a.md']);
  });

  it('AC-9: removes the temporary file when the rename fails, and keeps the original', async () => {
    const { root } = await makeProject({ '.specwright/specs/a.md': 'old' });
    const target = join(root, 'specs/a.md');
    // Renaming a file onto an existing directory fails on every platform.
    await fs.mkdir(join(root, 'specs/dir.md'));
    await expect(writeAtomic(join(root, 'specs/dir.md'), 'new')).rejects.toThrow();
    expect((await fs.readdir(join(root, 'specs'))).sort()).toEqual(['a.md', 'dir.md']);
    expect(await fs.readFile(target, 'utf8')).toBe('old');
  });
});
