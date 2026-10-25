import type { Communities } from './community.js';
import { degree, edgeTuple, incident, type EdgeTuple } from './graph.js';
import type { Graph, GraphEdge } from './types.js';

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const NON_SEMANTIC = ['contains', 'belongs_to'];
const SKIPPED_KINDS = ['file', 'artifact', 'feature'];
const BETWEENNESS_SOURCES = 100;
type Question = { type: 'ambiguous_edge' | 'bridge' | 'verify_inferred' | 'isolated' | 'low_cohesion'; question: string; nodes: string[] };

/** Distinct edge indexes of a node, ignoring contains/belongs_to (AMBIGUOUS included). */
function edgeIndexes(graph: Graph, id: string): Set<number> {
  return new Set(incident(graph, id, { includeAmbiguous: true }).filter((x) => !NON_SEMANTIC.includes(x.edge.relation)).map((x) => x.index));
}

/** Most connected non-structural nodes (plan.md "Community detection and analysis"). */
export function godNodes(graph: Graph, top: number): Array<{ id: string; kind: string; label: string; degree: number }> {
  return [...graph.nodes.values()]
    .filter((n) => !SKIPPED_KINDS.includes(n.kind))
    .map((n) => ({ id: n.id, kind: n.kind, label: n.label, degree: edgeIndexes(graph, n.id).size }))
    .sort((a, b) => b.degree - a.degree || cmp(a.id, b.id))
    .slice(0, top);
}

/** Cross-community edges scored by surprise; one best edge per community pair. */
export function surprisingConnections(graph: Graph, communities: Communities, top: number): Array<{ edge: EdgeTuple; score: number; why: string }> {
  const best = new Map<string, { edge: GraphEdge; score: number; why: string }>();
  for (const e of graph.edges) {
    if (NON_SEMANTIC.includes(e.relation)) continue;
    const s = graph.nodes.get(e.source)!, t = graph.nodes.get(e.target)!;
    if (s.kind === 'file' || t.kind === 'file') continue;
    const cs = communities.byNode.get(e.source), ct = communities.byNode.get(e.target);
    if (cs === undefined || ct === undefined || cs === ct) continue;
    const parts: string[] = [e.confidence];
    let score = e.confidence === 'AMBIGUOUS' ? 3 : e.confidence === 'INFERRED' ? 2 : 1;
    if (s.kind !== t.kind) { score += 2; parts.push(`${s.kind} ↔ ${t.kind}`); }
    if (s.feature && t.feature && s.feature !== t.feature) score += 2;
    score += 1;
    parts.unshift(`crosses ${communities.list[cs].label} → ${communities.list[ct].label}`);
    const ds = degree(graph, e.source), dt = degree(graph, e.target);
    if ((ds <= 2 && dt >= 5) || (dt <= 2 && ds >= 5)) { score += 1; parts.push(ds <= 2 ? `peripheral ${s.kind} → hub ${t.kind}` : `peripheral ${t.kind} → hub ${s.kind}`); }
    if (e.relation === 'similar_to' || e.relation === 'contradicts') score *= 1.5;
    const key = [cs, ct].sort((a, b) => a - b).join('|');
    const prev = best.get(key);
    if (!prev || score > prev.score || (score === prev.score && cmp(`${e.source}\u0000${e.relation}\u0000${e.target}`, `${prev.edge.source}\u0000${prev.edge.relation}\u0000${prev.edge.target}`) < 0)) {
      best.set(key, { edge: e, score, why: parts.join(', ') });
    }
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || cmp(`${a.edge.source}\u0000${a.edge.relation}\u0000${a.edge.target}`, `${b.edge.source}\u0000${b.edge.relation}\u0000${b.edge.target}`))
    .slice(0, top)
    .map((x) => ({ edge: edgeTuple(x.edge), score: x.score, why: x.why }));
}

/** Fraction of possible member pairs that share a usable edge. */
export function cohesion(graph: Graph, members: string[]): number {
  const set = new Set(members);
  const n = set.size;
  if (n < 2) return 0;
  const pairs = new Set<string>();
  for (const id of set) for (const x of incident(graph, id)) if (set.has(x.other) && x.other !== id) pairs.add([id, x.other].sort(cmp).join('\u0000'));
  return pairs.size / ((n * (n - 1)) / 2);
}

