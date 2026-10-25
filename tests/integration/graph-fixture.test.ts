import { describe, it, expect } from 'vitest';
import { copyFixture, connect } from '../helpers.js';

describe('graph fixture: brain', () => {
  it('fixture: brain lists 2 valid features without issues', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features.map((f: { id: string }) => f.id)).toEqual(['001-photo-albums', '002-sharing']);
    for (const f of data.features) {
      expect(f.valid).toBe(true);
      expect(f.issues ?? []).toEqual([]);
    }
  });
});
