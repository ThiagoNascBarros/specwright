import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { communitiesOf, loadGraph } from '../service.js';
import { renderGraphJson } from '../export-json.js';
import { renderReport } from '../export-report.js';
import { renderVault } from '../export-obsidian.js';
import { lintGraph } from '../lint.js';
import { packageVersion, writeExport } from '../repository.js';
import { exportGraphInput } from '../schemas.js';

/** Writes one view of the graph to disk and reports what changed (plan.md "Exports"). */
export async function runExportGraph(config: Config, _deps: Deps, args: z.infer<typeof exportGraphInput>): Promise<Record<string, unknown>> {
  const graph = await loadGraph(config);
  const comms = communitiesOf(graph);
  if (args.format === 'obsidian') {
    const vault = config.graph.vaultDir;
    const result = await writeExport(config.root, { kind: 'vault', dir: vault }, renderVault(graph, comms, vault));
    return { format: args.format, path: vault, ...result };
  }
  const file = args.format === 'json'
    ? renderGraphJson(graph, comms, `specwright ${packageVersion()}`)
    : renderReport(graph, comms, lintGraph(graph));
  const result = await writeExport(config.root, { kind: 'file', path: file.path }, [file]);
  return { format: args.format, path: file.path, ...result };
}

export function registerExportGraph(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'export_graph',
    {
      description:
        'Write a view of the project graph for people and other tools: graph.json, a Markdown report with Mermaid diagrams that renders on GitHub, or an Obsidian vault. Use it when someone wants to browse the graph outside the agent.',
      inputSchema: exportGraphInput,
      annotations: { openWorldHint: false, readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof exportGraphInput>) => runExportGraph(config, deps, args)),
  );
}
