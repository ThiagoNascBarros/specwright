import { incident } from '../graph/graph.js';
import type { Graph } from '../graph/types.js';
import { byRank } from './candidates.js';
import type { ContextItem } from './types.js';

const SEEDS = 3;
const BOOST = 0.5;

/** Graph node ids an item stands for (plan.md "Changes to existing tools" › pack_context, step 1). */
function nodeIdsOf(item: ContextItem, graph: Graph): string[] {
  const { ref } = item;
  let ids: string[];
  switch (item.kind) {
    case 'task': { const [feature, task] = ref.split('/tasks.md#'); ids = [`task:${feature}/${task}`]; break; }
    case 'decision': ids = [`decision:${ref}`]; break;
    case 'memory': ids = [`note:${ref}`]; break;
    case 'constitution': ids = [`principle:${ref.slice('constitution#'.length)}`]; break;
    default: {
      const [head, key] = ref.split('#');
      const [feature, file] = head.split('/');
      const artifact = `${file.replace(/\.md$/, '')}`;
      ids = [...graph.nodes.values()].filter((n) => n.path === `specs/${feature}/${file}` && n.section === key).map((n) => n.id);
      ids.push(`artifact:${feature}/${artifact}`);
    }
  }
  return ids.filter((id) => graph.nodes.has(id));
}

/**
 * Re-scores ranked items linked by a usable edge to one of the top 3 (pinned items are never seeds).
 * Each item gets max(score, 0.5 × seed score) over the seeds it touches; boosts never stack (plan.md).
 */
export function boostByGraph(pinned: ContextItem[], ranked: ContextItem[], graph: Graph): ContextItem[] {
  const pinnedRefs = new Set(pinned.map((p) => p.ref));
  const pool = ranked.filter((i) => !pinnedRefs.has(i.ref));
  const nodes = new Map(pool.map((i) => [i, nodeIdsOf(i, graph)]));
  const boost = new Map<ContextItem, number>();
  for (const seed of pool.slice(0, SEEDS)) {
    const linked = new Set<string>();
    for (const id of nodes.get(seed)!) for (const x of incident(graph, id)) linked.add(x.other);
    for (const item of pool) {
      if (item === seed || !nodes.get(item)!.some((id) => linked.has(id))) continue;
      boost.set(item, Math.max(boost.get(item) ?? 0, BOOST * seed.score));
    }
  }
  return pool
    .map((i) => ({ ...i, score: Math.max(i.score, boost.get(i) ?? 0) }))
    .filter((i) => i.score > 0)
    .sort(byRank);
}
