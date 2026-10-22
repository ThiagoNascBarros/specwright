import { describe, it, expect } from 'vitest';
import { makeProject, connect, spec } from '../helpers.js';
import { factor, median } from './budget.js';

const words = ['cache', 'retry', 'timeout', 'schema', 'deploy', 'naming', 'logging', 'auth', 'billing', 'queue'];

describe('context-pack: performance', () => {
  it('AC-10: pack_context with 500 specs and 1,000 memories < 1 s', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      const id = `spec-${i}`;
      const w = words[i % words.length];
      files[`.specwright/specs/${id}.md`] = spec(id, `## Context\n${`About ${w} in \`src/${w}/${i}.ts\`. `.repeat(20)}\n\n## Acceptance criteria\n- [ ] AC-1: ${w} works\n`);
    }
    for (let i = 0; i < 1000; i++) {
      const w = words[i % words.length];
      files[`.specwright/memory/m-${i}.md`] = `---\nid: m-${i}\ntype: learning\ntitle: Note on ${w}\ntags: [${w}]\ndate: 2026-10-21\n---\n${`Details about ${w}. `.repeat(20)}\n`;
    }
    const { root } = await makeProject(files);
    const { call } = await connect(root);
    const ms = await median(3, async () => expect((await call('pack_context', { task: 'retry timeout policy' })).data.items.length).toBeGreaterThan(0));
    console.error(`[perf] pack_context(500 specs + 1000 memories) median=${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(1000 * factor);
  }, 60_000);
});
