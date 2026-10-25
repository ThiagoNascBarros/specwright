import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyFixture, connect } from '../helpers.js';
import { DEFAULT_GRAPH_CONFIG } from '../../src/config.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

const withInclude = (include: string[]) => ({ graph: { ...DEFAULT_GRAPH_CONFIG, include } });

describe('graph.include folders', () => {
  it('US6-AS1: with include ["docs"], get_node "docs/adr/0001-storage.md" is a doc node with links_to decision:0001', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root, withInclude(['docs']));
    const { isError, data } = await call('get_node', { ref: 'doc:docs/adr/0001-storage.md' });
    expect(isError).toBe(false);
    expect(data.node).toMatchObject({ id: 'doc:docs/adr/0001-storage.md', kind: 'doc' });
    const links = [...data.out, ...data.in];
    expect(links.some((row: string[]) => row[0] === 'links_to' && row[1] === 'decision:0001')).toBe(true);
  });

  it('US6-AS2: an included folder with a symlink to a folder outside the root, a .git/ and node_modules/ reads none of them', async () => {
    const { root } = await copyFixture('brain');
    const outside = await mkdtemp(join(tmpdir(), 'sw-outside-'));
    try {
      await writeFile(join(outside, 'sentinel.md'), '# Sentinel outside\n');
      await mkdir(join(root, 'docs', '.git'), { recursive: true });
      await writeFile(join(root, 'docs', '.git', 'secret.md'), '# Sentinel git\n');
      await mkdir(join(root, 'docs', 'node_modules'), { recursive: true });
      await writeFile(join(root, 'docs', 'node_modules', 'pkg.md'), '# Sentinel modules\n');
      await writeFile(join(root, 'docs', 'ok.md'), '# Ok page\n');
      await symlink(outside, join(root, 'docs', 'linked'), 'dir');
      const { call } = await connect(root, withInclude(['docs']));
      const { isError, data } = await call('graph_report', {});
      expect(isError).toBe(false);
      expect(data.stats.by_kind.doc).toBe(2); // docs/adr/0001-storage.md and docs/ok.md only
      expect((await call('get_node', { ref: 'doc:docs/.git/secret.md' })).isError).toBe(true);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('US6-AS3: without include, no node has a path outside specs/ and .specify/', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('graph_report', {});
    expect(isError).toBe(false);
    expect(data.stats.nodes).toBeGreaterThan(0);
    expect(data.stats.by_kind.doc ?? 0).toBe(0);
  });

  it('Review Focus 4: include pointing at a symlink that leaves the root → PATH_OUTSIDE_ROOT, no node created', async () => {
    const { root } = await copyFixture('brain');
    const outside = await mkdtemp(join(tmpdir(), 'sw-outside-'));
    try {
      await writeFile(join(outside, 'sentinel.md'), '# Sentinel outside\n');
      await rm(join(root, 'docs'), { recursive: true, force: true });
      await symlink(outside, join(root, 'docs'), 'dir');
      const { call } = await connect(root, withInclude(['docs']));
      const { isError, data } = await call('query_graph', { question: 'sentinel' });
      expect(isError).toBe(true);
      expect(data.code).toBe('PATH_OUTSIDE_ROOT');
      expect(JSON.stringify(data)).not.toContain(outside);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
