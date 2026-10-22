import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import { registerCheckAgainstSpec } from './tools/check-against-spec.js';
import { registerGetArtifact } from './tools/get-artifact.js';
import { registerListFeatures } from './tools/list-features.js';
import { registerListOpenTasks } from './tools/list-open-tasks.js';
import { registerSetTaskStatus } from './tools/set-task-status.js';

/** Registers the tools of the features module. */
export function register(server: McpServer, config: Config) {
  registerListFeatures(server, config);
  registerGetArtifact(server, config);
  registerListOpenTasks(server, config);
  registerSetTaskStatus(server, config);
  registerCheckAgainstSpec(server, config);
}
