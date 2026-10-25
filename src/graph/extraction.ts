import { scopeOfNode } from './ids.js';
import { EXTRACTOR_VERSION } from './types.js';
import type { Graph, GraphNode, Unit } from './types.js';

export type Batch = { batch: number; scope: string; tokens: number; units: string[] };

// Node kinds offered as candidates for their scope, in the order FR-013 gives.
const CANDIDATE_KINDS: readonly GraphNode['kind'][] = ['feature', 'story', 'requirement', 'criterion', 'task', 'decision', 'artifact'];

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Units without a coverage row for their current hash and extractor version, in plan order (scope, project last; path; file order). */
export function pendingUnits(graph: Graph, feature?: string): Unit[] {
  const pending = [...graph.units.values()].filter((u) => {
    const row = graph.coverage.get(u.id);
    const covered = row !== undefined && row.hash === u.hash && row.version === EXTRACTOR_VERSION;
    return !covered && (feature === undefined || u.scope === feature);
  });
  return pending.sort((a, b) =>
    Number(a.scope === 'project') - Number(b.scope === 'project') || cmp(a.scope, b.scope) || cmp(a.path, b.path));
}

/** Greedy packing in the given order: a new batch when the scope changes or the budget would be exceeded. */
export function planBatches(units: Unit[], budget: number, limit: number): Batch[] {
  const batches: Batch[] = [];
  let current: Batch | undefined;
  for (const u of units) {
    if (!current || current.scope !== u.scope || current.tokens + u.tokens > budget) {
      current = { batch: batches.length + 1, scope: u.scope, tokens: 0, units: [] };
      batches.push(current);
    }
    current.tokens += u.tokens;
    current.units.push(u.id);
  }
  return batches.slice(0, limit);
}

/** Candidate node ids for the units' scopes, then concepts and principles, deduplicated, labels cut to 60 characters. */
export function candidatesFor(graph: Graph, units: Unit[], max = 60): Array<[string, string]> {
  const scopes = new Set(units.map((u) => u.scope));
  const nodes = [...graph.nodes.values()];
  const rank = (n: GraphNode): number => CANDIDATE_KINDS.indexOf(n.kind);
  const scoped = nodes
    .filter((n) => rank(n) >= 0 && scopes.has(scopeOfNode(n)))
    .sort((a, b) => rank(a) - rank(b) || cmp(a.id, b.id));
  const byLabel = (a: GraphNode, b: GraphNode): number => cmp(a.label, b.label) || cmp(a.id, b.id);
  const ordered = [
    ...scoped,
    ...nodes.filter((n) => n.kind === 'concept').sort(byLabel),
    ...nodes.filter((n) => n.kind === 'principle').sort(byLabel),
  ];
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  for (const n of ordered) {
    if (out.length >= max) break;
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push([n.id, n.label.slice(0, 60)]);
  }
  return out;
}
