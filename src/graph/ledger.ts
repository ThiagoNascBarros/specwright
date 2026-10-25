import { normalizeKey, parseDocument } from '../storage/markdown.js';
import { RELATIONS_DIR } from './types.js';
import type { ConceptRow, CoverageRow, LedgerFacts, RelationRow } from './types.js';

type TableName = 'concepts' | 'relations' | 'coverage';
export type LedgerChanges = {
  concepts?: Array<Omit<ConceptRow, 'line'>>;
  relations?: Array<Omit<RelationRow, 'line'>>;
  coverage?: Array<Omit<CoverageRow, 'line'>>;
};
type Stats = Record<TableName, { added: number; updated: number; unchanged: number }>;

const TABLES: Record<TableName, { title: string; cols: string[] }> = {
  concepts: { title: 'Concepts', cols: ['id', 'label', 'summary'] },
  relations: { title: 'Relations', cols: ['source', 'relation', 'target', 'confidence', 'score', 'evidence', 'date'] },
  coverage: { title: 'Coverage', cols: ['unit', 'hash', 'version', 'date'] },
};
const NAMES = Object.keys(TABLES) as TableName[];
const CONFIDENCES = new Set(['INFERRED', 'AMBIGUOUS', 'REJECTED']);
const SEPARATOR = /^\|[\s:|-]*-[\s:|-]*$/;

export const ledgerPath = (scope: string): string => `${RELATIONS_DIR}/${scope}.md`;
export const escapeCell = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ').trim();
export const unescapeCell = (s: string): string => s.replace(/\\([\\|])/g, '$1');
export const formatScore = (n: number): string => String(Math.round(n * 100) / 100);

/** Splits a table line on unescaped pipes; cells stay escaped and trimmed. */
function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '');
  const cells: string[] = [];
  let cur = '';
  let closed = false;
  for (let i = 0; i < body.length; i++) {
    closed = false;
    if (body[i] === '\\' && i + 1 < body.length) cur += body[i] + body[++i];
    else if (body[i] === '|') { cells.push(cur.trim()); cur = ''; closed = true; } else cur += body[i];
  }
  if (!closed) cells.push(cur.trim()); // no closing pipe: the text after the last pipe is a cell, even if empty
  return cells;
}

const cmpKeys = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const keyOf = (name: TableName, cells: string[]): string =>
  (name === 'relations' ? cells.slice(0, 3) : cells.slice(0, 1)).map(unescapeCell).join('\u0000');

/** Row cells as written to disk. */
function rowCells(name: TableName, row: Record<string, unknown>): string[] {
  return TABLES[name].cols.map((c) => escapeCell(c === 'score' ? formatScore(row[c] as number) : String(row[c])));
}

interface Located { lines: string[]; start: number; end: number } // section: heading index .. exclusive end
function sections(lines: string[]): Map<TableName, Located> {
  const out = new Map<TableName, Located>();
  let i = 0;
  if (lines[0]?.trim() === '---') { i = lines.findIndex((l, n) => n > 0 && l.trim() === '---') + 1; if (i === 0) i = lines.length; }
  let open: { name: TableName; start: number } | undefined;
  const close = (end: number): void => { if (open) out.set(open.name, { lines, start: open.start, end }); };
  for (; i < lines.length; i++) {
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if (!m) continue;
    close(i);
    const key = normalizeKey(m[1]) as TableName;
    open = NAMES.includes(key) && !out.has(key) ? { name: key, start: i } : undefined;
  }
  close(lines.length);
  return out;
}

/** Table lines of a section: the index of the separator (or -1) and the data lines after it. */
function tableOf(sec: Located): { sep: number; rows: number[] } {
  const bar: number[] = [];
  for (let i = sec.start + 1; i < sec.end; i++) if (sec.lines[i].startsWith('|')) bar.push(i);
  const hasHeader = bar.length > 1 && SEPARATOR.test(sec.lines[bar[1]]);
  const sepAt = SEPARATOR.test(sec.lines[bar[0]] ?? '') ? 0 : hasHeader ? 1 : -1;
  return { sep: sepAt < 0 ? -1 : bar[sepAt], rows: bar.slice(sepAt + 1) };
}

