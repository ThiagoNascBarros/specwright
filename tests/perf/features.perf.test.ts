import { describe, it, expect } from 'vitest';
import { connect } from '../helpers.js';
import { factor, median } from './budget.js';
import { speckitDataset } from './dataset.js';

describe('SC-003: performance with 500 Spec Kit features', () => {
  it('SC-003: list_features and list_open_tasks < 500 ms, get_artifact section < 200 ms', async () => {
    const { root } = await speckitDataset(500);
    const { call } = await connect(root, { maxResponseChars: 5_000_000 });
    const listMs = await median(5, async () => expect((await call('list_features')).data.features).toHaveLength(500));
    const tasksMs = await median(5, async () => expect((await call('list_open_tasks')).data.open).toHaveLength(2500));
    const getMs = await median(5, () => call('get_artifact', { feature: '0250-feature-249', artifact: 'spec', section: 'Requirements' }));
    console.error(`[perf] list_features(500)=${listMs.toFixed(1)}ms list_open_tasks=${tasksMs.toFixed(1)}ms get_artifact=${getMs.toFixed(1)}ms`);
    expect(listMs).toBeLessThan(500 * factor);
    expect(tasksMs).toBeLessThan(500 * factor);
    expect(getMs).toBeLessThan(200 * factor);
  }, 120_000);
});
