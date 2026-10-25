import { describe, it, expect, afterEach } from 'vitest';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

describe('graph_report', () => {
  it('US3-AS1: counts by kind, relation and confidence, god nodes, communities, surprising and questions are present on the brain fixture', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('graph_report', {});
    expect(isError).toBe(false);
    expect(data.stats).toMatchObject({ nodes: expect.any(Number), edges: expect.any(Number), communities: expect.any(Number) });
    expect(Object.keys(data.stats.by_kind)).toEqual([...Object.keys(data.stats.by_kind)].sort());
    expect(Object.keys(data.stats.by_relation)).toEqual([...Object.keys(data.stats.by_relation)].sort());
    expect(Object.keys(data.stats.by_confidence)).toEqual([...Object.keys(data.stats.by_confidence)].sort());
    expect(data.stats.extraction.units).toBe(data.stats.extraction.pending + data.stats.extraction.covered);
    expect(data.stats.extraction.units).toBeGreaterThan(0);
    expect(Array.isArray(data.god_nodes)).toBe(true);
    expect(data.god_nodes.length).toBeGreaterThan(0);
    expect(data.communities.length).toBeGreaterThan(0);
    expect(Array.isArray(data.surprising)).toBe(true);
    expect(Array.isArray(data.questions)).toBe(true);
  });

  it('US3-AS2: the report is byte-identical in a new server instance (resetGraphCache between)', async () => {
    const { root } = await copyFixture('brain');
    const first = await connect(root);
    const a = JSON.stringify((await first.call('graph_report', {})).data);
    resetGraphCache();
    const second = await connect(root);
    const b = JSON.stringify((await second.call('graph_report', {})).data);
    expect(b).toBe(a);
  });

  it('US3-AS3: with community 0 it returns members (paged) and bridges, and an unknown id → INVALID_INPUT with hint', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('graph_report', { community: 0, limit: 2, offset: 0 });
    expect(isError).toBe(false);
    expect(data.community.id).toBe(0);
    expect(data.community.members.length).toBeLessThanOrEqual(2);
    expect(data.community.members[0]).toMatchObject({ id: expect.any(String), kind: expect.any(String), label: expect.any(String), degree: expect.any(Number) });
    expect(Array.isArray(data.community.bridges)).toBe(true);
    expect(data.offset).toBe(0);
    expect(data.limit).toBe(2);

    const missing = await call('graph_report', { community: 99999 });
    expect(missing.isError).toBe(true);
    expect(missing.data.code).toBe('INVALID_INPUT');
    expect(missing.data.hint).toMatch(/Communities: 0\.\.\d+/);
  });
});
