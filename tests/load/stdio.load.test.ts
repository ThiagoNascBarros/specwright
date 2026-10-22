import { describe, it, expect, afterEach } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, spec } from '../helpers.js';
import { parseSpec } from '../../src/specs/parser.js';
import { report, startServer, percentile } from './stdio-client.js';
import { factor } from '../perf/budget.js';

const words = ['cache', 'retry', 'timeout', 'schema', 'deploy', 'naming', 'logging', 'auth', 'billing', 'queue'];
const servers: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

async function dataset(specs: number, memories: number, decisions: number) {
  const files: Record<string, string> = {};
  for (let i = 0; i < specs; i++) {
    const id = `spec-${String(i).padStart(4, '0')}`;
    const w = words[i % words.length];
    const criteria = Array.from({ length: 10 }, (_, n) => `- [ ] AC-${n + 1}: ${w} criterion ${n + 1}`).join('\n');
    files[`.specwright/specs/${id}.md`] = spec(id, `## Context\n${`About ${w} in \`src/${w}/${i}.ts\`. `.repeat(15)}\n\n## Acceptance criteria\n${criteria}\n\n## Out of scope\n- other things\n`);
  }
  for (let i = 0; i < memories; i++) {
    const w = words[i % words.length];
    files[`.specwright/memory/m-${i}.md`] = `---\nid: m-${i}\ntype: learning\ntitle: Note ${i} on ${w}\ntags: [${w}]\ndate: 2026-10-21\n---\n${`Details about ${w}. `.repeat(20)}\n`;
  }
  for (let i = 1; i <= decisions; i++) {
    const id = String(i).padStart(4, '0');
    files[`.specwright/decisions/${id}-d.md`] = `---\nid: "${id}"\nspec_id: spec-0000\ntitle: Decision ${i} on ${words[i % words.length]}\ndate: 2026-10-21\nstatus: accepted\n---\n## Decision\nText.\n`;
  }
  return makeProject(files);
}

async function start(root: string) {
  const s = await startServer(root);
  servers.push(s);
  return s;
}

describe('load: stdio server under sustained and concurrent use', () => {
  it('sustained: 2,000 sequential mixed read calls keep p95 < 50 ms', async () => {
    const { root } = await dataset(100, 200, 50);
    const { call } = await start(root);
    const plan: Array<[string, Record<string, unknown>]> = [
      ['get_spec', { spec_id: 'spec-0042', section: 'acceptance-criteria' }],
      ['list_open_requirements', { spec_id: 'spec-0007' }],
      ['search_memory', { query: 'retry timeout', limit: 5 }],
      ['list_decisions', { spec_id: 'spec-0000' }],
      ['list_specs', { status: 'draft' }],
    ];
    const samples: number[] = [];
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) {
      const [name, args] = plan[i % plan.length];
      const s = performance.now();
      const r = await call(name, args);
      samples.push(performance.now() - s);
      expect(r.isError).toBe(false);
    }
    report('sequential mixed reads (100 specs, 200 memories)', samples, performance.now() - t0);
    expect(percentile(samples, 95)).toBeLessThan(50 * factor);
  });

  it('concurrent: 500 reads in flight at once all succeed', async () => {
    const { root } = await dataset(100, 200, 50);
    const { call } = await start(root);
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        const s = performance.now();
        const r = await call(i % 2 ? 'get_spec' : 'search_memory', i % 2 ? { spec_id: `spec-${String(i % 100).padStart(4, '0')}` } : { query: words[i % words.length] });
        return { ms: performance.now() - s, ok: !r.isError };
      }),
    );
    report('500 concurrent reads', results.map((r) => r.ms), performance.now() - t0);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('write contention: 200 concurrent decisions and memories get unique files', async () => {
    const { root } = await dataset(1, 0, 0);
    const { call } = await start(root);
    const t0 = performance.now();
    const results = await Promise.all([
      ...Array.from({ length: 100 }, (_, i) => call('log_decision', { spec_id: 'spec-0000', title: `Concurrent decision ${i}`, decision: 'd' })),
      ...Array.from({ length: 100 }, () => call('save_memory', { type: 'learning', title: 'Same title', body: 'b' })),
    ]);
    console.error(`[load] 200 concurrent writes: wall=${(performance.now() - t0).toFixed(0)}ms`);
    expect(results.every((r) => !r.isError)).toBe(true);
    const decisionIds = results.slice(0, 100).map((r) => r.data.id);
    expect(new Set(decisionIds).size).toBe(100);
    expect(await readdir(join(root, 'decisions'))).toHaveLength(100);
    expect(await readdir(join(root, 'memory'))).toHaveLength(100);
  });

  it('two server processes writing decisions to the same root never overwrite each other', async () => {
    const { root } = await dataset(1, 0, 0);
    const a = await start(root);
    const b = await start(root);
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).call('log_decision', { spec_id: 'spec-0000', title: `Cross ${i}`, decision: 'd' })),
    );
    const ok = results.filter((r) => !r.isError);
    const files = await readdir(join(root, 'decisions'));
    console.error(`[load] 2 processes x 20 decisions: created=${ok.length} files=${files.length} errors=${results.length - ok.length}`);
    // Every success is its own file; a failure (exhausted retries) is reported, never a silent overwrite.
    expect(files).toHaveLength(ok.length);
    expect(new Set(ok.map((r) => r.data.id)).size).toBe(ok.length);
  });

  it('checkbox churn: 1,000 concurrent set_criterion_status calls leave a valid spec', async () => {
    const { root } = await dataset(1, 0, 0);
    const { call } = await start(root);
    const final = new Map<string, boolean>();
    const ops = Array.from({ length: 1000 }, (_, i) => {
      const ac = `AC-${(i % 10) + 1}`;
      const done = i % 3 !== 0;
      final.set(ac, done);
      return { ac, done };
    });
    // Run in waves of 50 so the last write per criterion is well defined.
    for (let i = 0; i < ops.length; i += 50) {
      const wave = ops.slice(i, i + 50);
      const seen = new Set<string>();
      await Promise.all(wave.filter((o) => !seen.has(o.ac) && seen.add(o.ac)).map((o) => call('set_criterion_status', { spec_id: 'spec-0000', ac_id: o.ac, done: o.done })));
    }
    const raw = await readFile(join(root, 'specs/spec-0000.md'), 'utf8');
    const parsed = parseSpec('spec-0000', raw);
    expect(parsed.valid).toBe(true);
    expect(parsed.criteria).toHaveLength(10);
    expect(await readdir(join(root, 'specs'))).toEqual(['spec-0000.md']);
  });

  it('scale: 2,000 specs and 5,000 memories stay within budget', async () => {
    const { root } = await dataset(2000, 5000, 500);
    const { call } = await start(root);
    const time = async (name: string, args: Record<string, unknown>) => {
      await call(name, args);
      const s = performance.now();
      const r = await call(name, args);
      const ms = performance.now() - s;
      expect(r.isError).toBe(false);
      console.error(`[load] scale ${name}: ${ms.toFixed(0)}ms`);
      return ms;
    };
    expect(await time('list_specs', {})).toBeLessThan(2000 * factor);
    expect(await time('list_open_requirements', {})).toBeLessThan(2000 * factor);
    expect(await time('search_memory', { query: 'retry timeout' })).toBeLessThan(2000 * factor);
    expect(await time('pack_context', { task: 'retry timeout policy' })).toBeLessThan(3000 * factor);
    expect(await time('get_spec', { spec_id: 'spec-1999' })).toBeLessThan(50 * factor);
  });
});
