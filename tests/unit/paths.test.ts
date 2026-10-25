import { describe, it, expect } from 'vitest';
import { symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveInside, resolveWithin, isSafeRelativeDir, ensureRoot } from '../../src/storage/paths.js';
import { makeProject } from '../helpers.js';

async function setup() {
  return makeProject({
    'specs/001-a/spec.md': 'x',
    '.specify/memory/constitution.md': 'x',
    'src/secret.ts': 'secret',
  });
}

describe('FR-001: path guard', () => {
  it('FR-001: allows paths under specs/ and .specify/', async () => {
    const { root } = await setup();
    expect(await resolveInside(root, 'specs/001-a/spec.md')).toBe(join(root, 'specs/001-a/spec.md'));
    expect(await resolveInside(root, '.specify/memory/notes/new.md')).toBe(join(root, '.specify/memory/notes/new.md'));
  });

  it.each(['src/secret.ts', 'README.md', '../x', 'specs/../src/secret.ts', '..\\x', 'specs\\..\\src\\secret.ts'])(
    'FR-001: refuses "%s"',
    async (rel) => {
      const { root } = await setup();
      await expect(resolveInside(root, rel)).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
    },
  );

  it('FR-001: refuses absolute paths', async () => {
    const { root } = await setup();
    await expect(resolveInside(root, join(root, 'specs/001-a/spec.md'))).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('FR-001: refuses a symlink inside specs/ that points elsewhere in the project', async () => {
    const { root } = await setup();
    await symlink(join(root, 'src/secret.ts'), join(root, 'specs/001-a/plan.md'));
    await expect(resolveInside(root, 'specs/001-a/plan.md')).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
  });

  it('a missing root gives NOT_INITIALIZED with a specify init hint', async () => {
    const { root } = await setup();
    await expect(ensureRoot(join(root, 'nope'))).rejects.toMatchObject({
      code: 'NOT_INITIALIZED',
      hint: expect.stringContaining('specify init'),
    });
  });
});

describe('FR-021: resolveWithin', () => {
  it('FR-021: allows a path under an extra prefix', async () => {
    const { root } = await makeProject({ 'docs/a.md': 'x' });
    expect(await resolveWithin(root, 'docs/a.md', ['docs'])).toBe(join(root, 'docs/a.md'));
  });

  it('FR-021: refuses traversal, absolute, backslash and escaping symlink paths with PATH_OUTSIDE_ROOT', async () => {
    const { root } = await makeProject({ 'docs/a.md': 'x', 'src/x.ts': 'x' });
    await symlink(join(root, '..'), join(root, 'docs/link'));
    for (const rel of ['docs/../src/x.ts', '/etc/x', '..\\x', 'docs/link/x.md']) {
      await expect(resolveWithin(root, rel, ['docs'])).rejects.toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
    }
  });

  it('FR-021: isSafeRelativeDir', () => {
    const table: Array<[string, boolean]> = [
      ['docs', true], ['docs/api/', true], ['', false], ['/abs', false], ['C:/x', false], ['a\\b', false],
      ['../x', false], ['a/../b', false], ['.hidden', false], ['a/.git', false], ['node_modules', false], ['specs', false], ['specs/x', false],
    ];
    for (const [dir, ok] of table) expect(isSafeRelativeDir(dir), dir).toBe(ok);
  });
});
