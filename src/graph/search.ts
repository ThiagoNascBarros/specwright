import { tokenize } from '../storage/text.js';
import { degree, pathNodes } from './graph.js';
import { refIdCandidates } from './ids.js';
import type { Graph } from './types.js';

export type Scored = { id: string; score: number };
type Index = Map<string, Array<[string, number]>>;

const ID_HIT_SCORE = 1000;
const MAX_SEEDS = 3;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const indexes = new WeakMap<Graph, { version: number; index: Index }>();

function counts(terms: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** term → [nodeId, weight], weight = 3 × label + 2 × tags + min(3, text) occurrences. Memoized per graph.version. */
function indexOf(graph: Graph): Index {
  const cached = indexes.get(graph);
  if (cached?.version === graph.version) return cached.index;
  const index: Index = new Map();
  for (const node of graph.nodes.values()) {
    const label = counts(tokenize(node.label));
    const tags = counts(tokenize((node.tags ?? []).join(' ')));
    const text = counts(tokenize(node.text));
    for (const term of new Set([...label.keys(), ...tags.keys(), ...text.keys()])) {
      const weight = 3 * (label.get(term) ?? 0) + 2 * (tags.get(term) ?? 0) + Math.min(3, text.get(term) ?? 0);
      const list = index.get(term);
      if (list) list.push([node.id, weight]);
      else index.set(term, [[node.id, weight]]);
    }
  }
  indexes.set(graph, { version: graph.version, index });
  return index;
}

/** Nodes the question names by exact id, short id or source path; `feature` scopes short ids. */
function idHits(graph: Graph, question: string, feature?: string): string[] {
  const hits: string[] = [];
  for (const raw of question.split(/\s+/)) {
    const token = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (graph.nodes.has(token)) hits.push(token);
    hits.push(...refIdCandidates(token, feature).filter((id) => graph.nodes.has(id)));
    hits.push(...pathNodes(graph, token).map((n) => n.id));
  }
  return hits;
}

/** Nodes scored for a question: id hits score exactly 1000, other nodes the weights of the question's terms (plan.md "Query algorithm"). */
export function scoreNodes(graph: Graph, question: string, feature?: string): Scored[] {
  const scores = new Map<string, number>();
  const index = indexOf(graph);
  for (const term of new Set(tokenize(question))) {
    for (const [id, weight] of index.get(term) ?? []) scores.set(id, (scores.get(id) ?? 0) + weight);
  }
  for (const id of new Set(idHits(graph, question, feature))) scores.set(id, ID_HIT_SCORE);
  let ranked = [...scores].filter(([, score]) => score > 0);
  if (feature !== undefined) {
    const scoped = ranked.filter(([id]) => graph.nodes.get(id)?.feature === feature);
    if (scoped.length) ranked = scoped;
  }
  return ranked.map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || cmp(a.id, b.id));
}

/** Up to three seeds by score, then degree, then id; the second and third must score at least half the first. */
export function pickSeeds(graph: Graph, scored: Scored[]): string[] {
  const degrees = new Map(scored.map((x) => [x.id, degree(graph, x.id)]));
  const sorted = [...scored].sort((a, b) => b.score - a.score || degrees.get(b.id)! - degrees.get(a.id)! || cmp(a.id, b.id));
  const first = sorted[0]?.score ?? 0;
  return sorted.filter((x) => x.score * 2 >= first).slice(0, MAX_SEEDS).map((x) => x.id);
}
