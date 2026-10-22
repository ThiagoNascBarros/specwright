import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import type { Config } from './config.js';
import * as context from './context/index.js';
import * as decisions from './decisions/index.js';
import { defaultDeps, type Deps } from './deps.js';
import * as memory from './memory/index.js';
import * as specs from './specs/index.js';

// Relative to this module, not cwd: the client may launch us from anywhere.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

/** Builds the MCP server with every module's tools. The only place that knows all modules. */
export function createServer(config: Config, deps: Deps = defaultDeps): McpServer {
  const server = new McpServer({ name: 'specwright', version });
  specs.register(server, config);
  decisions.register(server, config, deps);
  memory.register(server, config, deps);
  context.register(server, config);
  return server;
}
