import type { Communities } from './community.js';
import { godNodes, suggestQuestions, surprisingConnections } from './analyze.js';
import { mermaidFlowchart } from './mermaid.js';
import { pendingUnits } from './extraction.js';
import type { Issue } from './lint.js';
import { GRAPH_DIR } from './types.js';
import type { ExportFile, Graph } from './types.js';

const TOP_COMMUNITIES = 10;
const TOP_LIST = 10;

/** GRAPH_REPORT.md: stats, most connected, communities with Mermaid, surprises, questions, health and extraction (plan.md "Exports"). */
export function renderReport(graph: Graph, communities: Communities, issues: Issue[]): ExportFile {
  const pending = pendingUnits(graph).length;
  const units = graph.units.size;
  const lines: string[] = ['# Project graph', '', '| Stat | Count |', '|---|---|', `| Nodes | ${graph.nodes.size} |`, `| Edges | ${graph.edges.length} |`, `| Communities | ${communities.list.length} |`, ''];

  lines.push('## Most connected', '', '| Node | Kind | Degree |', '|---|---|---|');
  for (const g of godNodes(graph, TOP_LIST)) lines.push(`| ${g.label} (\`${g.id}\`) | ${g.kind} | ${g.degree} |`);
  lines.push('');

  lines.push('## Communities', '');
  for (const c of communities.list.slice(0, TOP_COMMUNITIES)) {
    const members = new Set(c.members);
    const nodes = c.members.map((id) => graph.nodes.get(id)!);
    const edges = graph.edges.filter((e) => members.has(e.source) && members.has(e.target));
    lines.push(`### ${c.id}. ${c.label} (${c.members.length})`, '', '```mermaid', mermaidFlowchart(nodes, edges), '```', '');
    lines.push('<details>', '', ...edges.map((e) => `- \`${e.source}\` ${e.relation} \`${e.target}\``), '', '</details>', '');
  }

  lines.push('## Surprising connections', '');
  for (const s of surprisingConnections(graph, communities, TOP_LIST)) lines.push(`- ${s.score}: \`${s.edge.join(' ')}\` (${s.why})`);
  lines.push('', '## Suggested questions', '');
  for (const q of suggestQuestions(graph, communities)) lines.push(`- ${q.question}`);

  lines.push('', '## Health', '');
  const byKind = new Map<string, number>();
  for (const i of issues) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  if (byKind.size === 0) lines.push('No issues.');
  for (const [kind, count] of [...byKind.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) lines.push(`- ${kind}: ${count}`);

  lines.push('', '## Extraction', '', `- Pending: ${pending}`, `- Covered: ${units - pending}`, '');
  return { path: `${GRAPH_DIR}/GRAPH_REPORT.md`, content: lines.join('\n') };
}
