import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { tool } from '../../errors.js';
import { assertValid, readAllSpecs, readSpec } from '../repository.js';
import { specIdSchema } from '../schemas.js';
import type { Spec } from '../types.js';

const openOf = (spec: Spec) =>
  spec.criteria.filter((c) => !c.done).map((c) => ({ spec_id: spec.id, ac_id: c.id, text: c.text }));

export function registerListOpenRequirements(server: McpServer, config: Config) {
  server.registerTool(
    'list_open_requirements',
    {
      description:
        'List acceptance criteria not met yet, for one spec or for all valid specs. Use it to decide what to implement next or what is still missing.',
      inputSchema: z.object({ spec_id: specIdSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ spec_id }: { spec_id?: string }) => {
      if (spec_id) {
        const { spec } = await readSpec(config.root, spec_id);
        assertValid(spec);
        return { open: openOf(spec) };
      }
      const specs = await readAllSpecs(config.root);
      return { open: specs.filter((s) => s.valid).flatMap(openOf) };
    }),
  );
}
