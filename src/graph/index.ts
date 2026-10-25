import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import { registerFindPath } from './tools/find-path.js';
import { registerGetNode } from './tools/get-node.js';
import { registerQueryGraph } from './tools/query-graph.js';

/** Registers the tools of the graph module. */
export function register(server: McpServer, config: Config, deps: Deps) {
  registerQueryGraph(server, config, deps);
  registerGetNode(server, config, deps);
  registerFindPath(server, config, deps);
}
