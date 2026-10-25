import { slugify } from '../storage/slug.js';
import type { Communities } from './community.js';
import type { ExportFile, Graph, GraphNode } from './types.js';

const SLUG_CHARS = 80;
const ALIAS_CHARS = 60;

/** The vault: one note per non-file node and one note per community (plan.md "Exports"). Paths are root-relative; writeExport owns the manifest. */
export function renderVault(graph: Graph, communities: Communities, vaultDir: string): ExportFile[] {
  const nodes = [...graph.nodes.values()].filter((n) => n.kind !== 'file');
  const slugs = new Map<string, string>();
  const issued = new Set<string>();
  for (const n of nodes) {
    const base = slugify(n.id.slice(n.id.indexOf(':') + 1), SLUG_CHARS) || 'item';
    const key = `${n.kind}/${base}`;
    let slug = key;
    for (let count = 2; issued.has(slug); count++) slug = `${key}-${count}`;
    issued.add(slug);
    slugs.set(n.id, slug);
  }
  const link = (id: string): string => slugs.get(id)!;
  const notePath = (id: string): string => `${vaultDir}/${link(id)}.md`;
  const files: ExportFile[] = [];

  for (const n of nodes) {
    files.push({ path: notePath(n.id), content: noteOf(graph, communities, n, link) });
  }
  for (const c of communities.list) {
    const members = c.members.map((id) => graph.nodes.get(id)!).filter((n) => n.kind !== 'file');
    const body = members.map((m) => `- [[${link(m.id)}|${alias(m.label)}]]`);
    files.push({ path: `${vaultDir}/_community-${c.id}.md`, content: `# ${c.label}\n\n${body.join('\n')}\n` });
  }
  return files;
}

function noteOf(graph: Graph, communities: Communities, n: GraphNode, link: (id: string) => string): string {
  const fm = [
    '---',
    `id: ${JSON.stringify(n.id)}`,
    `kind: ${JSON.stringify(n.kind)}`,
    ...(n.feature !== undefined ? [`feature: ${JSON.stringify(n.feature)}`] : []),
    `community: ${communities.byNode.get(n.id)!}`,
    ...(n.path !== undefined ? [`source: ${JSON.stringify(n.path)}`] : []),
    ...(n.line !== undefined ? [`line: ${n.line}`] : []),
    ...(n.tags !== undefined && n.tags.length > 0 ? [`tags: ${JSON.stringify(n.tags)}`] : []),
    '---',
  ];
  const excerpt = n.text.replace(/#(?=\S)/g, '\\#');
  const links = (graph.out.get(n.id) ?? []).map((i) => {
    const e = graph.edges[i];
    const target = graph.nodes.get(e.target)!;
    const suffix = e.confidence === 'EXTRACTED' ? '' : ` (${e.confidence} ${e.score})`;
    if (target.kind === 'file') return `- ${e.relation} \`${target.label}\`${suffix}`;
    return `- ${e.relation} [[${link(target.id)}|${alias(target.label)}]]${suffix}`;
  });
  const body = [`# ${n.label}`, '', excerpt, '', '## Links', '', ...links];
  if (n.path !== undefined) body.push('', `Source: \`${n.path}\``);
  return `${fm.join('\n')}\n\n${body.join('\n')}\n`;
}

/** Wikilink alias: no pipes or brackets, at most 60 characters. */
function alias(label: string): string {
  return label.replace(/[|[\]]/g, ' ').slice(0, ALIAS_CHARS);
}
