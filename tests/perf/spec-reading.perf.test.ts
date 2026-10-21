import { describe, it, expect } from 'vitest';
import { makeProject, connect, spec } from '../helpers.js';
import { factor, median } from './budget.js';

function bigProject(count: number) {
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const id = `spec-${String(i).padStart(4, '0')}`;
    const criteria = Array.from({ length: 10 }, (_, n) => `- [${n % 2 ? 'x' : ' '}] AC-${n + 1}: criterion ${n + 1}`).join('\n');
    files[`.specwright/specs/${id}.md`] = spec(id, `## Context\n${'Lorem ipsum dolor sit amet. '.repeat(40)}\n\n## Acceptance criteria\n${criteria}\n\n## Out of scope\n- nothing\n`);
  }
  return makeProject(files);
}

describe('spec-reading: performance (NFR-7)', () => {
  it('AC-14: list_specs < 500 ms and get_spec < 200 ms with 500 specs', async () => {
    const { root } = await bigProject(500);
    const { call } = await connect(root, { maxResponseChars: 1_000_000 });
    const listMs = await median(5, async () => expect((await call('list_specs')).data.specs).toHaveLength(500));
    const getMs = await median(5, () => call('get_spec', { spec_id: 'spec-0250', section: 'acceptance-criteria' }));
    console.error(`[perf] list_specs(500) median=${listMs.toFixed(1)}ms get_spec median=${getMs.toFixed(1)}ms`);
    expect(listMs).toBeLessThan(500 * factor);
    expect(getMs).toBeLessThan(200 * factor);
  }, 60_000);
});
