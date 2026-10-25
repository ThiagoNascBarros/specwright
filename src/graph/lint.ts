import { EXTRACTOR_VERSION } from './types.js';
import { incident } from './graph.js';
import { nodeId } from './ids.js';
import type { Graph, LintKind } from './types.js';

export type Issue = { kind: LintKind; severity: 'error' | 'warning' | 'info'; path: string; line?: number; node?: string; message: string; fix: string };

const SEVERITY: Record<LintKind, Issue['severity']> = {
  broken_link: 'error', dangling_relation: 'error', invalid_row: 'error',
  ambiguous_link: 'warning', unknown_mention: 'warning', duplicate_label: 'warning', contradiction: 'warning',
  ambiguous_relation: 'info', orphan: 'info', stale_coverage: 'info',
};
const RANK: Record<Issue['severity'], number> = { error: 0, warning: 1, info: 2 };
const ORPHAN_KINDS = ['decision', 'note', 'doc', 'concept'];
const LABEL_KINDS = ['note', 'concept', 'doc'];
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function severityOf(kind: LintKind): Issue['severity'] {
  return SEVERITY[kind];
}

/** Every issue of the graph, optionally only those of one feature, sorted by severity, path, line and kind (FR-019). */
export function lintGraph(graph: Graph, feature?: string): Issue[] {
  const issues: Issue[] = [];
  for (const d of graph.diagnostics) {
    issues.push({ kind: d.kind, severity: severityOf(d.kind), path: d.path, ...(d.line !== undefined ? { line: d.line } : {}), ...(d.node ? { node: d.node } : {}), message: d.message, fix: d.fix });
  }

  for (const n of graph.nodes.values()) {
    if (!ORPHAN_KINDS.includes(n.kind)) continue;
    if (incident(graph, n.id, { includeAmbiguous: true }).some((x) => x.edge.relation !== 'belongs_to')) continue;
    issues.push({ kind: 'orphan', severity: 'info', path: n.path ?? '', node: n.id, message: `${n.id} has no links`, fix: 'Link it to the work it relates to, or remove it.' });
  }

  const byLabel = new Map<string, string[]>();
  for (const n of graph.nodes.values()) {
    if (!LABEL_KINDS.includes(n.kind)) continue;
    const key = n.label.toLowerCase();
    byLabel.set(key, [...(byLabel.get(key) ?? []), n.id]);
  }
  for (const ids of byLabel.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const others = ids.filter((x) => x !== id);
      issues.push({ kind: 'duplicate_label', severity: 'warning', path: graph.nodes.get(id)!.path ?? '', node: id, message: `${id} has the same label as ${others.join(', ')}`, fix: 'Rename one of them.' });
    }
  }

  for (const e of graph.edges) {
    const where = { path: e.path, ...(e.line !== undefined ? { line: e.line } : {}), node: e.source };
    if (e.relation === 'contradicts') {
      issues.push({ kind: 'contradiction', severity: 'warning', ...where, message: `${e.source} contradicts ${e.target}`, fix: 'Resolve the conflict and remove one of the two relations.' });
    }
    if (e.confidence === 'AMBIGUOUS' && e.origin === 'ledger') {
      issues.push({ kind: 'ambiguous_relation', severity: 'info', ...where, message: `${e.source} ${e.relation} ${e.target} is AMBIGUOUS`, fix: 'Confirm the relation or mark it REJECTED.' });
    }
  }

  const stale = new Map<string, number>();
  for (const row of graph.coverage.values()) {
    const unit = graph.units.get(row.unit);
    if (!unit) continue;
    if (row.hash !== unit.hash || row.version !== EXTRACTOR_VERSION) stale.set(unit.scope, (stale.get(unit.scope) ?? 0) + 1);
  }
  for (const [scope, count] of stale) {
    issues.push({ kind: 'stale_coverage', severity: 'info', path: scope === 'project' ? '.specify/memory' : `specs/${scope}`, message: `${count} unit(s) in ${scope} changed since they were covered`, fix: 'Run extraction_batch again for those units and save_relations with their new hashes.' });
  }

  const kept = feature === undefined ? issues : issues.filter((i) => inFeature(graph, i, feature));
  return kept.sort((a, b) => RANK[a.severity] - RANK[b.severity] || cmp(a.path, b.path) || (a.line ?? 0) - (b.line ?? 0) || cmp(a.kind, b.kind));
}

function inFeature(graph: Graph, issue: Issue, feature: string): boolean {
  const owner = issue.node ? graph.nodes.get(issue.node)?.feature : undefined;
  return owner === feature || issue.node === nodeId.feature(feature) || issue.path.startsWith(`specs/${feature}/`);
}
