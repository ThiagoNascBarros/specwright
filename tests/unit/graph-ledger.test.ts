import { describe, it, expect } from 'vitest';
import { applyLedgerChanges, escapeCell, formatScore, ledgerPath, parseLedger, unescapeCell } from '../../src/graph/ledger.js';

const rel = (source: string, score = 0.85, target = 'requirement:001-a/FR-001') => ({
  source, relation: 'rationale_for', target, confidence: 'INFERRED', score, evidence: '"why"', date: '2026-10-24',
});
const lines = (s: string) => s.split('\n');

describe('graph: ledger', () => {
  it('FR-015: a new ledger renders frontmatter, title and three tables with sorted rows', () => {
    const { text, stats } = applyLedgerChanges(undefined, '001-a', {
      concepts: [{ id: 'concept:b', label: 'B', summary: 's' }, { id: 'concept:a', label: 'A', summary: 's' }],
      relations: [rel('note:z'), rel('decision:0001')],
      coverage: [{ unit: 'specs/x.md#b', hash: 'h', version: 1, date: '2026-10-24' }],
    });
    expect(ledgerPath('001-a')).toBe('.specify/memory/relations/001-a.md');
    expect(text.startsWith('---\nscope: 001-a\n---\n# Relations: 001-a\n')).toBe(true);
    expect(text.indexOf('concept:a')).toBeLessThan(text.indexOf('concept:b'));
    expect(text.indexOf('decision:0001')).toBeLessThan(text.indexOf('note:z'));
    expect(text).toContain('## Concepts\n\n| id | label | summary |\n|---|---|---|\n');
    expect(text).toContain('| decision:0001 | rationale_for | requirement:001-a/FR-001 | INFERRED | 0.85 | "why" | 2026-10-24 |');
    expect(stats.relations).toEqual({ added: 2, updated: 0, unchanged: 0 });
    const facts = parseLedger('.specify/memory/relations/001-a.md', text);
    expect(facts.scope).toBe('001-a');
    expect([facts.concepts.length, facts.relations.length, facts.coverage.length, facts.invalid.length]).toEqual([2, 2, 1, 0]);
  });

  it('SC-006: adding one relation to an existing ledger adds exactly one line at its sorted position', () => {
    const base = applyLedgerChanges(undefined, 'project', { relations: [rel('a:1'), rel('c:1')] }).text;
    const { text, stats } = applyLedgerChanges(base, 'project', { relations: [rel('b:1')] });
    const before = lines(base), after = lines(text);
    expect(stats.relations.added).toBe(1);
    expect(after.length).toBe(before.length + 1);
    const idx = after.findIndex((l) => l.startsWith('| b:1 '));
    expect(idx).toBe(before.findIndex((l) => l.startsWith('| c:1 ')));
    expect(after.filter((_, i) => i !== idx)).toEqual(before);
  });

  it('FR-015: re-saving an identical row changes nothing (unchanged=1, text identical)', () => {
    const base = applyLedgerChanges(undefined, 'project', { relations: [rel('a:1')] }).text;
    const { text, stats } = applyLedgerChanges(base, 'project', { relations: [rel('a:1')] });
    expect(text).toBe(base);
    expect(stats.relations).toEqual({ added: 0, updated: 0, unchanged: 1 });
  });

  it('FR-015: changing a score replaces only that line', () => {
    const base = applyLedgerChanges(undefined, 'project', { relations: [rel('a:1'), rel('b:1')] }).text;
    const { text, stats } = applyLedgerChanges(base, 'project', { relations: [rel('b:1', 0.5)] });
    expect(stats.relations).toEqual({ added: 0, updated: 1, unchanged: 0 });
    const before = lines(base), after = lines(text);
    const diff = after.map((l, i) => i).filter((i) => after[i] !== before[i]);
    expect(diff.length).toBe(1);
    expect(after[diff[0]]).toContain('| INFERRED | 0.5 |');
  });

  it('FR-015: CRLF files stay CRLF', () => {
    const base = applyLedgerChanges(undefined, 'project', { relations: [rel('a:1')] }).text.replace(/\n/g, '\r\n');
    const { text } = applyLedgerChanges(base, 'project', { relations: [rel('b:1')] });
    expect(text).toContain('| b:1 ');
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
    expect(text.split('\r\n').length).toBe(base.split('\r\n').length + 1);
  });

  it('FR-015: cells with | and newlines round-trip through escape/unescape', () => {
    expect(escapeCell('a|b\\c')).toBe('a\\|b\\\\c');
    expect(unescapeCell(escapeCell('a|b\\c'))).toBe('a|b\\c');
    expect(escapeCell(' x\ny\r ')).toBe('x y');
    expect(formatScore(0.85)).toBe('0.85');
    expect(formatScore(1)).toBe('1');
    expect(formatScore(0.5)).toBe('0.5');
    const ev = '"a | b \\ c"';
    const { text } = applyLedgerChanges(undefined, 'project', { relations: [{ ...rel('a:1'), evidence: ev }] });
    expect(parseLedger('p.md', text).relations[0].evidence).toBe(ev);
  });

  it('FR-019: invalid rows (wrong cell count, bad confidence, NaN score) are reported in invalid[] with line numbers and skipped', () => {
    const raw = [
      '---', 'scope: project', '---', '# Relations: project', '', '## Relations', '',
      '| source | relation | target | confidence | score | evidence | date |', '|---|---|---|---|---|---|---|',
      '| a:1 | uses | b:1 | INFERRED | 0.8 | e | d |',
      '| a:2 | uses | b:1 | INFERRED | 0.8 |',
      '| a:3 | uses | b:1 | EXTRACTED | 0.8 | e | d |',
      '| a:4 | uses | b:1 | INFERRED | high | e | d |', '',
    ].join('\n');
    const f = parseLedger('p.md', raw);
    expect(f.relations.map((r) => r.source)).toEqual(['a:1']);
    expect(f.relations[0].line).toBe(10);
    expect(f.invalid.map((i) => i.line)).toEqual([11, 12, 13]);
  });

  it('Review Focus 1: padded, hand-aligned cells parse trimmed, and an unchanged padded row is not rewritten', () => {
    const raw = [
      '---', 'scope: project', '---', '# Relations: project', '', '## Relations', '',
      '| source | relation | target | confidence | score | evidence | date |', '|---|---|---|---|---|---|---|',
      '|  a:1   | uses     | b:1    | INFERRED   | 0.80  | e        | d    |', '',
    ].join('\n');
    expect(parseLedger('p.md', raw).relations[0]).toMatchObject({ source: 'a:1', score: 0.8, evidence: 'e' });
    const { text, stats } = applyLedgerChanges(raw, 'project', { relations: [{ source: 'a:1', relation: 'uses', target: 'b:1', confidence: 'INFERRED', score: 0.8, evidence: 'e', date: 'd' }] });
    expect(text).toBe(raw);
    expect(stats.relations.unchanged).toBe(1);
  });

  it('FR-015: a section without a table header (fixture shape) parses empty and gains a table on insert', () => {
    const raw = '---\nscope: project\n---\n# Relations: project\n\n## Coverage\n';
    expect(parseLedger('project.md', raw).coverage).toEqual([]);
    const { text } = applyLedgerChanges(raw, 'project', { coverage: [{ unit: 'u', hash: 'h', version: 1, date: 'd' }] });
    expect(parseLedger('project.md', text).coverage.map((c) => c.unit)).toEqual(['u']);
    expect(text).toContain('| unit | hash | version | date |\n|---|---|---|---|\n| u | h | 1 | d |');
  });

  it('FR-015: a new ledger ends with exactly one newline after the last row', () => {
    const { text } = applyLedgerChanges(undefined, 'project', { coverage: [{ unit: 'u', hash: 'h', version: 1, date: 'd' }] });
    expect(text.endsWith('| u | h | 1 | d |\n')).toBe(true);
    expect(applyLedgerChanges(undefined, 'project', {}).text.endsWith('|---|---|---|---|\n')).toBe(true);
  });

  it('FR-019: an empty last cell parses, with or without a closing pipe', () => {
    const head = '---\nscope: p\n---\n## Concepts\n\n| id | label | summary |\n|---|---|---|\n';
    expect(parseLedger('p.md', head + '| c:1 | L |  |\n').concepts[0]).toMatchObject({ id: 'c:1', summary: '' });
    expect(parseLedger('p.md', head + '| c:1 | L | S').concepts[0]).toMatchObject({ summary: 'S' });
    expect(parseLedger('p.md', head + '| c:1 | L |\n').invalid.length).toBe(1);
  });

  it('FR-015: a missing section is appended at the end of the file', () => {
    const raw = '---\nscope: p\n---\n# Relations: p\n\n## Concepts\n\n| id | label | summary |\n|---|---|---|\n';
    const { text, stats } = applyLedgerChanges(raw, 'p', { coverage: [{ unit: 'u', hash: 'h', version: 1, date: 'd' }] });
    expect(stats.coverage.added).toBe(1);
    expect(text.startsWith(raw)).toBe(true);
    expect(text.slice(raw.length)).toBe('\n## Coverage\n\n| unit | hash | version | date |\n|---|---|---|---|\n| u | h | 1 | d |\n');
  });
});
