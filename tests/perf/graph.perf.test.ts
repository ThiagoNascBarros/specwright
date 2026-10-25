import { describe, it, expect } from 'vitest';
import { connect } from '../helpers.js';
import { DEFAULT_GRAPH_CONFIG } from '../../src/config.js';
import { resetGraphCache } from '../../src/graph/service.js';
import { factor, median, timed } from './budget.js';
import { speckitDataset } from './dataset.js';

const big = { maxResponseChars: 5_000_000 };

describe('SC-003: graph performance and scale', () => {
  it('SC-003: cold build (cache off) of 500 features + 1,000 notes < 1.5 s', async () => {
    const { root } = await speckitDataset(500, 1000, 50, { links: true });
    const { call } = await connect(root, { ...big, graph: { ...DEFAULT_GRAPH_CONFIG, cache: 'off' } });
    const { ms, value } = await timed(() => call('query_graph', { question: 'retry timeout' }));
    console.error(`[perf] cold build (500 features + 1000 notes) query_graph=${ms.toFixed(1)}ms`);
    expect(value.isError).toBe(false);
    expect(ms).toBeLessThan(1500 * factor);
  }, 120_000);

  it('SC-003: warm query_graph, get_node, find_path < 200 ms each (median of 5)', async () => {
    const { root } = await speckitDataset(500, 1000, 50, { links: true });
    const { call } = await connect(root, big);
    const queryMs = await median(5, async () => expect((await call('query_graph', { question: 'retry timeout' })).isError).toBe(false));
    const nodeMs = await median(5, async () => expect((await call('get_node', { ref: 'decision:0001' })).isError).toBe(false));
    const pathRes = await call('find_path', { from: 'decision:0001', to: 'decision:0002' });
    expect(pathRes.data.hops).not.toBeNull();
    const pathMs = await median(5, () => call('find_path', { from: 'decision:0001', to: 'decision:0002' }));
    console.error(`[perf] warm query_graph=${queryMs.toFixed(1)}ms get_node=${nodeMs.toFixed(1)}ms find_path=${pathMs.toFixed(1)}ms`);
    expect(queryMs).toBeLessThan(200 * factor);
    expect(nodeMs).toBeLessThan(200 * factor);
    expect(pathMs).toBeLessThan(200 * factor);
  }, 180_000);

  it('SC-003: first query_graph of a new instance with a snapshot < 600 ms', async () => {
    const { root } = await speckitDataset(500, 1000, 50, { links: true });
    const first = await connect(root, big);
    await first.call('query_graph', { question: 'retry timeout' });
    resetGraphCache();
    const second = await connect(root, big);
    const { ms, value } = await timed(() => second.call('query_graph', { question: 'retry timeout' }));
    console.error(`[perf] first query_graph with snapshot=${ms.toFixed(1)}ms`);
    expect(value.isError).toBe(false);
    expect(ms).toBeLessThan(600 * factor);
  }, 180_000);

  it('SC-003: first graph_report < 1.5 s, repeated < 300 ms', async () => {
    const { root } = await speckitDataset(500, 1000, 50, { links: true });
    const { call } = await connect(root, big);
    const { ms: firstMs, value } = await timed(() => call('graph_report', {}));
    expect(value.isError).toBe(false);
    const repeatMs = await median(5, () => call('graph_report', {}));
    console.error(`[perf] graph_report first=${firstMs.toFixed(1)}ms repeated=${repeatMs.toFixed(1)}ms`);
    expect(firstMs).toBeLessThan(1500 * factor);
    expect(repeatMs).toBeLessThan(300 * factor);
  }, 180_000);
});