export function parseLedger(path: string, raw: string): LedgerFacts {
  const fm = parseDocument(raw).frontmatter as { scope?: unknown } | undefined;
  const scope = typeof fm?.scope === 'string' ? fm.scope : (path.split('/').pop() ?? '').replace(/\.md$/, '');
  const facts: LedgerFacts = { scope, concepts: [], relations: [], coverage: [], invalid: [] };
  const lines = raw.split('\n').map((l) => l.replace(/\r$/, ''));
  for (const [name, sec] of sections(lines)) {
    for (const idx of tableOf(sec).rows) {
      const line = idx + 1;
      const cells = splitRow(lines[idx]);
      const bad = (reason: string): void => { facts.invalid.push({ line, reason }); };
      if (cells.length !== TABLES[name].cols.length) { bad(`expected ${TABLES[name].cols.length} cells, found ${cells.length}`); continue; }
      const [a, b, c, d, e, f, g] = cells.map(unescapeCell);
      if (!a) { bad('missing id'); continue; }
      if (name === 'concepts') facts.concepts.push({ id: a, label: b, summary: c, line });
      else if (name === 'relations') {
        if (!b || !c) bad('missing relation or target');
        else if (!CONFIDENCES.has(d)) bad(`unknown confidence "${d}"`);
        else if (e === '' || !Number.isFinite(Number(e))) bad(`score "${e}" is not a number`);
        else facts.relations.push({ source: a, relation: b, target: c, confidence: d, score: Number(e), evidence: f, date: g, line });
      } else if (c === '' || !Number.isFinite(Number(c))) bad(`version "${c}" is not a number`);
      else facts.coverage.push({ unit: a, hash: b, version: Number(c), date: d, line });
    }
  }
  return facts;
}

const tableLines = (name: TableName): string[] => {
  const cols = TABLES[name].cols;
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`];
};
const render = (cells: string[]): string => `| ${cells.join(' | ')} |`;
// Compares cells as written, with the score normalized so `0.80` equals `0.8`.
const normalize = (name: TableName, cells: string[]): string[] =>
  name === 'relations' && cells[4] !== '' && Number.isFinite(Number(cells[4])) ? cells.map((c, i) => (i === 4 ? formatScore(Number(c)) : c)) : cells;

export function applyLedgerChanges(raw: string | undefined, scope: string, changes: LedgerChanges): { text: string; stats: Stats } {
  const eol = raw !== undefined && /^[^\n]*\r\n/.test(raw) ? '\r\n' : '\n';
  const lines = (raw ?? [
    '---', `scope: ${scope}`, '---', `# Relations: ${scope}`, '',
    'Written by Specwright `save_relations`; rows may be edited by hand. Kept sorted.', '',
  ].join('\n') + '\n').split('\n').map((l) => l.replace(/\r$/, ''));
  if (raw === undefined) for (const n of NAMES) lines.splice(lines.length - 1, 0, `## ${TABLES[n].title}`, '', ...tableLines(n), '');
  const stats = Object.fromEntries(NAMES.map((n) => [n, { added: 0, updated: 0, unchanged: 0 }])) as Stats;

  for (const name of NAMES) {
    const incoming = ((changes[name] ?? []) as Array<Record<string, unknown>>)
      .map((r) => rowCells(name, r)).sort((x, y) => cmpKeys(keyOf(name, x), keyOf(name, y)));
    for (const cells of incoming) {
      const key = keyOf(name, cells);
      let sec = sections(lines).get(name);
      if (!sec) { // missing section: append it
        if (lines[lines.length - 1] === '') lines.pop();
        lines.push('', `## ${TABLES[name].title}`, '', ...tableLines(name), '');
        sec = sections(lines).get(name)!;
      }
      let { sep, rows } = tableOf(sec);
      if (sep < 0) { // heading without a table: add header and separator right after it
        lines.splice(sec.start + 1, 0, '', ...tableLines(name));
        sec = sections(lines).get(name)!;
        ({ sep, rows } = tableOf(sec));
      }
      const parsed = rows.map((i) => ({ i, cells: splitRow(lines[i]) })).filter((r) => r.cells.length === cells.length);
      const hit = parsed.find((r) => keyOf(name, r.cells) === key);
      if (hit) {
        const same = normalize(name, hit.cells).join('\u0001') === cells.join('\u0001');
        if (same) stats[name].unchanged++;
        else { lines[hit.i] = render(cells); stats[name].updated++; }
      } else {
        const next = parsed.find((r) => keyOf(name, r.cells) > key);
        lines.splice(next ? next.i : (parsed.length ? parsed[parsed.length - 1].i : sep) + 1, 0, render(cells));
        stats[name].added++;
      }
    }
  }
  if (raw === undefined && lines.at(-2) === '') lines.splice(-2, 1); // one newline after the last row
  return { text: lines.join(eol), stats };
}
