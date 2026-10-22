import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import { registerGetArtifact } from './tools/get-artifact.js';
import { registerListFeatures } from './tools/list-features.js';

/** Registers the tools of the features module. */
export function register(server: McpServer, config: Config) {
  registerListFeatures(server, config);
  registerGetArtifact(server, config);
}
