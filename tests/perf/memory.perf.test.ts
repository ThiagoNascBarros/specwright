import { describe, it, expect } from 'vitest';
import { makeProject, connect, spec } from '../helpers.js';
import { factor, median } from './budget.js';

const words = ['cache', 'retry', 'timeout', 'schema', 'deploy', 'naming', 'logging', 'auth', 'billing', 'queue'];

describe('memory: performance', () => {
  it('AC-11: search over 1,000 memories and 200 decisions < 300 ms', async () => {
    const files: Record<string, string> = { '.specwright/specs/auth.md': spec('auth') };
    for (let i = 0; i < 1000; i++) {
      const w = words[i % words.length];
      files[`.specwright/memory/m-${i}.md`] = `---\nid: m-${i}\ntype: learning\ntitle: Note ${i} about ${w}\ntags: [${w}]\ndate: 2026-10-21\n---\n${`Details about ${w} and more text. `.repeat(20)}\n`;
    }
    for (let i = 1; i <= 200; i++) {
      const id = String(i).padStart(4, '0');
      files[`.specwright/decisions/${id}-d.md`] = `---\nid: "${id}"\nspec_id: auth\ntitle: Decision ${i} on ${words[i % words.length]}\ndate: 2026-10-21\nstatus: accepted\n---\n## Decision\nText.\n`;
    }
    const { root } = await makeProject(files);
    const { call } = await connect(root);
    const ms = await median(5, async () => expect((await call('search_memory', { query: 'retry timeout' })).data.results.length).toBeGreaterThan(0));
    console.error(`[perf] search_memory(1000+200) median=${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(300 * factor);
  }, 60_000);
});
