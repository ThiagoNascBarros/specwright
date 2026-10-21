import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import type { Config } from './config.js';
import * as specs from './specs/index.js';

export interface Deps {
  /** Clock used for dates written to disk; injectable for tests. */
  now: () => Date;
}

// Relative to this module, not cwd: the client may launch us from anywhere.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

/** Builds the MCP server with every module's tools. The only place that knows all modules. */
export function createServer(config: Config, deps: Deps = { now: () => new Date() }): McpServer {
  const server = new McpServer({ name: 'specwright', version });
  specs.register(server, config);
  void deps;
  return server;
}
