import { describe, it, expect } from 'vitest';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, makeProject } from '../helpers.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));

describe('US6: Specwright follows Spec Kit itself', () => {
  it('SC-005 / US6-AS1: the repository lists 9 valid features, 001-008 fully done', async () => {
    // A snapshot copy, so the test never depends on (or changes) the live checkboxes beyond this check.
    const { root } = await makeProject();
    await cp(join(repo, 'specs'), join(root, 'specs'), { recursive: true });
    await cp(join(repo, '.specify'), join(root, '.specify'), { recursive: true });
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features.map((f: { id: string }) => f.id)).toEqual([
      '001-project-foundation',
      '002-spec-reading',
      '003-acceptance-criteria',
      '004-decision-log',
      '005-check-task',
      '006-memory',
      '007-decision-list',
      '008-context-pack',
      '009-speckit-format',
    ]);
    for (const f of data.features) {
      expect(f, f.id).toMatchObject({ valid: true });
      expect(f.issues, f.id).toBeUndefined();
      if (f.id !== '009-speckit-format') expect(f.tasks.done, f.id).toBe(f.tasks.total);
    }
    expect((await call('get_artifact', { artifact: 'constitution' })).data.content).toContain('Test-First (NON-NEGOTIABLE)');
    expect((await call('list_decisions')).data.decisions).toHaveLength(10);
  });

  it('SC-005: no .specwright/ folder is left', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(repo, '.specwright'))).toBe(false);
  });
});
