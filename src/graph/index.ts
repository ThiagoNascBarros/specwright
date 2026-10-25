import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import { registerFindPath } from './tools/find-path.js';
import { registerGetNode } from './tools/get-node.js';
import { registerQueryGraph } from './tools/query-graph.js';
import { registerExtractionBatch } from './tools/extraction-batch.js';
import { registerSaveRelations } from './tools/save-relations.js';
import { registerGraphReport } from './tools/graph-report.js';

/** Registers the tools of the graph module. */
export function register(server: McpServer, config: Config, deps: Deps) {
  registerQueryGraph(server, config, deps);
  registerGetNode(server, config, deps);
  registerFindPath(server, config, deps);
  registerExtractionBatch(server, config, deps);
  registerSaveRelations(server, config, deps);
  registerGraphReport(server, config, deps);
}
