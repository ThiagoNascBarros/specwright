import { describe, it, expect } from 'vitest';
import { respond } from '../../src/errors.js';

describe('response truncation', () => {
  it('keeps listings under the limit and flags truncated', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ id: `item-${i}`, text: 'x'.repeat(20) }));
    const text = respond({ open: items }, 2000).content[0].text;
    const data = JSON.parse(text);
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(data.truncated).toBe(true);
    expect(data.open.length).toBeGreaterThan(0);
    expect(data.open[0].id).toBe('item-0');
  });

  it('keeps as many items as fit (no needless dropping)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ i }));
    const data = JSON.parse(respond({ open: items }, 300).content[0].text);
    const withOneMore = JSON.stringify({ open: items.slice(0, data.open.length + 1), truncated: true }).length;
    expect(withOneMore).toBeGreaterThan(300);
  });

  it('truncates 20,000 items in linear time', () => {
    const items = Array.from({ length: 20_000 }, (_, i) => ({ spec_id: `spec-${i}`, ac_id: 'AC-1', text: 'criterion text here' }));
    const start = performance.now();
    respond({ open: items }, 20_000);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
