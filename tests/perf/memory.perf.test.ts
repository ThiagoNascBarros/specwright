import { describe, it, expect } from 'vitest';
import { connect } from '../helpers.js';
import { factor, median } from './budget.js';
import { speckitDataset } from './dataset.js';

describe('memory: performance', () => {
  it('search over 1,000 notes and 200 decisions < 300 ms', async () => {
    const { root } = await speckitDataset(1, 1000, 200);
    const { call } = await connect(root);
    const ms = await median(5, async () => expect((await call('search_memory', { query: 'retry timeout' })).data.results.length).toBeGreaterThan(0));
    console.error(`[perf] search_memory(1000+200) median=${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(300 * factor);
  }, 60_000);
});
