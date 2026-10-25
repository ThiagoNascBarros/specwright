import { SpecwrightError } from '../errors.js';
import { tripleKey } from './build.js';
import type { LedgerChanges } from './ledger.js';
import { CONCEPT_ID, scopeOfNode } from './ids.js';
import { resolveNodeRef } from './node-ref.js';
import { EXTRACTOR_VERSION, SEMANTIC_RELATIONS } from './types.js';
import type { Graph, Relation } from './types.js';

export type SaveInput = {
  relations?: Array<{ source: string; relation: string; target: string; confidence: 'INFERRED' | 'AMBIGUOUS' | 'REJECTED'; score: number; evidence?: string }>;
  concepts?: Array<{ id: string; label: string; summary?: string }>;
  covered?: Array<{ unit: string; hash: string }>;
};
export type Rejection = {
  field: 'relations' | 'concepts' | 'covered';
  index: number;
  reason: 'bad_concept_id' | 'unknown_source' | 'unknown_target' | 'self_relation' | 'unknown_relation' | 'score_out_of_range' | 'previously_rejected' | 'unknown_unit' | 'stale';
};

// Score bands (FR-014); REJECTED rows must score exactly 0.
const BANDS = { INFERRED: [0.5, 0.99], AMBIGUOUS: [0.1, 0.49] } as const;

/** Validates each item on its own and groups the valid ones into ledger changes per scope (plan.md "Tool contracts", save_relations). Pure. */
export function prepareSave(graph: Graph, input: SaveInput, today: string): { changes: Map<string, LedgerChanges>; rejected: Rejection[] } {
  const changes = new Map<string, LedgerChanges>();
  const rejected: Rejection[] = [];
  const bucket = (scope: string): LedgerChanges => {
    let c = changes.get(scope);
    if (!c) changes.set(scope, (c = {}));
    return c;
  };
  const reject = (field: Rejection['field'], index: number, reason: Rejection['reason']): void => {
    rejected.push({ field, index, reason });
  };

  const newConcepts = new Set<string>();
  (input.concepts ?? []).forEach((c, index) => {
    if (!CONCEPT_ID.test(c.id)) return reject('concepts', index, 'bad_concept_id');
    newConcepts.add(c.id);
    (bucket('project').concepts ??= []).push({ id: c.id, label: c.label, summary: c.summary ?? '' });
  });

  // A concept saved in this call is an endpoint too; any other endpoint must already be a node.
  const endpoint = (ref: string): { id: string; scope: string } | undefined => {
    if (newConcepts.has(ref)) return { id: ref, scope: 'project' };
    try {
      const node = resolveNodeRef(graph, ref, undefined, { allowLabel: false });
      return { id: node.id, scope: scopeOfNode(node) };
    } catch (error) {
      if (error instanceof SpecwrightError) return undefined;
      throw error;
    }
  };

  (input.relations ?? []).forEach((r, index) => {
    const source = endpoint(r.source);
    if (!source) return reject('relations', index, 'unknown_source');
    const target = endpoint(r.target);
    if (!target) return reject('relations', index, 'unknown_target');
    if (source.id === target.id) return reject('relations', index, 'self_relation');
    if (!(SEMANTIC_RELATIONS as readonly string[]).includes(r.relation)) return reject('relations', index, 'unknown_relation');
    const inBand = r.confidence === 'REJECTED'
      ? r.score === 0
      : r.score >= BANDS[r.confidence][0] && r.score <= BANDS[r.confidence][1];
    if (!inBand) return reject('relations', index, 'score_out_of_range');
    const key = tripleKey({ source: source.id, relation: r.relation as Relation, target: target.id });
    if (r.confidence !== 'REJECTED' && graph.rejected.has(key)) return reject('relations', index, 'previously_rejected');
    (bucket(source.scope).relations ??= []).push({
      source: source.id, relation: r.relation, target: target.id, confidence: r.confidence, score: r.score, evidence: r.evidence ?? '', date: today,
    });
  });

  (input.covered ?? []).forEach((c, index) => {
    const unit = graph.units.get(c.unit);
    if (!unit) return reject('covered', index, 'unknown_unit');
    if (unit.hash !== c.hash) return reject('covered', index, 'stale');
    (bucket(unit.scope).coverage ??= []).push({ unit: c.unit, hash: c.hash, version: EXTRACTOR_VERSION, date: today });
  });

  return { changes, rejected };
}
