import { nodeId } from './ids.js';
import { buildLinkIndex, resolveMarkdown, resolveWiki } from './link-index.js';
import { SEMANTIC_RELATIONS } from './types.js';
import type { Confidence, CoverageRow, Diagnostic, FileFacts, Graph, GraphEdge, GraphNode, LintKind, Relation, Unit } from './types.js';

const RANK: Record<Confidence, number> = { EXTRACTED: 0, INFERRED: 1, AMBIGUOUS: 2 };
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export const tripleKey = (e: Pick<GraphEdge, 'source' | 'relation' | 'target'>): string => `${e.source}|${e.relation}|${e.target}`;

/** True when `a` should win over `b` for the same triple: confidence, then score, then the first (path, line). */
function better(a: GraphEdge, b: GraphEdge): boolean {
  if (RANK[a.confidence] !== RANK[b.confidence]) return RANK[a.confidence] < RANK[b.confidence];
  if (a.score !== b.score) return a.score > b.score;
  const p = cmp(a.path, b.path);
  return p !== 0 ? p < 0 : (a.line ?? 0) < (b.line ?? 0);
}

/** The project graph from per-file facts (plan.md "Edge derivation", "Link resolution", "Ledger format"). Pure. */
export function buildGraph(input: FileFacts[], version = 1): Graph {
  const facts = [...input].sort((a, b) => cmp(a.path, b.path));
  const diagnostics: Diagnostic[] = [];
  const diag = (kind: LintKind, path: string, line: number | undefined, message: string, fix: string, node?: string): void => {
    diagnostics.push({ kind, path, ...(line !== undefined ? { line } : {}), ...(node ? { node } : {}), message, fix });
  };

  // 1–2. Nodes: first wins by path order; features without spec.md get a bare node.
  const byId = new Map<string, GraphNode>();
  for (const f of facts) for (const n of f.nodes) if (!byId.has(n.id)) byId.set(n.id, n);
  for (const f of facts) {
    const id = f.feature ? nodeId.feature(f.feature) : undefined;
    if (id && f.kind !== 'decision' && !byId.has(id)) byId.set(id, { id, kind: 'feature', label: f.feature!, feature: f.feature, text: f.feature! });
  }

  // 3. Mentions, links and paths.
  const index = buildLinkIndex(facts.flatMap((f) => {
    const main = f.kind === 'ledger' ? undefined : f.nodes.find((n) => n.kind !== 'feature');
    return main ? [{ path: f.path, node: main.id }] : [];
  }));
  const edges: GraphEdge[] = [];
  const derived = (f: FileFacts, source: string, target: string, relation: Relation, line: number, origin: GraphEdge['origin'] = 'derived'): void => {
    edges.push({ source, target, relation, confidence: 'EXTRACTED', score: 1, origin, path: f.path, line });
  };
  const touch = (f: FileFacts, from: string, path: string, line: number): void => {
    const id = nodeId.file(path);
    if (!byId.has(id)) byId.set(id, { id, kind: 'file', label: path, text: path });
    derived(f, from, id, 'touches', line);
  };
  for (const f of facts) {
    edges.push(...f.edges);
    for (const m of f.mentions) {
      let target: string;
      if (m.type === 'feature') {
        target = nodeId.feature(m.id);
        if (byId.get(m.from)?.feature === m.id) continue;
      } else if (m.type === 'decision') target = nodeId.decision(m.id);
      else {
        if (m.feature === undefined) continue; // unscoped (notes, docs): only qualified mentions resolve
        target = m.type === 'story' ? nodeId.story(m.feature, m.id) : m.type === 'task' ? nodeId.task(m.feature, m.id)
          : (m.id.startsWith('FR') ? nodeId.requirement : nodeId.criterion)(m.feature, m.id);
      }
      if (byId.has(target)) derived(f, m.from, target, 'references', m.line);
      else if (m.type !== 'feature' && m.type !== 'decision') diag('unknown_mention', f.path, m.line, `"${m.feature}/${m.id}" does not exist`, 'Fix the id or add the item.', m.from);
    }
    for (const l of f.links) {
      const r = l.form === 'wiki' ? resolveWiki(index, l.target) : resolveMarkdown(index, f.path, l.target);
      if ('node' in r) derived(f, l.from, r.node, l.relation ?? 'links_to', l.line, l.relation ? 'relation-line' : 'derived');
      else if ('file' in r) touch(f, l.from, r.file, l.line);
      else if ('missing' in r) diag('broken_link', f.path, l.line, `link "${l.target}" matches no file`, 'Fix the link target or create the file.', l.from);
      else if ('ambiguous' in r) diag('ambiguous_link', f.path, l.line, `link "${l.target}" matches ${r.ambiguous.join(', ')}`, 'Use a longer path in the link.', l.from);
    }
    for (const p of f.paths) {
      const hit = index.byPath.get(p.path);
      if (hit) derived(f, p.from, hit.node, 'links_to', p.line);
      else touch(f, p.from, p.path, p.line);
    }
  }

  // 4. belongs_to / implements to missing targets.
  const kept = edges.filter((e) => {
    if (byId.has(e.target) || (e.relation !== 'belongs_to' && e.relation !== 'implements')) return true;
    if (e.relation === 'implements') diag('unknown_mention', e.path, e.line, `"${e.target}" does not exist`, 'Fix the story label or add the story.', e.source);
    return false;
  });

  // 5. Ledgers.
  const rejected = new Set<string>();
  const coverage = new Map<string, CoverageRow>();
  for (const f of facts) {
    if (!f.ledger) continue;
    for (const bad of f.ledger.invalid) diag('invalid_row', f.path, bad.line, `invalid row: ${bad.reason}`, 'Fix the row cells.');
    for (const c of f.ledger.coverage) if (!coverage.has(c.unit)) coverage.set(c.unit, c);
    for (const row of f.ledger.relations) {
      if (row.confidence === 'REJECTED') { rejected.add(tripleKey({ source: row.source, relation: row.relation as Relation, target: row.target })); continue; }
      if (!(SEMANTIC_RELATIONS as readonly string[]).includes(row.relation)) { diag('invalid_row', f.path, row.line, `unknown relation "${row.relation}"`, 'Use a relation from the vocabulary.'); continue; }
      const missing = [row.source, row.target].filter((id) => !byId.has(id));
      if (missing.length) { diag('dangling_relation', f.path, row.line, `${missing.join(', ')} does not exist`, 'Fix the node id or remove the row.', row.source); continue; }
      kept.push({ source: row.source, target: row.target, relation: row.relation as Relation, confidence: row.confidence as Confidence, score: row.score, origin: 'ledger', path: f.path, line: row.line, ...(row.evidence ? { evidence: row.evidence } : {}) });
    }
  }

  // 6–7. Dedupe triples (after REJECTED suppression), drop self-edges and edges to unknown endpoints.
  const best = new Map<string, GraphEdge>();
  for (const e of kept) {
    if (e.source === e.target || !byId.has(e.source) || !byId.has(e.target)) continue;
    const key = tripleKey(e);
    if (e.confidence !== 'EXTRACTED' && rejected.has(key)) continue;
    const prev = best.get(key);
    if (!prev || better(e, prev)) best.set(key, e);
  }

  // 8. Sorted nodes, edges and adjacency.
  const nodes = new Map([...byId.keys()].sort(cmp).map((id) => [id, byId.get(id)!]));
  const sorted = [...best.values()].sort((a, b) => cmp(a.source, b.source) || cmp(a.relation, b.relation) || cmp(a.target, b.target));
  const out = new Map<string, number[]>();
  const inn = new Map<string, number[]>();
  for (const id of nodes.keys()) { out.set(id, []); inn.set(id, []); }
  sorted.forEach((e, i) => { out.get(e.source)!.push(i); inn.get(e.target)!.push(i); });
  const byOther = (other: (e: GraphEdge) => string) => (a: number, b: number): number =>
    cmp(other(sorted[a]), other(sorted[b])) || cmp(sorted[a].relation, sorted[b].relation);
  for (const list of out.values()) list.sort(byOther((e) => e.target));
  for (const list of inn.values()) list.sort(byOther((e) => e.source));

  // 9. Units.
  const units = new Map<string, Unit>();
  for (const f of facts) for (const u of f.units) if (!units.has(u.id)) units.set(u.id, u);

  return { version, nodes, edges: sorted, out, in: inn, units, coverage, rejected, diagnostics };
}
