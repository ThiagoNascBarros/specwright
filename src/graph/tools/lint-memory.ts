import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { lintGraph } from '../lint.js';
import { loadGraph } from '../service.js';
import { lintMemoryInput } from '../schemas.js';

const DEFAULT_LIMIT = 100;

/** Lists broken links, dangling relations, invalid rows and other memory issues (plan.md Tool contracts, lint_memory). */
export async function runLintMemory(config: Config, _deps: Deps, args: z.infer<typeof lintMemoryInput>): Promise<Record<string, unknown>> {
  if (args.feature !== undefined) await featureDir(config.root, args.feature);
  const graph = await loadGraph(config);
  const issues = lintGraph(graph, args.feature);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity] += 1;
  return { counts, issues: issues.slice(0, args.limit ?? DEFAULT_LIMIT) };
}

export function registerLintMemory(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'lint_memory',
    {
      description:
        'Check the project memory and graph for broken or ambiguous links, relations that point at missing nodes, invalid ledger rows, contradictions and orphans, each with the file, line and a fix. Run it after renaming, moving or deleting files.',
      inputSchema: lintMemoryInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof lintMemoryInput>) => runLintMemory(config, deps, args)),
  );
}
