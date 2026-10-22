import { describe, it, expect } from 'vitest';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, makeProject } from '../helpers.js';

const starter = fileURLToPath(new URL('../../examples/starter/', import.meta.url));

describe('shipped examples', () => {
  it('the starter is a valid Spec Kit project, so the README quick start works', async () => {
    const { root } = await makeProject();
    await cp(join(starter, 'specs'), join(root, 'specs'), { recursive: true });
    await cp(join(starter, '.specify'), join(root, '.specify'), { recursive: true });
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features).toEqual([expect.objectContaining({ id: '001-auth-login', valid: true, tasks: { done: 0, total: 4 } })]);
    expect(data.features[0].issues).toBeUndefined();
    expect((await call('get_artifact', { artifact: 'constitution' })).isError).toBe(false);
  });
});
