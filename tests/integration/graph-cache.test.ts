import { describe, it, expect, afterEach } from 'vitest';
import { readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture } from '../helpers.js';
import { DEFAULT_GRAPH_CONFIG, type Config } from '../../src/config.js';
import { cacheStats, loadGraph, resetGraphCache } from '../../src/graph/service.js';
import type { Graph } from '../../src/graph/types.js';

afterEach(() => resetGraphCache());
const cfg = (root: string, cache: Config['graph']['cache'] = 'disk'): Config => ({ root, maxResponseChars: 20000, graph: { ...DEFAULT_GRAPH_CONFIG, cache } });
const json = (g: Graph) => JSON.stringify({ nodes: [...g.nodes.values()], edges: g.edges, diagnostics: g.diagnostics });
const CACHE = '.specify/graph/cache.json';
const exists = (p: string) => stat(p).then(() => true, () => false);

describe('graph cache', () => {
  it('FR-006 / US5-AS1: after editing one note, adding one decision and deleting one note, the next loadGraph parses exactly 2 files (cacheStats) and its nodes/edges/diagnostics JSON equals a cache:"off" build', async () => {
    const { root } = await copyFixture('brain');
    const first = await loadGraph(cfg(root));
    expect(cacheStats(root).parsed).toBe(11);
    const note = join(root, '.specify/memory/notes/sorting-pitfall.md');
    await writeFile(note, `${await readFile(note, 'utf8')}\nMore about 002-sharing.\n`);
    await utimes(note, new Date(), new Date(Date.now() + 5000));
    await writeFile(join(root, '.specify/memory/decisions/0003-new.md'), '# 0003. New\n\n**Status**: Accepted\n\nSee 001-photo-albums.\n');
    await rm(join(root, '.specify/memory/notes/keep-ids-stable.md'));
    const next = await loadGraph(cfg(root));
    expect(cacheStats(root)).toEqual({ parsed: 2, reused: 9 });
    expect(next.version).toBeGreaterThan(first.version);
    resetGraphCache();
    expect(json(next)).toBe(json(await loadGraph(cfg(root, 'off'))));
  });

  it('FR-007 / US5-AS2: a second process, simulated by resetGraphCache with the snapshot on disk, reuses every unchanged file (parsed 0)', async () => {
    const { root } = await copyFixture('brain');
    const a = await loadGraph(cfg(root));
    resetGraphCache();
    const b = await loadGraph(cfg(root));
    expect(cacheStats(root)).toEqual({ parsed: 0, reused: 11 });
    expect(json(b)).toBe(json(a));
  });

  it('FR-007: a corrupt cache.json or schema 0 is ignored and rewritten', async () => {
    const { root } = await copyFixture('brain');
    for (const bad of ['{corrupt', JSON.stringify({ schema: 0, extractor: 1, files: {} })]) {
      await loadGraph(cfg(root));
      resetGraphCache();
      await writeFile(join(root, CACHE), bad);
      await loadGraph(cfg(root));
      expect(cacheStats(root).parsed).toBe(11);
      expect(JSON.parse(await readFile(join(root, CACHE), 'utf8')).schema).toBe(1);
      resetGraphCache();
    }
  });

  it('US5-AS3: cache "off" never reads or writes .specify/graph/cache.json', async () => {
    const { root } = await copyFixture('brain');
    const g = await loadGraph(cfg(root, 'off'));
    expect(g.nodes.size).toBeGreaterThan(0);
    expect(await exists(join(root, CACHE))).toBe(false);
    await loadGraph(cfg(root));
    resetGraphCache();
    await loadGraph(cfg(root, 'off'));
    expect(cacheStats(root)).toEqual({ parsed: 11, reused: 0 });
    await loadGraph(cfg(root, 'off'));
    expect(cacheStats(root)).toEqual({ parsed: 11, reused: 0 });
  });

  it('FR-008: the first snapshot write creates .specify/graph/.gitignore containing "*", and an existing .gitignore is never overwritten', async () => {
    const { root } = await copyFixture('brain');
    await loadGraph(cfg(root));
    expect(await readFile(join(root, '.specify/graph/.gitignore'), 'utf8')).toBe('*\n');
    await writeFile(join(root, '.specify/graph/.gitignore'), 'mine\n');
    await rm(join(root, CACHE));
    resetGraphCache();
    await loadGraph(cfg(root));
    expect(await exists(join(root, CACHE))).toBe(true);
    expect(await readFile(join(root, '.specify/graph/.gitignore'), 'utf8')).toBe('mine\n');
  });

  it('FR-006: 20 concurrent loadGraph calls share one refresh', async () => {
    const { root } = await copyFixture('brain');
    const graphs = await Promise.all(Array.from({ length: 20 }, () => loadGraph(cfg(root))));
    expect(graphs[0].nodes.size).toBeGreaterThan(0);
    expect(new Set(graphs).size).toBe(1);
    expect(cacheStats(root)).toEqual({ parsed: 11, reused: 0 });
  });
});
