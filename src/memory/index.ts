import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import type { Deps } from '../deps.js';
import { registerSaveMemory } from './tools/save-memory.js';
import { registerSearchMemory } from './tools/search-memory.js';

/** Registers the tools of the memory module. */
export function register(server: McpServer, config: Config, deps: Deps) {
  registerSaveMemory(server, config, deps);
  registerSearchMemory(server, config);
}
