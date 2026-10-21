import { describe, it, expect } from 'vitest';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside, ensureRoot } from '../../src/storage/paths.js';
import { makeProject } from '../helpers.js';

async function setup() {
  const { project, root } = await makeProject({ '.specwright/specs/a.md': 'x', 'outside.md': 'secret' });
  return { project, root };
}

describe('spec-reading: path guard', () => {
  it('resolves a path inside the root', async () => {
    const { root } = await setup();
    expect(await resolveInside(root, 'specs/a.md')).toBe(join(root, 'specs/a.md'));
  });

  it('resolves a file that does not exist yet through its parent', async () => {
    const { root } = await setup();
    expect(await resolveInside(root, 'specs/new.md')).toBe(join(root, 'specs/new.md'));
  });

  it('AC-3: rejects ../ traversal', async () => {
    const { root } = await setup();
    await expect(resolveInside(root, '../outside.md')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('AC-3: rejects absolute paths', async () => {
    const { project, root } = await setup();
    await expect(resolveInside(root, join(project, 'outside.md'))).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('AC-3: rejects a symlink inside the root that points outside', async () => {
    const { project, root } = await setup();
    await symlink(join(project, 'outside.md'), join(root, 'specs/link.md'));
    await expect(resolveInside(root, 'specs/link.md')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('rejects backslash traversal (Windows-style separators)', async () => {
    const { root } = await setup();
    await expect(resolveInside(root, '..\\outside.md')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('AC-2: ensureRoot fails with NOT_INITIALIZED when the root is missing', async () => {
    const { project } = await makeProject();
    await expect(ensureRoot(join(project, '.specwright'))).rejects.toMatchObject({
      code: 'NOT_INITIALIZED',
      hint: expect.stringContaining('.specwright/specs/'),
    });
  });

  it('ensureRoot fails with NOT_INITIALIZED when the root is a file', async () => {
    const { project } = await makeProject();
    await mkdir(join(project, 'x'));
    await writeFile(join(project, 'x', 'f'), '');
    await expect(ensureRoot(join(project, 'x', 'f'))).rejects.toMatchObject({ code: 'NOT_INITIALIZED' });
  });
});
