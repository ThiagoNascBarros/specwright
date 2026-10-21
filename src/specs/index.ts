import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../config.js';
import { registerGetSpec } from './tools/get-spec.js';
import { registerListOpenRequirements } from './tools/list-open-requirements.js';
import { registerListSpecs } from './tools/list-specs.js';
import { registerSetCriterionStatus } from './tools/set-criterion-status.js';

/** Registers the tools of the specs module. */
export function register(server: McpServer, config: Config) {
  registerListSpecs(server, config);
  registerGetSpec(server, config);
  registerListOpenRequirements(server, config);
  registerSetCriterionStatus(server, config);
}
