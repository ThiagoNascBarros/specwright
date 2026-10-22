import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import { registerPackContext } from './tools/pack-context.js';

/** Registers the tools of the context module. */
export function register(server: McpServer, config: Config) {
  registerPackContext(server, config);
}
