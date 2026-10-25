import { ITEM_LINE, STORY_LINE, parseSpecification } from '../features/spec-parser.js';
import { contentLines, scanTasks } from '../features/tasks-parser.js';
import { normalizeKey, scanLines } from '../storage/markdown.js';
import { citedPaths } from '../storage/text.js';
import { nodeId } from './ids.js';
import { parseLinks } from './links.js';
import { findMentions } from './mentions.js';
import { unitsOf } from './units.js';
import type { FileFacts, GraphEdge, GraphNode, NodeKind, Relation } from './types.js';

type Kind = 'spec' | 'plan' | 'tasks' | 'research' | 'data-model' | 'quickstart' | 'contract';
const H2 = /^##\s+(.+?)\s*#*\s*$/;
const HEADING = /^#{1,6}\s/;
const short = (s: string) => s.slice(0, 80);
const blank = (m: string) => ' '.repeat(m.length);
// Link targets are not mentions: `[[2026-01-15]]` or `](spec-001-x.md)` must not read as ids.
const withoutLinkTargets = (line: string) => line.replace(/\[\[[^\[\]\n]*\]\]/g, blank).replace(/\]\([^)\n]*\)/g, blank);

/** Nodes, resolvable edges, raw links/mentions/paths and units of one feature artifact (plan.md "Node ids and sources"). */
export function featureFacts(input: { path: string; kind: Kind; feature: string; raw: string }): FileFacts {
  const { path, kind, feature: f } = input;
  const raw = input.raw.replace(/\r\n?/g, '\n');
  const file = path.split('/').pop() ?? path;
  const stem = file.replace(/\.[^.]+$/, '');
  const spec = kind === 'spec' ? parseSpecification(raw) : undefined;
  const title = spec?.title || f;
  const artifactId = nodeId.artifact(f, kind === 'contract' ? `contract/${stem}` : kind);
  const facts: FileFacts = { path, kind, feature: f, nodes: [], edges: [], links: [], mentions: [], paths: [], units: [], issues: [] };
  const seen = new Set<string>();
  const add = (n: Omit<GraphNode, 'feature' | 'path'>) => {
    if (seen.has(n.id)) { facts.issues.push({ line: n.line, message: `duplicate id ${n.id}` }); return false; }
    seen.add(n.id);
    facts.nodes.push({ ...n, feature: f, path });
    return true;
  };
  const edge = (source: string, target: string, relation: Relation, line: number) =>
    facts.edges.push({ source, target, relation, confidence: 'EXTRACTED', score: 1, origin: 'derived', path, line } satisfies GraphEdge);
  const contains = (id: string, line: number) => edge(nodeId.feature(f), id, 'contains', line);

  const lines = kind === 'tasks' ? contentLines(raw) : scanLines(raw);
  const headings = lines.filter((l) => !l.skip).map((l) => H2.exec(l.text)?.[1]).filter((h): h is string => h !== undefined);
  if (kind === 'spec') add({ id: nodeId.feature(f), kind: 'feature', label: title, line: 1, text: `${title}\n${spec!.input}`.trim() });
  add({ id: artifactId, kind: 'artifact', label: `${title} — ${file}`, line: 1, text: headings.join(' · ') });
  contains(artifactId, 1);

  // Per line: owner node and enclosing section.
  const owners = new Map<number, string>();
  const tasks = kind === 'tasks' ? new Map(scanTasks(raw).lines.map((t) => [t.index, t.task])) : undefined;
  let section: { key: string; heading: string } | undefined;
  let owner = artifactId;
  let taskOwner: { id: string; indent: number } | undefined;
  lines.forEach(({ text, skip }, i) => {
    if (skip) return;
    const line = i + 1;
    const h = H2.exec(text);
    if (h) section = { key: normalizeKey(h[1]), heading: h[1] };
    const loc = { line, section: section?.key, heading: section?.heading };
    let lineOwner = owner;
    if (kind === 'spec') {
      const s = STORY_LINE.exec(text);
      const item = ITEM_LINE.exec(text);
      if (s) {
        const id = nodeId.story(f, `US${s[1]}`);
        const scenarios = spec!.userStories.find((u) => u.number === Number(s[1]))?.scenarios ?? [];
        if (add({ id, kind: 'story', label: `US${s[1]} ${s[2]}`, ...loc, text: [s[2], ...scenarios].join('\n') })) contains(id, line);
        owner = lineOwner = id;
      } else if (HEADING.test(text)) owner = lineOwner = artifactId;
      if (item) {
        const req = item[1].startsWith('FR');
        const id = (req ? nodeId.requirement : nodeId.criterion)(f, item[1]);
        if (add({ id, kind: (req ? 'requirement' : 'criterion') as NodeKind, label: `${item[1]} ${short(item[2])}`, ...loc, text: item[2] })) contains(id, line);
        lineOwner = id;
      }
    } else if (tasks) {
      const t = tasks.get(i);
      const indent = text.length - text.trimStart().length;
      if (t) {
        const id = nodeId.task(f, t.id);
        if (add({ id, kind: 'task', label: `${t.id} ${short(t.text)}`, ...loc, done: t.done, text: t.text })) {
          contains(id, line);
          if (t.story) edge(id, nodeId.story(f, t.story), 'implements', line);
        }
        taskOwner = { id, indent };
        lineOwner = id;
      } else if (taskOwner && text.trim() !== '' && indent > taskOwner.indent) lineOwner = taskOwner.id;
      else if (text.trim() !== '') { taskOwner = undefined; lineOwner = artifactId; }
    }
    owners.set(i, lineOwner);
    for (const m of findMentions(withoutLinkTargets(text))) {
      facts.mentions.push(m.type === 'item' || m.type === 'story' || m.type === 'task'
        ? { from: lineOwner, line, ...m, feature: m.feature ?? f }
        : { from: lineOwner, line, ...m });
    }
    for (const l of parseLinks(text)) facts.links.push({ from: lineOwner, line, form: l.form, target: l.target, ...(l.relation ? { relation: l.relation } : {}) });
    for (const p of citedPaths(text)) facts.paths.push({ from: lineOwner, line, path: p });
  });

  if (kind !== 'tasks') facts.units = unitsOf({ path, raw, node: artifactId, scope: f, title: `${title} — ${file}` });
  return facts;
}
