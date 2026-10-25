import { SpecwrightError, errorResult, respond } from '../errors.js';
import type { ToolResult } from '../errors.js';
import { defaultDeps } from '../deps.js';
import { loadConfig } from '../config.js';
import type { Config } from '../config.js';
import { runExportGraph } from '../graph/tools/export-graph.js';
import { runFindPath } from '../graph/tools/find-path.js';
import { runGetNode } from '../graph/tools/get-node.js';
import { runGraphReport } from '../graph/tools/graph-report.js';
import { runLintMemory } from '../graph/tools/lint-memory.js';
import { runQueryGraph } from '../graph/tools/query-graph.js';
import * as schemas from '../graph/schemas.js';
import { parseGraphArgs } from './args.js';

type Runner = (config: Config, deps: typeof defaultDeps, args: never) => Promise<Record<string, unknown>>;
const TOOLS: Record<string, { schema: { safeParse(v: unknown): { success: true; data: unknown } | { success: false } }; run: Runner }> = {
  query_graph: { schema: schemas.queryGraphInput, run: runQueryGraph as Runner },
  get_node: { schema: schemas.getNodeInput, run: runGetNode as Runner },
  find_path: { schema: schemas.findPathInput, run: runFindPath as Runner },
  graph_report: { schema: schemas.graphReportInput, run: runGraphReport as Runner },
  lint_memory: { schema: schemas.lintMemoryInput, run: runLintMemory as Runner },
  export_graph: { schema: schemas.exportGraphInput, run: runExportGraph as Runner },
};

const textOf = (result: ToolResult): string => (result.content[0] as { text: string }).text;

/** Runs one graph command: prints the tool's JSON and returns the exit code (plan.md "CLI"). */
export async function runGraphCli(argv: string[], env: Record<string, string | undefined>, cwd: string, write: (text: string) => void): Promise<number> {
  const parsed = parseGraphArgs(argv);
  if ('usage' in parsed) {
    console.error(parsed.usage);
    return 2;
  }
  const tool = TOOLS[parsed.tool];
  const checked = tool.schema.safeParse(parsed.args);
  if (!checked.success) {
    console.error(`usage: invalid arguments for ${parsed.tool}`);
    return 2;
  }
  let config: Config;
  try {
    config = loadConfig(env, cwd);
  } catch (error) {
    write(`${textOf(errorResult(error))}\n`);
    return 1;
  }
  try {
    const data = await tool.run(config, defaultDeps, checked.data as never);
    write(`${textOf(respond(data, config.maxResponseChars))}\n`);
    return parsed.tool === 'lint_memory' && (data.counts as { error: number }).error > 0 ? 1 : 0;
  } catch (error) {
    write(`${textOf(errorResult(error))}\n`);
    if (error instanceof SpecwrightError && error.code === 'NODE_AMBIGUOUS') return 3;
    if (error instanceof SpecwrightError && error.code === 'NODE_NOT_FOUND') return 4;
    return 1;
  }
}
