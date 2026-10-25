import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { SpecwrightError, tool } from '../../errors.js';
import { communitiesOf, loadGraph } from '../service.js';
import { bridges, cohesion, godNodes, suggestQuestions, surprisingConnections } from '../analyze.js';
import { degree } from '../graph.js';
import { pendingUnits } from '../extraction.js';
import { graphReportInput } from '../schemas.js';
import type { Graph } from '../types.js';

const DEFAULT_TOP = 10;
const COMMUNITY_LIST = 20;
const COMMUNITY_TOP_MEMBERS = 3;
const DEFAULT_LIMIT = 50;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Counts per key, with keys in plain string order (FR-026). */
function countBy(items: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const k of items) counts.set(k, (counts.get(k) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => cmp(a, b)));
}

/** Summarizes the project graph, or drills into one community (plan.md Tool contracts, graph_report). */
export async function runGraphReport(config: Config, _deps: Deps, args: z.infer<typeof graphReportInput>): Promise<Record<string, unknown>> {
  const graph = await loadGraph(config);
  const comms = communitiesOf(graph);
  const top = args.top ?? DEFAULT_TOP;

  if (args.community !== undefined) {
    const count = comms.list.length;
    if (args.community >= count) {
      throw new SpecwrightError('INVALID_INPUT', `Unknown community ${args.community}.`, `Communities: 0..${count - 1}`);
    }
    const community = comms.list[args.community];
    const offset = args.offset ?? 0;
    const limit = args.limit ?? DEFAULT_LIMIT;
    const members = community.members.map((id) => ({ id, kind: graph.nodes.get(id)!.kind, label: graph.nodes.get(id)!.label, degree: degree(graph, id) }));
    return {
      community: {
        id: community.id,
        label: community.label,
        size: community.members.length,
        cohesion: cohesion(graph, community.members),
        members: members.slice(offset, offset + limit),
        bridges: bridges(graph, comms, community.id),
      },
      offset,
      limit,
    };
  }

  const nodes = [...graph.nodes.values()];
  const pending = pendingUnits(graph).length;
  const units = graph.units.size;
  return {
    stats: stats(graph, nodes.map((n) => n.kind), comms.list.length, { units, pending, covered: units - pending }),
    god_nodes: godNodes(graph, top),
    communities: comms.list.slice(0, COMMUNITY_LIST).map((c) => ({
      id: c.id,
      label: c.label,
      size: c.members.length,
      top: [...c.members].sort((a, b) => degree(graph, b) - degree(graph, a) || cmp(a, b)).slice(0, COMMUNITY_TOP_MEMBERS),
    })),
    surprising: surprisingConnections(graph, comms, top),
    questions: suggestQuestions(graph, comms),
  };
}

function stats(graph: Graph, kinds: string[], communities: number, extraction: { units: number; pending: number; covered: number }): Record<string, unknown> {
  return {
    nodes: graph.nodes.size,
    edges: graph.edges.length,
    by_kind: countBy(kinds),
    by_relation: countBy(graph.edges.map((e) => e.relation)),
    by_confidence: countBy(graph.edges.map((e) => e.confidence)),
    communities,
    extraction,
  };
}

export function registerGraphReport(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'graph_report',
    {
      description:
        'Summarize the project graph: size, the most connected nodes, communities of related items, surprising cross-links, pending extraction work and suggested questions. Pass a community id to list its members and bridges.',
      inputSchema: graphReportInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof graphReportInput>) => runGraphReport(config, deps, args)),
  );
}
