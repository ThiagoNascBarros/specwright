import { describe, it, expect, afterEach } from 'vitest';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

describe('find_path', () => {
  it('US1-AS3: find_path note:keep-ids-stable to requirement:001-photo-albums/FR-001 finds a path and is identical on two calls', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const a = await call('find_path', { from: 'note:keep-ids-stable', to: 'requirement:001-photo-albums/FR-001' });
    const b = await call('find_path', { from: 'note:keep-ids-stable', to: 'requirement:001-photo-albums/FR-001' });
    expect(a.isError).toBe(false);
    expect(a.data.hops).toBeGreaterThan(0);
    expect(a.data.nodes[0].id).toBe('note:keep-ids-stable');
    expect(a.data.nodes.at(-1).id).toBe('requirement:001-photo-albums/FR-001');
    expect(a.data.edges.length).toBe(a.data.hops);
    expect(b.text).toBe(a.text);
  });

  it('FR-026: two calls in two server instances return byte-identical text', async () => {
    const { root } = await copyFixture('brain');
    const args = { from: 'note:keep-ids-stable', to: 'requirement:001-photo-albums/FR-001' };
    const a = await (await connect(root)).call('find_path', args);
    resetGraphCache();
    const b = await (await connect(root)).call('find_path', args);
    expect(a.data.hops).toBeGreaterThan(0);
    expect(b.text).toBe(a.text);
  });

  it('no path: hops null and reason "No path within <n> hops." when max_hops is too small', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('find_path', { from: 'note:keep-ids-stable', to: 'requirement:001-photo-albums/FR-001', max_hops: 1 });
    expect(isError).toBe(false);
    expect(data).toMatchObject({ hops: null, reason: 'No path within 1 hops.' });
  });

  it('FR-012: from and to are resolved first, so an unknown from is NODE_NOT_FOUND even when from equals to', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('find_path', { from: 'zebra-quantum-xyzzy', to: 'zebra-quantum-xyzzy' });
    expect(isError).toBe(true);
    expect(data.code).toBe('NODE_NOT_FOUND');
    expect(typeof data.hint).toBe('string');
  });

  it('from equal to a resolved node is a zero-hop path', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { data } = await call('find_path', { from: '0002', to: 'decision:0002' });
    expect(data).toMatchObject({ hops: 0, edges: [] });
    expect(data.nodes.map((n: { id: string }) => n.id)).toEqual(['decision:0002']);
  });
});
