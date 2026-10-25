import { describe, it, expect } from 'vitest';
import { factsOf } from '../../src/graph/facts.js';
import type { SourceFile, SourceKind } from '../../src/graph/types.js';

const src = (path: string, kind: SourceKind, feature?: string): SourceFile => ({ path, kind, ...(feature ? { feature } : {}), size: 1, mtimeMs: 1 });
const LEDGER = `---
scope: project
---
# Relations: project

## Concepts

| id | label | summary |
|---|---|---|
| concept:cache | Cache | Fast store |

## Relations

| source | relation | target | confidence | score | evidence | date |
|---|---|---|---|---|---|---|

## Coverage

| unit | hash | version | date |
|---|---|---|---|
`;

describe('factsOf', () => {
  it('FR-001: factsOf dispatches each SourceKind and ledger concept rows become concept nodes', () => {
    const cases: Array<[SourceFile, string, string]> = [
      [src('specs/001-a/spec.md', 'spec', '001-a'), '# A\n\n- **FR-001**: it must work\n', 'requirement:001-a/FR-001'],
      [src('specs/001-a/plan.md', 'plan', '001-a'), '# Plan\n\n## Approach\nx\n', 'artifact:001-a/plan'],
      [src('.specify/memory/constitution.md', 'constitution'), '# C\n\n## Core Principles\n\n### I. Spec First\nWrite it.\n', 'artifact:constitution'],
      [src('.specify/memory/notes/n.md', 'note'), '---\ntitle: N\n---\nbody\n', 'note:n'],
      [src('docs/a.md', 'doc'), '# Doc A\ntext\n', 'doc:docs/a.md'],
    ];
    for (const [s, raw, id] of cases) {
      const f = factsOf(s, raw);
      expect(f.kind).toBe(s.kind);
      expect(f.nodes.map((n) => n.id)).toContain(id);
    }
    const d = factsOf(src('.specify/memory/decisions/0001-x.md', 'decision'), '---\ntitle: D\ndate: 2026-01-01\n---\nbody\n');
    expect(d.nodes[0].id).toBe('decision:0001');
    const l = factsOf(src('.specify/memory/relations/project.md', 'ledger'), LEDGER);
    expect(l.ledger?.scope).toBe('project');
    expect(l.nodes).toEqual([expect.objectContaining({ id: 'concept:cache', kind: 'concept', label: 'Cache', text: 'Cache Fast store', line: 10 })]);
  });
});
