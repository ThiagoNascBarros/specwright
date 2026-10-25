import { describe, it, expect } from 'vitest';
import { constitutionFacts, decisionFacts, docFacts, noteFacts } from '../../src/graph/facts-memory.js';

const CONST = `# Project Constitution

## Core Principles

### I. Spec First
Always write the spec.

### II. Test-First (NON-NEGOTIABLE)
TDD only. See decision 0001.

## Governance
**Version**: 1.0.0
`;
const DEC = `---
title: Keep ids stable
feature: 002-sharing
date: 2026-01-01
status: accepted
---
# Keep ids stable
Follows decision 0001 and [[keep-ids-stable]]. Needs FR-002.
- depends_on [[decision-0001]]
`;
const NOTE = `---
title: Decisão de cache
type: learning
tags: [cache]
date: 2026-01-01
---
Unscoped FR-002 here, but 001-photo-albums/FR-002 counts.
`;

describe('graph: facts of memory sources', () => {
  it('FR-002: principles get ids principle:<key> with heading lines', () => {
    const r = constitutionFacts('.specify/memory/constitution.md', CONST);
    const p = r.nodes.filter((n) => n.kind === 'principle');
    expect(p.map((n) => [n.id, n.line])).toEqual([['principle:i-spec-first', 5], ['principle:ii-test-first-non-negotiable', 8]]);
    expect(r.nodes.find((n) => n.id === 'artifact:constitution')).toMatchObject({ label: 'Constitution', line: 1 });
    expect(r.mentions).toContainEqual({ from: 'principle:ii-test-first-non-negotiable', line: 9, type: 'decision', id: '0001' });
  });

  it('FR-003: decision 0002 yields belongs_to feature:002-sharing, a "decision 0001" mention, a wikilink keep-ids-stable and a relation-line link depends_on', () => {
    const r = decisionFacts('.specify/memory/decisions/0002-keep-ids-stable.md', DEC);
    expect(r.nodes[0]).toMatchObject({ id: 'decision:0002', kind: 'decision', label: 'Keep ids stable', feature: '002-sharing' });
    expect(r.edges).toMatchObject([{ source: 'decision:0002', target: 'feature:002-sharing', relation: 'belongs_to' }]);
    expect(r.mentions).toContainEqual({ from: 'decision:0002', line: 8, type: 'decision', id: '0001' });
    expect(r.mentions).toContainEqual({ from: 'decision:0002', line: 8, type: 'item', id: 'FR-002', feature: '002-sharing' });
    expect(r.mentions.some((m) => m.line < 7)).toBe(false);
    expect(r.links).toContainEqual({ from: 'decision:0002', line: 8, form: 'wiki', target: 'keep-ids-stable' });
    expect(r.links).toContainEqual({ from: 'decision:0002', line: 9, form: 'wiki', target: 'decision-0001', relation: 'depends_on' });
  });

  it('FR-003: an unqualified FR-002 in a note is not a scoped mention, but 001-photo-albums/FR-002 is', () => {
    const r = noteFacts('.specify/memory/notes/cache.md', NOTE);
    expect(r.mentions).toContainEqual({ from: 'note:cache', line: 7, type: 'item', id: 'FR-002' });
    expect(r.mentions).toContainEqual({ from: 'note:cache', line: 7, type: 'item', id: 'FR-002', feature: '001-photo-albums' });
    expect(r.mentions.filter((m) => m.type === 'item' && 'feature' in m && m.feature === undefined)).toEqual([]);
  });

  it('FR-002: doc label from # heading, else file name', () => {
    expect(docFacts('docs/a.md', 'intro\n# Hello\n').nodes[0]).toMatchObject({ id: 'doc:docs/a.md', kind: 'doc', label: 'Hello' });
    expect(docFacts('docs/b.md', 'no heading\n').nodes[0]).toMatchObject({ id: 'doc:docs/b.md', label: 'b' });
  });

  it('Review Focus 2: a note titled "Decisão de cache" keeps its label', () => {
    const n = noteFacts('.specify/memory/notes/cache.md', NOTE).nodes[0];
    expect(n).toMatchObject({ id: 'note:cache', kind: 'note', label: 'Decisão de cache', type: 'learning', tags: ['cache'] });
  });
});
