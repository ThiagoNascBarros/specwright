import { describe, it, expect } from 'vitest';
import { mapLimit } from '../../src/storage/concurrency.js';

describe('bounded concurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit(Array.from({ length: 100 }, (_, i) => i), 7, async (i) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return i * 2;
    });
    expect(out).toEqual(Array.from({ length: 100 }, (_, i) => i * 2));
    expect(peak).toBe(7);
  });

  it('handles an empty list', async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });
});
