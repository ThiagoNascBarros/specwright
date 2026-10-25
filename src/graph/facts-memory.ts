import { parseConstitution } from '../constitution/parser.js';
import { parseDecision } from '../decisions/repository.js';
import { parseMemory } from '../memory/repository.js';
import { scanLines, stripComments } from '../storage/markdown.js';
import { citedPaths } from '../storage/text.js';
import { nodeId } from './ids.js';
import { parseLinks } from './links.js';
import { findMentions } from './mentions.js';
import { unitsOf } from './units.js';
import type { FileFacts, GraphNode, SourceKind } from './types.js';

const blank = (m: string) => ' '.repeat(m.length);
// Link targets are not mentions (same rule as facts-feature).
const withoutLinkTargets = (line: string) => line.replace(/\[\[[^\[\]\n]*\]\]/g, blank).replace(/\]\([^)\n]*\)/g, blank);
const body = (raw: string) => stripComments(raw).trim().slice(0, 2000);
const norm = (raw: string) => raw.replace(/\r\n?/g, '\n');

interface Scan { kind: SourceKind; path: string; raw: string; owner: string; scope?: string; ownerAt?: (line: number) => string }

/** Raw mentions, links and paths of every content line; frontmatter, fences and comments are skipped. */
function scan(facts: FileFacts, s: Scan): void {
  const lines = scanLines(s.raw);
  const fm = lines[0]?.text === '---' ? lines.findIndex((l, i) => i > 0 && l.text === '---') : -1;
  lines.forEach(({ text, skip }, i) => {
    if (skip || i <= fm) return;
    const line = i + 1;
    const from = s.ownerAt?.(line) ?? s.owner;
    for (const m of findMentions(withoutLinkTargets(text))) {
      facts.mentions.push((m.type === 'item' || m.type === 'story' || m.type === 'task') && s.scope !== undefined
        ? { from, line, ...m, feature: m.feature ?? s.scope }
        : { from, line, ...m });
    }
    for (const l of parseLinks(text)) facts.links.push({ from, line, form: l.form, target: l.target, ...(l.relation ? { relation: l.relation } : {}) });
    for (const p of citedPaths(text)) facts.paths.push({ from, line, path: p });
  });
}

const empty = (path: string, kind: SourceKind, message: string, feature?: string): FileFacts =>
  ({ path, kind, ...(feature ? { feature } : {}), nodes: [], edges: [], links: [], mentions: [], paths: [], units: [], issues: [{ message }] });

export function constitutionFacts(path: string, rawIn: string): FileFacts {
  const raw = norm(rawIn);
  const c = parseConstitution(raw);
  const id = nodeId.constitution();
  const facts = empty(path, 'constitution', '');
  facts.issues = [];
  const headings = c.sections.map((s) => s.heading);
  facts.nodes.push({ id, kind: 'artifact', label: 'Constitution', path, line: 1, text: headings.join(' · ') });
  const lines = scanLines(raw);
  const starts: Array<{ line: number; id: string }> = [];
  const seen = new Set<string>();
  let from = 0;
  for (const p of c.principles) {
    const pid = nodeId.principle(p.key);
    const at = lines.findIndex((l, i) => i >= from && !l.skip && l.text.replace(/\s+$/, '') === `### ${p.name}`);
    if (at >= 0) from = at + 1;
    const line = at >= 0 ? at + 1 : 1;
    if (seen.has(pid)) { facts.issues.push({ line, message: `duplicate id ${pid}` }); continue; }
    seen.add(pid);
    facts.nodes.push({ id: pid, kind: 'principle', label: p.name, path, line, text: p.content.slice(0, 2000) });
    starts.push({ line, id: pid });
  }
  // A line belongs to the last principle heading above it, unless a higher heading closed it.
  const closers = lines.flatMap((l, i) => (!l.skip && /^#{1,2}\s/.test(l.text) ? [i + 1] : []));
  const ownerAt = (line: number) => {
    const p = [...starts].reverse().find((x) => x.line <= line);
    return p && !closers.some((c2) => c2 > p.line && c2 <= line) ? p.id : id;
  };
  scan(facts, { kind: 'constitution', path, raw, owner: id, ownerAt });
  facts.units = unitsOf({ path, raw, node: id, scope: 'project', title: 'Constitution' });
  return facts;
}

export function decisionFacts(path: string, rawIn: string): FileFacts {
  const raw = norm(rawIn);
  const d = parseDecision(path.split('/').pop() ?? path, raw);
  if (!d) return empty(path, 'decision', 'not a valid decision file');
  const id = nodeId.decision(d.id);
  const node: GraphNode = { id, kind: 'decision', label: d.title, path, line: 1, ...(d.feature ? { feature: d.feature } : {}), text: body(d.body) };
  const facts = { ...empty(path, 'decision', ''), ...(d.feature ? { feature: d.feature } : {}), nodes: [node], issues: [] } as FileFacts;
  if (d.feature) facts.edges.push({ source: id, target: nodeId.feature(d.feature), relation: 'belongs_to', confidence: 'EXTRACTED', score: 1, origin: 'derived', path, line: 1 });
  scan(facts, { kind: 'decision', path, raw, owner: id, scope: d.feature || undefined });
  facts.units = unitsOf({ path, raw, node: id, scope: d.feature || 'project', title: d.title });
  return facts;
}

export function noteFacts(path: string, rawIn: string): FileFacts {
  const raw = norm(rawIn);
  const m = parseMemory(path.split('/').pop() ?? path, raw);
  if (!m) return empty(path, 'note', 'not a valid note file');
  const id = nodeId.note(m.id);
  const facts = empty(path, 'note', '');
  facts.issues = [];
  facts.nodes.push({ id, kind: 'note', label: m.title, path, line: 1, type: m.type, tags: m.tags, text: body(m.body) });
  scan(facts, { kind: 'note', path, raw, owner: id });
  facts.units = unitsOf({ path, raw, node: id, scope: 'project', title: m.title });
  return facts;
}

export function docFacts(path: string, rawIn: string): FileFacts {
  const raw = norm(rawIn);
  const id = nodeId.doc(path);
  const h1 = scanLines(raw).find((l) => !l.skip && /^#\s+\S/.test(l.text))?.text.replace(/^#\s+/, '').replace(/\s*#*\s*$/, '');
  const label = h1 || (path.split('/').pop() ?? path).replace(/\.md$/, '');
  const facts = empty(path, 'doc', '');
  facts.issues = [];
  facts.nodes.push({ id, kind: 'doc', label, path, line: 1, text: body(raw) });
  scan(facts, { kind: 'doc', path, raw, owner: id });
  facts.units = unitsOf({ path, raw, node: id, scope: 'project', title: label });
  return facts;
}
