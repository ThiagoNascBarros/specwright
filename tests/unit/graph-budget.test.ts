import { describe, it, expect } from 'vitest';
import { fitToBudget } from '../../src/graph/budget.js';

describe('fitToBudget', () => {
  it('US1-AS4: a 200-token budget keeps every seed, reports omitted counts and needed_budget_tokens, and used_tokens ≤ budget', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => ({ id: `note:n${i}`, value: { id: `note:n${i}`, text: 'x'.repeat(100) } }));
    const r = fitToBudget({ envelope: { question: 'q' }, nodes, edges: [], pinned: 3, budgetTokens: 200 });
    expect(r.nodes.length).toBeGreaterThanOrEqual(3);
    expect(r.nodes.slice(0, 3)).toEqual(nodes.slice(0, 3).map((n) => n.value));
    expect(r.omitted.nodes).toBeGreaterThan(0);
    expect(r.omitted.nodes).toBe(20 - r.nodes.length);
    expect(r.neededTokens).toBeGreaterThan(200);
    expect(r.usedTokens).toBeLessThanOrEqual(200);
  });

  it('FR-027: estimate = ceil(JSON chars / 4)', () => {
    const r = fitToBudget({
      envelope: { question: 'q' },
      nodes: [{ id: 'a', value: { x: 1 } }],
      edges: [{ endpoints: ['a', 'a'], value: ['a', 'uses', 'a'] }],
      pinned: 1,
      budgetTokens: 10000,
    });
    const full = JSON.stringify({ question: 'q', nodes: [{ x: 1 }], edges: [['a', 'uses', 'a']] });
    expect(r.usedTokens).toBe(Math.ceil(full.length / 4));
    expect(r.neededTokens).toBe(Math.ceil(full.length / 4));
    expect(r.omitted).toEqual({ nodes: 0, edges: 0 });
  });
});
