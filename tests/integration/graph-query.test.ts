import { describe, it, expect, afterEach } from 'vitest';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

type Edge = [string, string, string, ...unknown[]];

describe('query_graph', () => {
  it('US1-AS1: "album sorting" in 001-photo-albums returns T005, US2, FR-002 and file:src/albums/sort.ts with implements/references/touches edges, and used_tokens ≤ budget_tokens', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('query_graph', { question: 'album sorting', feature: '001-photo-albums' });
    expect(isError).toBe(false);
    const ids = data.nodes.map((n: { id: string }) => n.id);
    expect(ids).toEqual(expect.arrayContaining([
      'task:001-photo-albums/T005',
      'story:001-photo-albums/US2',
      'requirement:001-photo-albums/FR-002',
      'file:src/albums/sort.ts',
    ]));
    expect(data.edges).toEqual(expect.arrayContaining([
      ['task:001-photo-albums/T005', 'implements', 'story:001-photo-albums/US2'] as Edge,
      ['task:001-photo-albums/T005', 'references', 'requirement:001-photo-albums/FR-002'] as Edge,
      ['task:001-photo-albums/T005', 'touches', 'file:src/albums/sort.ts'] as Edge,
    ]));
    expect(data.used_tokens).toBeLessThanOrEqual(data.budget_tokens);
  });

  it('US1-AS4: budget_tokens 200 keeps every seed and reports omitted counts and needed_budget_tokens', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { data } = await call('query_graph', { question: 'album sorting', feature: '001-photo-albums', budget_tokens: 200 });
    const ids = data.nodes.map((n: { id: string }) => n.id);
    expect(data.budget_tokens).toBe(200);
    expect(data.seeds.length).toBeGreaterThan(0);
    for (const seed of data.seeds) expect(ids).toContain(seed);
    expect(data.omitted.nodes + data.omitted.edges).toBeGreaterThan(0);
    expect(data.needed_budget_tokens).toBeGreaterThan(200);
  });

  it('FR-026: two calls in two server instances return byte-identical text', async () => {
    const { root } = await copyFixture('brain');
    const args = { question: 'album sorting', feature: '001-photo-albums' };
    const first = (await connect(root)).call;
    const a = await first('query_graph', args);
    resetGraphCache();
    const b = await (await connect(root)).call('query_graph', args);
    expect(a.isError).toBe(false);
    expect(a.data.nodes.map((n: { id: string }) => n.id)).toContain('requirement:001-photo-albums/FR-002');
    expect(b.text).toBe(a.text);
  });

  it('no seeds: a question with no match returns empty arrays and the no-match hint', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('query_graph', { question: 'zebra quantum' });
    expect(isError).toBe(false);
    expect(data).toMatchObject({ seeds: [], nodes: [], edges: [], hint: 'No node matches; try different words, get_node with an id, or search_memory.' });
  });

  it('INVALID_INPUT: a question without searchable terms or ids is an error with a code', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('query_graph', { question: 'the of and' });
    expect(isError).toBe(true);
    expect(data.code).toBe('INVALID_INPUT');
  });

  it('FEATURE_NOT_FOUND: an unknown feature is an error with a code', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('query_graph', { question: 'album sorting', feature: '999-missing' });
    expect(isError).toBe(true);
    expect(data.code).toBe('FEATURE_NOT_FOUND');
  });
});
