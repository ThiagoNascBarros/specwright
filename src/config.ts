import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isSafeRelativeDir } from './storage/paths.js';

export const GRAPH_CACHE_MODES = ['disk', 'memory', 'off'] as const;

export interface GraphConfig {
  /** Extra folders (relative to the root) whose `.md` files become `doc` nodes. */
  include: string[];
  cache: (typeof GRAPH_CACHE_MODES)[number];
  /** Where the Obsidian vault is written, relative to the root. */
  vaultDir: string;
}

export interface Config {
  /** Absolute path of the project root (SPECWRIGHT_ROOT); specs/ and .specify/ live below it. */
  root: string;
  maxResponseChars: number;
  graph: GraphConfig;
}

export const DEFAULT_MAX_RESPONSE_CHARS = 20000;
export const CONFIG_FILE = '.specify/specwright.json';
const GRAPH_DIR = '.specify/graph';
export const DEFAULT_GRAPH_CONFIG: GraphConfig = { include: [], cache: 'disk', vaultDir: `${GRAPH_DIR}/vault` };
const GRAPH_INCLUDE_MAX = 20;

function parseGraph(value: unknown, file: string): GraphConfig {
  const invalid = (message: string) => new Error(`Invalid ${file}: ${message}`);
  if (value === undefined) return { ...DEFAULT_GRAPH_CONFIG, include: [] };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid('graph must be an object');
  const { include = [], cache = DEFAULT_GRAPH_CONFIG.cache, vaultDir = DEFAULT_GRAPH_CONFIG.vaultDir } = value as Record<string, unknown>;
  if (!Array.isArray(include) || include.length > GRAPH_INCLUDE_MAX) {
    throw invalid(`graph.include must be an array of at most ${GRAPH_INCLUDE_MAX} folders`);
  }
  const folders = include.map((dir) => {
    if (typeof dir !== 'string' || !isSafeRelativeDir(dir)) throw invalid(`graph.include has an unsafe folder: ${String(dir)}`);
    return dir.replace(/\/+$/, '');
  });
  if (!(GRAPH_CACHE_MODES as readonly unknown[]).includes(cache)) {
    throw invalid(`graph.cache must be one of ${GRAPH_CACHE_MODES.join(', ')}`);
  }
  const underGraphDir = (dir: string) => dir === GRAPH_DIR
    || (dir.startsWith(`${GRAPH_DIR}/`) && dir.slice(GRAPH_DIR.length + 1).split('/').every((s) => s !== '' && s !== '.' && s !== '..' && !s.includes('\\')));
  if (typeof vaultDir !== 'string' || !(underGraphDir(vaultDir) || isSafeRelativeDir(vaultDir))) {
    throw invalid('graph.vaultDir must be under .specify/graph or a safe folder outside specs/');
  }
  return { include: folders, cache: cache as GraphConfig['cache'], vaultDir };
}

export function loadConfig(env: Record<string, string | undefined>, cwd: string): Config {
  const root = resolve(cwd, env.SPECWRIGHT_ROOT || '.');
  const file = join(root, CONFIG_FILE);
  let maxResponseChars = DEFAULT_MAX_RESPONSE_CHARS;
  let graph = parseGraph(undefined, file);
  if (existsSync(file)) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`Invalid ${file}: ${(error as Error).message}`);
    }
    const value = (raw as { maxResponseChars?: unknown } | null)?.maxResponseChars;
    if (value !== undefined) {
      if (!Number.isInteger(value) || (value as number) < 100) {
        throw new Error(`Invalid ${file}: maxResponseChars must be an integer >= 100`);
      }
      maxResponseChars = value as number;
    }
    graph = parseGraph((raw as { graph?: unknown } | null)?.graph, file);
  }
  return { root, maxResponseChars, graph };
}
