import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/build.js';
import { EXTRACTOR_VERSION } from '../../src/graph/types.js';
import { prepareSave } from '../../src/graph/relations.js';
import type { SaveInput } from '../../src/graph/relations.js';
import type { Graph, GraphNode, Unit } from '../../src/graph/types.js';

const TODAY = '2026-10-24';
const req: GraphNode = { id: 'requirement:001-a/FR-001', kind: 'requirement', label: 'FR-001', feature: '001-a', text: '' };
const dec: GraphNode = { id: 'decision:0001', kind: 'decision', label: 'Plain files', text: '' };
const unit: Unit = { id: 'specs/001-a/spec.md#requirements', node: req.id, path: 'specs/001-a/spec.md', section: 'requirements', title: 'Spec', hash: 'h1', tokens: 1, scope: '001-a' };
const unit2: Unit = { ...unit, id: 'specs/001-a/spec.md#other', section: 'other', hash: 'h2' };

function graphWith(rejected: string[] = []): Graph {
  const g = buildGraph([]);
  for (const n of [req, dec]) g.nodes.set(n.id, n);
  for (const u of [unit, unit2]) g.units.set(u.id, u);
  for (const r of rejected) g.rejected.add(r);
  return g;
}

describe('graph: relations', () => {
  it('FR-014: each rejection reason is produced by one crafted item, and valid items in the same input still produce changes', () => {
    const rel = (source: string, relation: string, target: string, confidence: 'INFERRED' | 'AMBIGUOUS' | 'REJECTED', score: number) => ({ source, relation, target, confidence, score });
    const input: SaveInput = {
      concepts: [{ id: 'Bad Id', label: 'x' }, { id: 'concept:ok', label: 'Ok' }],
      relations: [
        rel('note:missing', 'uses', dec.id, 'INFERRED', 0.8),
        rel(dec.id, 'uses', 'note:missing', 'INFERRED', 0.8),
        rel(dec.id, 'uses', dec.id, 'INFERRED', 0.8),
        rel(dec.id, 'fly_to', req.id, 'INFERRED', 0.8),
        rel(dec.id, 'uses', req.id, 'INFERRED', 0.3),
        rel(req.id, 'rationale_for', dec.id, 'INFERRED', 0.9),
        rel(dec.id, 'refines', req.id, 'INFERRED', 0.9),
      ],
      covered: [{ unit: 'specs/x.md#nope', hash: 'h1' }, { unit: unit.id, hash: 'old' }, { unit: unit2.id, hash: 'h2' }],
    };
    const { changes, rejected } = prepareSave(graphWith([`${req.id}|rationale_for|${dec.id}`]), input, TODAY);
    expect(rejected).toEqual([
      { field: 'concepts', index: 0, reason: 'bad_concept_id' },
      { field: 'relations', index: 0, reason: 'unknown_source' },
      { field: 'relations', index: 1, reason: 'unknown_target' },
      { field: 'relations', index: 2, reason: 'self_relation' },
      { field: 'relations', index: 3, reason: 'unknown_relation' },
      { field: 'relations', index: 4, reason: 'score_out_of_range' },
      { field: 'relations', index: 5, reason: 'previously_rejected' },
      { field: 'covered', index: 0, reason: 'unknown_unit' },
      { field: 'covered', index: 1, reason: 'stale' },
    ]);
    const project = changes.get('project');
    expect(project?.concepts?.map((c) => c.id)).toEqual(['concept:ok']);
    expect(project?.relations?.map((r) => [r.source, r.relation, r.target])).toEqual([[dec.id, 'refines', req.id]]);
    expect(changes.get('001-a')?.coverage?.map((c) => c.unit)).toEqual([unit2.id]);
  });

  it('FR-014: concepts defined in the same input are valid endpoints', () => {
    const input: SaveInput = {
      concepts: [{ id: 'concept:alpha', label: 'Alpha' }],
      relations: [{ source: 'concept:alpha', relation: 'related_to', target: dec.id, confidence: 'AMBIGUOUS', score: 0.3 }],
    };
    const { changes, rejected } = prepareSave(graphWith(), input, TODAY);
    expect(rejected).toEqual([]);
    expect(changes.get('project')?.relations?.map((r) => [r.source, r.target])).toEqual([['concept:alpha', dec.id]]);
    expect(changes.get('project')?.concepts?.map((c) => c.id)).toEqual(['concept:alpha']);
  });

  it('FR-015: relations go to the scope of their source (concept source → project), coverage to the unit\'s scope', () => {
    const input: SaveInput = {
      concepts: [{ id: 'concept:alpha', label: 'Alpha' }],
      relations: [
        { source: req.id, relation: 'tests', target: dec.id, confidence: 'INFERRED', score: 0.9 },
        { source: 'concept:alpha', relation: 'uses', target: dec.id, confidence: 'INFERRED', score: 0.9 },
      ],
      covered: [{ unit: unit.id, hash: 'h1' }],
    };
    const { changes, rejected } = prepareSave(graphWith(), input, TODAY);
    expect(rejected).toEqual([]);
    expect(changes.get('001-a')?.relations?.map((r) => r.source)).toEqual([req.id]);
    expect(changes.get('project')?.relations?.map((r) => r.source)).toEqual(['concept:alpha']);
    expect(changes.get('001-a')?.coverage).toEqual([{ unit: unit.id, hash: 'h1', version: EXTRACTOR_VERSION, date: TODAY }]);
    expect(changes.get('project')?.coverage).toBeUndefined();
  });

  it('FR-016: a covered hash that differs from the unit\'s → stale', () => {
    const stale = prepareSave(graphWith(), { covered: [{ unit: unit.id, hash: 'old' }] }, TODAY);
    expect(stale.rejected).toEqual([{ field: 'covered', index: 0, reason: 'stale' }]);
    expect(stale.changes.size).toBe(0);
    const fresh = prepareSave(graphWith(), { covered: [{ unit: unit.id, hash: 'h1' }] }, TODAY);
    expect(fresh.rejected).toEqual([]);
    expect(fresh.changes.get('001-a')?.coverage?.length).toBe(1);
  });

  it('US2-AS6: an INFERRED save of a triple REJECTED in the ledgers → previously_rejected', () => {
    const triple = `${req.id}|rationale_for|${dec.id}`;
    const rel = { source: req.id, relation: 'rationale_for', target: dec.id, score: 0.9 };
    const inferred = prepareSave(graphWith([triple]), { relations: [{ ...rel, confidence: 'INFERRED' }] }, TODAY);
    expect(inferred.rejected).toEqual([{ field: 'relations', index: 0, reason: 'previously_rejected' }]);
    const retired = prepareSave(graphWith([triple]), { relations: [{ ...rel, confidence: 'REJECTED', score: 0 }] }, TODAY);
    expect(retired.rejected).toEqual([]);
    expect(retired.changes.get('001-a')?.relations?.map((r) => [r.confidence, r.score])).toEqual([['REJECTED', 0]]);
  });
});

