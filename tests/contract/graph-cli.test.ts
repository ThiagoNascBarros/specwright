import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

const run = promisify(execFile);
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

/** Runs `specwright-mcp graph …` in the project; resolves with the exit code and stdout. */
async function graph(cwd: string, args: string[]): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await run(process.execPath, [entry, 'graph', ...args], { cwd, env: { ...process.env, SPECWRIGHT_ROOT: cwd } });
    return { code: 0, stdout };
  } catch (error) {
    const e = error as { code: number; stdout: string };
    return { code: e.code, stdout: e.stdout };
  }
}

afterEach(() => resetGraphCache());

describe('graph CLI', () => {
  it('US7-AS1: graph query prints the same JSON as query_graph and exits 0; an ambiguous node exits 3; an unknown one exits 4', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const expected = await call('query_graph', { question: 'album sorting', feature: '001-photo-albums' });
    const ok = await graph(root, ['query', 'album', 'sorting', '--feature', '001-photo-albums']);
    expect(ok.code).toBe(0);
    expect(JSON.parse(ok.stdout)).toEqual(expected.data);

    await writeFile(join(root, '.specify/memory/notes/keep-ids-copy.md'), '---\ntitle: Keep ids stable\ntype: convention\n---\n# Keep ids stable\n\nA copy.\n');
    expect((await graph(root, ['node', 'keep-ids-stable'])).code).toBe(0);
    resetGraphCache();
    expect((await graph(root, ['node', 'Keep ids stable'])).code).toBe(3);
    expect((await graph(root, ['node', 'zebra-quantum-xyzzy'])).code).toBe(4);
  });

  it('US7-AS2: graph lint exits 1 with a broken link and 0 without', async () => {
    const { root } = await copyFixture('brain');
    expect((await graph(root, ['lint'])).code).toBe(0);
    await appendFile(join(root, '.specify/memory/notes/sorting-pitfall.md'), '\nSee [[missing-note]].\n');
    expect((await graph(root, ['lint'])).code).toBe(1);
  });

  it('FR-022: graph with no command exits 2 (usage), and the server path still starts without it', async () => {
    const { root } = await copyFixture('brain');
    expect((await graph(root, [])).code).toBe(2);
  });
});
