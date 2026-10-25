import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/graph/build.js';
import { candidatesFor, pendingUnits, planBatches } from '../../src/graph/extraction.js';
import { EXTRACTION_INSTRUCTIONS, SERVER_INSTRUCTIONS } from '../../src/graph/instructions.js';
import { EXTRACTOR_VERSION } from '../../src/graph/types.js';
import type { CoverageRow, Graph, GraphNode, Unit } from '../../src/graph/types.js';

const unit = (id: string, scope: string, path: string, tokens: number, hash = 'h1'): Unit => ({
  id, node: `artifact:${scope}`, path, title: id, hash, tokens, scope,
});

const cover = (u: Unit, hash: string, version = EXTRACTOR_VERSION): CoverageRow => ({
  unit: u.id, hash, version, date: '2026-10-24', line: 1,
});

const graphOf = (units: Unit[], coverage: CoverageRow[] = [], nodes: GraphNode[] = []): Graph => ({
  ...buildGraph([], 1),
  nodes: new Map(nodes.map((n) => [n.id, n])),
  units: new Map(units.map((u) => [u.id, u])),
  coverage: new Map(coverage.map((c) => [c.unit, c])),
});

const node = (id: string, kind: GraphNode['kind'], label: string, feature?: string): GraphNode => ({
  id, kind, label, feature, text: label,
});

describe('graph: extraction planning', () => {
  it('US2-AS1: with no coverage every unit is pending, batches stay within budget, sorted by scope then path, and the scope changes start a new batch', () => {
    // Inserted out of order on purpose: the project unit first, the plan before the spec of the same scope.
    const j1 = unit('docs/note.md', 'project', 'docs/note.md', 10);
    const s1 = unit('specs/010-a/spec.md#goals', '010-a', 'specs/010-a/spec.md', 40);
    const s2 = unit('specs/010-a/spec.md#non-goals', '010-a', 'specs/010-a/spec.md', 40);
    const p1 = unit('specs/010-a/plan.md#arch', '010-a', 'specs/010-a/plan.md', 40);
    const b1 = unit('specs/010-b/spec.md#goals', '010-b', 'specs/010-b/spec.md', 40);
    const graph = graphOf([j1, s1, s2, p1, b1]);

    const pending = pendingUnits(graph);
    expect(pending.map((u) => u.id)).toEqual([p1.id, s1.id, s2.id, b1.id, j1.id]);
    expect(pendingUnits(graph, '010-b').map((u) => u.id)).toEqual([b1.id]);

    const batches = planBatches(pending, 100, 50);
    expect(batches).toEqual([
      { batch: 1, scope: '010-a', tokens: 80, units: [p1.id, s1.id] },
      { batch: 2, scope: '010-a', tokens: 40, units: [s2.id] },
      { batch: 3, scope: '010-b', tokens: 40, units: [b1.id] },
      { batch: 4, scope: 'project', tokens: 10, units: [j1.id] },
    ]);
    expect(planBatches(pending, 100, 2)).toHaveLength(2);
  });

  it('Review Focus 5: a unit larger than the budget gets its own batch', () => {
    const small1 = unit('a.md#one', 'project', 'a.md', 10);
    const big = unit('a.md#big', 'project', 'a.md', 500);
    const small2 = unit('a.md#two', 'project', 'a.md', 10);
    const batches = planBatches([small1, big, small2], 100, 50);
    expect(batches.map((b) => b.units)).toEqual([[small1.id], [big.id], [small2.id]]);
    expect(batches[1]).toMatchObject({ tokens: 500 });
  });

  it('SC-002: a coverage row with the current hash and version makes a unit not pending; an older version makes it pending', () => {
    const current = unit('specs/010-a/spec.md#current', '010-a', 'specs/010-a/spec.md', 10, 'h-now');
    const older = unit('specs/010-a/spec.md#older', '010-a', 'specs/010-a/spec.md', 10, 'h-now');
    const edited = unit('specs/010-a/spec.md#edited', '010-a', 'specs/010-a/spec.md', 10, 'h-new');
    const never = unit('specs/010-a/spec.md#never', '010-a', 'specs/010-a/spec.md', 10, 'h-now');
    const graph = graphOf(
      [current, older, edited, never],
      [cover(current, 'h-now'), cover(older, 'h-now', EXTRACTOR_VERSION - 1), cover(edited, 'h-old')],
    );
    expect(pendingUnits(graph).map((u) => u.id)).toEqual([older.id, edited.id, never.id]);
  });

  it('FR-013: candidatesFor lists same-scope nodes in kind order, then concepts, then principles, capped at 60 with labels ≤ 60 chars', () => {
    const u = unit('specs/010-a/spec.md#goals', '010-a', 'specs/010-a/spec.md', 10);
    const long = 'x'.repeat(100);
    const graph = graphOf([u], [], [
      node('task:010-a/T001', 'task', 'T001 Build', '010-a'),
      node('concept:long', 'concept', long),
      node('requirement:010-a/FR-001', 'requirement', 'FR-001', '010-a'),
      node('note:other', 'note', 'Other note', '999-other'),
      node('story:010-a/US1', 'story', 'US1', '010-a'),
      node('principle:simple', 'principle', 'Simplicity'),
      node('feature:010-a', 'feature', 'Feature A', '010-a'),
      node('concept:beta', 'concept', 'Beta'),
      node('feature:010-b', 'feature', 'Feature B', '010-b'),
      node('concept:alpha', 'concept', 'Alpha'),
      node('criterion:010-a/US1-AS1', 'criterion', 'US1-AS1', '010-a'),
      node('decision:0002', 'decision', 'Use X', '010-a'),
      node('artifact:010-a/specs/010-a/spec.md', 'artifact', 'Spec', '010-a'),
    ]);
    expect(candidatesFor(graph, [u])).toEqual([
      ['feature:010-a', 'Feature A'],
      ['story:010-a/US1', 'US1'],
      ['requirement:010-a/FR-001', 'FR-001'],
      ['criterion:010-a/US1-AS1', 'US1-AS1'],
      ['task:010-a/T001', 'T001 Build'],
      ['decision:0002', 'Use X'],
      ['artifact:010-a/specs/010-a/spec.md', 'Spec'],
      ['concept:alpha', 'Alpha'],
      ['concept:beta', 'Beta'],
      ['concept:long', 'x'.repeat(60)],
      ['principle:simple', 'Simplicity'],
    ]);
    expect(candidatesFor(graph, [u], 3)).toHaveLength(3);
  });

  it('FR-023: SERVER_INSTRUCTIONS ≤ 1,200 chars and EXTRACTION_INSTRUCTIONS ≤ 1,600 chars', () => {
    expect(SERVER_INSTRUCTIONS).toContain('query_graph');
    expect(SERVER_INSTRUCTIONS).toContain('extraction_batch');
    expect(EXTRACTION_INSTRUCTIONS).toContain('covered');
    expect(EXTRACTION_INSTRUCTIONS).toContain('rationale_for');
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(1200);
    expect(EXTRACTION_INSTRUCTIONS.length).toBeLessThanOrEqual(1600);
  });
});
