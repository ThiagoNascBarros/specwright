import { degree } from './graph.js';
import { nodeId } from './ids.js';
import type { Graph } from './types.js';

export type Community = { id: number; label: string; members: string[] };
export type Communities = { byNode: Map<string, number>; list: Community[] };

/** Weighted undirected adjacency over the nodes' sorted index. `loop` is the internal weight of a supernode. */
export interface Level { adj: Map<number, number>[]; loop: number[] }

const EPS = 1e-10;
const MAX_SWEEPS = 50;
const MAX_LEVELS = 10;
const LABEL_MAX = 80;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sum = (values: Iterable<number>): number => { let total = 0; for (const v of values) total += v; return total; };

/** Deterministic communities (plan.md "Community detection and analysis", research §5). Pure: same graph, same result. */
export function detectCommunities(graph: Graph): Communities {
  const ids = [...graph.nodes.keys()].sort(cmp);
  const index = new Map(ids.map((id, i) => [id, i]));
  const adj = ids.map(() => new Map<number, number>());
  for (const e of graph.edges) {
    const a = index.get(e.source)!;
    const b = index.get(e.target)!;
    if (e.confidence === 'AMBIGUOUS' || a === b) continue;
    adj[a].set(b, (adj[a].get(b) ?? 0) + e.score);
    adj[b].set(a, (adj[b].get(a) ?? 0) + e.score);
  }
  const base: Level = { adj, loop: ids.map(() => 0) };
  const groups = split(base, louvain(base), ids);

  groups.sort((x, y) => y.length - x.length || cmp(x[0], y[0]));
  const byNode = new Map<string, number>();
  const list = groups.map((members, id) => {
    for (const m of members) byNode.set(m, id);
    return { id, label: labelOf(graph, members), members };
  });
  return { byNode, list };
}

/** Louvain with the fixed visiting order and tie rules; returns each base node's final community label. */
function louvain(base: Level): number[] {
  let level = base;
  let membership = base.adj.map((_, i) => i);
  for (let depth = 0; depth < MAX_LEVELS; depth++) {
    const { labels, count } = localMoving(level);
    if (count === level.adj.length) break;
    membership = membership.map((s) => labels[s]);
    level = aggregate(level, labels, count);
  }
  return membership;
}

/** Visits nodes in index order and moves each to the best neighbouring community (lowest index on ties). Returns relabelled communities. */
function localMoving(level: Level): { labels: number[]; count: number } {
  const n = level.adj.length;
  const deg = level.adj.map((m, i) => sum(m.values()) + 2 * level.loop[i]);
  const m = sum(deg) / 2;
  const comm = level.adj.map((_, i) => i);
  if (m === 0) return relabel(comm);
  const tot = deg.slice();
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      const own = comm[i];
      const weightTo = new Map<number, number>();
      for (const [j, w] of level.adj[i]) weightTo.set(comm[j], (weightTo.get(comm[j]) ?? 0) + w);
      tot[own] -= deg[i];
      const gain = (c: number): number => (weightTo.get(c) ?? 0) / m - (tot[c] * deg[i]) / (2 * m * m);
      let best = own;
      let bestGain = gain(own);
      for (const c of [...weightTo.keys()].sort((x, y) => x - y)) {
        const g = gain(c);
        if (c !== own && g > bestGain + EPS) { best = c; bestGain = g; }
      }
      tot[best] += deg[i];
      if (best !== own) { comm[i] = best; moved = true; }
    }
    if (!moved) break;
  }
  return relabel(comm);
}

/** Community labels renumbered 0.. by first appearance, so each label is its smallest member's rank. */
function relabel(comm: number[]): { labels: number[]; count: number } {
  const map = new Map<number, number>();
  const labels = comm.map((c) => { if (!map.has(c)) map.set(c, map.size); return map.get(c)!; });
  return { labels, count: map.size };
}

/** Collapses each community into one supernode; internal weight becomes the supernode's loop. */
function aggregate(level: Level, labels: number[], count: number): Level {
  const adj = Array.from({ length: count }, () => new Map<number, number>());
  const loop: number[] = Array.from({ length: count }, () => 0);
  level.adj.forEach((nbrs, i) => {
    const a = labels[i];
    loop[a] += level.loop[i];
    for (const [j, w] of nbrs) {
      const b = labels[j];
      if (a !== b) adj[a].set(b, (adj[a].get(b) ?? 0) + w);
      else if (i < j) loop[a] += w;
    }
  });
  return { adj, loop };
}

/** Each community is split into its connected components over the base graph (Louvain can join unconnected parts). */
export function split(base: Level, comm: number[], ids: string[]): string[][] {
  const part = comm.map(() => -1);
  let next = 0;
  for (let s = 0; s < comm.length; s++) {
    if (part[s] >= 0) continue;
    part[s] = next;
    const stack = [s];
    while (stack.length) {
      const i = stack.pop()!;
      for (const j of base.adj[i].keys()) if (part[j] < 0 && comm[j] === comm[i]) { part[j] = next; stack.push(j); }
    }
    next++;
  }
  const groups: string[][] = Array.from({ length: next }, () => []);
  part.forEach((p, i) => groups[p].push(ids[i]));
  return groups;
}

/** Label: top-degree non-file member (ties by id), prefixed with the feature title when one feature owns more than half of the members. */
function labelOf(graph: Graph, members: string[]): string {
  const nodes = members.map((id) => graph.nodes.get(id)!);
  const pool = nodes.some((n) => n.kind !== 'file') ? nodes.filter((n) => n.kind !== 'file') : nodes;
  let top = pool[0];
  let topDegree = degree(graph, top.id, { ignore: ['contains', 'belongs_to'] });
  for (const n of pool.slice(1)) {
    const d = degree(graph, n.id, { ignore: ['contains', 'belongs_to'] });
    if (d > topDegree) { top = n; topDegree = d; }
  }
  const counts = new Map<string, number>();
  for (const n of nodes) if (n.feature) counts.set(n.feature, (counts.get(n.feature) ?? 0) + 1);
  const owner = [...counts].find(([, c]) => c * 2 > members.length)?.[0];
  const title = owner ? graph.nodes.get(nodeId.feature(owner))?.label ?? owner : undefined;
  return (title ? `${title}: ${top.label}` : top.label).slice(0, LABEL_MAX);
}