describe('graph: relations, REJECTED is never overwritten', () => {
  it('FR-014: a non-REJECTED item whose triple is REJECTED in the same call is refused as previously_rejected, in either order', () => {
    const rel = (confidence: 'INFERRED' | 'REJECTED', score: number) => ({ source: req.id, relation: 'rationale_for', target: dec.id, confidence, score });
    const later = prepareSave(graphWith(), { relations: [rel('REJECTED', 0), rel('INFERRED', 0.9)] }, TODAY);
    expect(later.rejected).toEqual([{ field: 'relations', index: 1, reason: 'previously_rejected' }]);
    expect(later.changes.get('001-a')?.relations?.map((r) => r.confidence)).toEqual(['REJECTED']);
    const earlier = prepareSave(graphWith(), { relations: [rel('INFERRED', 0.9), rel('REJECTED', 0)] }, TODAY);
    expect(earlier.rejected).toEqual([{ field: 'relations', index: 0, reason: 'previously_rejected' }]);
    expect(earlier.changes.get('001-a')?.relations?.map((r) => r.confidence)).toEqual(['REJECTED']);
  });

  it('FR-015: origins maps each scope\'s ledger rows back to the caller input index, across two scopes', () => {
    const input: SaveInput = {
      concepts: [{ id: 'concept:alpha', label: 'Alpha' }],
      relations: [
        { source: req.id, relation: 'tests', target: dec.id, confidence: 'INFERRED', score: 0.9 },
        { source: 'concept:alpha', relation: 'uses', target: dec.id, confidence: 'INFERRED', score: 0.9 },
        { source: 'requirement:001-a/FR-999', relation: 'uses', target: dec.id, confidence: 'INFERRED', score: 0.9 },
        { source: req.id, relation: 'refines', target: dec.id, confidence: 'AMBIGUOUS', score: 0.2 },
      ],
    };
    const { changes, origins } = prepareSave(graphWith(), input, TODAY);
    expect(origins.get('001-a')).toEqual([0, 3]);
    expect(origins.get('project')).toEqual([1]);
    // A ledger rejection at changes.relations[1] of scope 001-a (the row written from input 3) maps back to input 3.
    expect(changes.get('001-a')!.relations![1].relation).toBe('refines');
    expect(origins.get('001-a')![1]).toBe(3);
  });
});
