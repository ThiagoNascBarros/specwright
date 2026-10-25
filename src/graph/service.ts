import type { Config } from '../config.js';
import { buildGraph } from './build.js';
import { factsOf } from './facts.js';
import { discoverSources, readSnapshot, readSource, writeSnapshot } from './repository.js';
import type { Snapshot } from './repository.js';
import { EXTRACTOR_VERSION, SNAPSHOT_SCHEMA } from './types.js';
import type { FileFacts, Graph } from './types.js';

type Entry = { size: number; mtimeMs: number; facts: FileFacts };
interface CacheState { facts: Map<string, Entry>; loaded: boolean; version: number; graph?: Graph; inflight?: Promise<Graph>; stats: { parsed: number; reused: number } }

const states = new Map<string, CacheState>();
let loggedWriteFailure = false;

/** The project graph, refreshed incrementally from changed files (plan.md "Cache and refresh"). Concurrent calls share one refresh. */
export function loadGraph(config: Config): Promise<Graph> {
  let state = states.get(config.root);
  if (!state) states.set(config.root, (state = { facts: new Map(), loaded: false, version: 0, stats: { parsed: 0, reused: 0 } }));
  if (state.inflight) return state.inflight;
  const s = state;
  s.inflight = refresh(config, s).finally(() => { s.inflight = undefined; });
  return s.inflight;
}

async function refresh(config: Config, state: CacheState): Promise<Graph> {
  const { root, graph: { include, cache } } = config;
  const reuse = cache !== 'off';
  if (cache === 'disk' && !state.loaded) {
    state.loaded = true;
    const snap = await readSnapshot(root);
    if (snap) for (const [path, e] of Object.entries(snap.files)) state.facts.set(path, e);
  }
  const sources = await discoverSources(root, include);
  const next = new Map<string, Entry>();
  let parsed = 0;
  for (const src of sources) {
    const old = reuse ? state.facts.get(src.path) : undefined;
    if (old && old.size === src.size && old.mtimeMs === src.mtimeMs) next.set(src.path, old);
    else {
      next.set(src.path, { size: src.size, mtimeMs: src.mtimeMs, facts: factsOf(src, await readSource(root, src.path, include)) });
      parsed++;
    }
  }
  const changed = parsed > 0 || next.size !== state.facts.size || [...state.facts.keys()].some((p) => !next.has(p));
  state.facts = reuse ? next : new Map();
  state.stats = { parsed, reused: next.size - parsed };
  if (!changed && state.graph && reuse) return state.graph;
  state.graph = buildGraph([...next.values()].map((e) => e.facts), ++state.version);
  if (cache === 'disk' && changed) {
    const snapshot: Snapshot = { schema: SNAPSHOT_SCHEMA, extractor: EXTRACTOR_VERSION, files: Object.fromEntries(next) };
    try {
      await writeSnapshot(root, snapshot);
    } catch (error) {
      if (!loggedWriteFailure) console.error(`specwright: could not write the graph snapshot: ${(error as Error).message}`);
      loggedWriteFailure = true;
    }
  }
  return state.graph;
}

/** For tests: forget every root's in-memory state (simulates a new process). */
export function resetGraphCache(): void {
  states.clear();
}

/** For tests: parsed and reused file counts of the last refresh of `root`. */
export function cacheStats(root: string): { parsed: number; reused: number } {
  return { ...(states.get(root)?.stats ?? { parsed: 0, reused: 0 }) };
}
