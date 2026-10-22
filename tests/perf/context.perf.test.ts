import { describe, it, expect } from 'vitest';
import { connect } from '../helpers.js';
import { factor, median } from './budget.js';
import { speckitDataset } from './dataset.js';

describe('context: performance', () => {
  it('pack_context with 500 features and 1,000 notes < 1 s', async () => {
    const { root } = await speckitDataset(500, 1000);
    const { call } = await connect(root);
    const ms = await median(3, async () => expect((await call('pack_context', { task: 'retry timeout policy' })).data.items.length).toBeGreaterThan(0));
    console.error(`[perf] pack_context(500 features + 1000 notes) median=${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000 * factor);
  }, 120_000);
});
