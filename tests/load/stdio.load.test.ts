import { describe, it, expect, afterEach } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseTasks } from '../../src/features/tasks-parser.js';
import { report, startServer, percentile } from './stdio-client.js';
import { factor } from '../perf/budget.js';
import { speckitDataset as dataset, WORDS as words } from '../perf/dataset.js';

const servers: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

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
      ['get_artifact', { feature: '0042-feature-41', artifact: 'spec', section: 'Requirements' }],
      ['list_open_tasks', { feature: '0007-feature-6' }],
      ['search_memory', { query: 'retry timeout', limit: 5 }],
      ['list_decisions', { feature: '0001-feature-0' }],
      ['list_features', { status: 'Draft' }],
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
    report('sequential mixed reads (100 features, 200 notes)', samples, performance.now() - t0);
    expect(percentile(samples, 95)).toBeLessThan(50 * factor);
  });

  it('concurrent: 500 reads in flight at once all succeed', async () => {
    const { root } = await dataset(100, 200, 50);
    const { call } = await start(root);
    const t0 = performance.now();
    const results = await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        const s = performance.now();
        const n = i % 100;
        const r = await call(i % 2 ? 'get_artifact' : 'search_memory', i % 2 ? { feature: `${String(n + 1).padStart(4, '0')}-feature-${n}`, artifact: 'spec' } : { query: words[i % words.length] });
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
      ...Array.from({ length: 100 }, (_, i) => call('log_decision', { feature: '0001-feature-0', title: `Concurrent decision ${i}`, decision: 'd' })),
      ...Array.from({ length: 100 }, () => call('save_memory', { type: 'learning', title: 'Same title', body: 'b' })),
    ]);
    console.error(`[load] 200 concurrent writes: wall=${(performance.now() - t0).toFixed(0)}ms`);
    expect(results.every((r) => !r.isError)).toBe(true);
    const decisionIds = results.slice(0, 100).map((r) => r.data.id);
    expect(new Set(decisionIds).size).toBe(100);
    expect(await readdir(join(root, '.specify/memory/decisions'))).toHaveLength(100);
    expect(await readdir(join(root, '.specify/memory/notes'))).toHaveLength(100);
  });

  it('two server processes writing decisions to the same root never overwrite each other', async () => {
    const { root } = await dataset(1, 0, 0);
    const a = await start(root);
    const b = await start(root);
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).call('log_decision', { feature: '0001-feature-0', title: `Cross ${i}`, decision: 'd' })),
    );
    const ok = results.filter((r) => !r.isError);
    const files = await readdir(join(root, '.specify/memory/decisions'));
    console.error(`[load] 2 processes x 20 decisions: created=${ok.length} files=${files.length} errors=${results.length - ok.length}`);
    // Every success is its own file; a failure (exhausted retries) is reported, never a silent overwrite.
    expect(files).toHaveLength(ok.length);
    expect(new Set(ok.map((r) => r.data.id)).size).toBe(ok.length);
  });

  it('task churn: 1,000 set_task_status calls in waves leave a valid tasks.md', async () => {
    const { root } = await dataset(1, 0, 0);
    const { call } = await start(root);
    const ops = Array.from({ length: 1000 }, (_, i) => ({ id: `T${String((i % 10) + 1).padStart(3, '0')}`, done: i % 3 !== 0 }));
    // Waves of distinct tasks, so the last write per task is well defined.
    for (let i = 0; i < ops.length; i += 50) {
      const seen = new Set<string>();
      const wave = ops.slice(i, i + 50).filter((o) => !seen.has(o.id) && seen.add(o.id));
      const results = await Promise.all(wave.map((o) => call('set_task_status', { feature: '0001-feature-0', task_id: o.id, done: o.done })));
      expect(results.every((r) => !r.isError)).toBe(true);
    }
    const raw = await readFile(join(root, 'specs/0001-feature-0/tasks.md'), 'utf8');
    expect(parseTasks(raw).tasks).toHaveLength(10);
    expect(await readdir(join(root, 'specs/0001-feature-0'))).toEqual(['spec.md', 'tasks.md']);
  });

  it('scale: 2,000 features and 5,000 notes stay within budget', async () => {
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
    expect(await time('list_features', {})).toBeLessThan(2000 * factor);
    expect(await time('list_open_tasks', {})).toBeLessThan(2000 * factor);
    expect(await time('search_memory', { query: 'retry timeout' })).toBeLessThan(2000 * factor);
    expect(await time('pack_context', { task: 'retry timeout policy' })).toBeLessThan(3000 * factor);
    expect(await time('get_artifact', { feature: '2000-feature-1999', artifact: 'spec' })).toBeLessThan(50 * factor);
  });
});
