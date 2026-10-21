import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import { registerListDecisions } from './tools/list-decisions.js';
import { registerLogDecision } from './tools/log-decision.js';

/** Registers the tools of the decisions module. */
export function register(server: McpServer, config: Config, deps: Deps) {
  registerLogDecision(server, config, deps);
  registerListDecisions(server, config);
}