/** Communities a member is linked to, other than its own. */
export function bridges(graph: Graph, communities: Communities, id: number): Array<{ id: string; label: string; communities: number[] }> {
  return communities.list[id].members
    .map((m) => {
      const others = new Set<number>();
      for (const x of incident(graph, m, { includeAmbiguous: true })) {
        const c = communities.byNode.get(x.other);
        if (c !== undefined && c !== id) others.add(c);
      }
      return { id: m, label: graph.nodes.get(m)?.label ?? m, communities: [...others].sort((a, b) => a - b) };
    })
    .filter((x) => x.communities.length > 0)
    .sort((a, b) => b.communities.length - a.communities.length || cmp(a.id, b.id));
}

/** Approximate betweenness (Brandes) from BFS over the first 100 non-file node ids. */
function betweenness(graph: Graph): Map<string, number> {
  const ids = [...graph.nodes.values()].filter((n) => n.kind !== 'file').map((n) => n.id).sort(cmp);
  const isOpen = new Set(ids);
  const nbrs = new Map(ids.map((id) => [id, [...new Set(incident(graph, id).filter((x) => !NON_SEMANTIC.includes(x.edge.relation) && isOpen.has(x.other) && x.other !== id).map((x) => x.other))].sort(cmp)]));
  const cb = new Map(ids.map((id) => [id, 0]));
  for (const s of ids.slice(0, BETWEENNESS_SOURCES)) {
    const stack: string[] = [], queue = [s];
    const dist = new Map([[s, 0]]), sigma = new Map([[s, 1]]), pred = new Map<string, string[]>();
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      stack.push(v);
      for (const w of nbrs.get(v)!) {
        if (!dist.has(w)) { dist.set(w, dist.get(v)! + 1); queue.push(w); }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + sigma.get(v)!);
          pred.set(w, [...(pred.get(w) ?? []), v]);
        }
      }
    }
    const delta = new Map<string, number>();
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) delta.set(v, (delta.get(v) ?? 0) + (sigma.get(v)! / sigma.get(w)!) * (1 + (delta.get(w) ?? 0)));
      if (w !== s) cb.set(w, cb.get(w)! + (delta.get(w) ?? 0));
    }
  }
  return cb;
}

/** Up to 7 questions, interleaved round-robin across five generators (plan.md "Community detection and analysis"). */
export function suggestQuestions(graph: Graph, communities: Communities): Question[] {
  const label = (id: string): string => graph.nodes.get(id)?.label ?? id;
  const ambiguous: Question[] = graph.edges.filter((e) => e.confidence === 'AMBIGUOUS').map((e) => ({ type: 'ambiguous_edge', question: `Is ${label(e.source)} really ${e.relation.replace(/_/g, ' ')} ${label(e.target)}?`, nodes: [e.source, e.target] }));

  const cb = betweenness(graph);
  const bridgeQs: Question[] = [...cb.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
    .slice(0, 3)
    .flatMap(([id]): Question[] => {
      const own = communities.byNode.get(id);
      const other = [...new Set(incident(graph, id, { includeAmbiguous: true }).map((x) => communities.byNode.get(x.other)))].filter((c): c is number => c !== undefined && c !== own).sort((a, b) => a - b)[0];
      if (own === undefined || other === undefined) return [];
      return [{ type: 'bridge', question: `Why does ${label(id)} connect ${communities.list[own].label} and ${communities.list[other].label}?`, nodes: [id] }];
    });

  const verify: Question[] = godNodes(graph, graph.nodes.size)
    .filter((g) => incident(graph, g.id, { includeAmbiguous: true }).filter((x) => x.edge.confidence === 'INFERRED').length >= 2)
    .map((g) => ({ type: 'verify_inferred', question: `Are the inferred links of ${g.label} correct?`, nodes: [g.id] }));

  const isolated: Question[] = [...graph.nodes.values()]
    .filter((n) => ['decision', 'note', 'concept'].includes(n.kind) && degree(graph, n.id) <= 1)
    .map((n) => ({ type: 'isolated', question: `What does ${n.label} relate to?`, nodes: [n.id] }));

  const lowCohesion: Question[] = communities.list
    .filter((c) => c.members.length >= 5 && cohesion(graph, c.members) < 0.15)
    .map((c) => ({ type: 'low_cohesion', question: `Should ${c.label} be split?`, nodes: c.members }));

  const queues = [ambiguous, bridgeQs, verify, isolated, lowCohesion];
  const out: Question[] = [];
  while (out.length < 7 && queues.some((q) => q.length > 0)) {
    for (const q of queues) if (q.length > 0 && out.length < 7) out.push(q.shift()!);
  }
  return out;
}
