import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { findSection } from '../parser.js';
import { readSpec } from '../repository.js';
import { specIdSchema } from '../schemas.js';

export function registerGetSpec(server: McpServer, config: Config) {
  server.registerTool(
    'get_spec',
    {
      description:
        'Return one spec, or only one of its sections such as "acceptance-criteria", so you read no more than you need. Use it before implementing and whenever you need the exact requirements.',
      inputSchema: z.object({ spec_id: specIdSchema, section: z.string().min(1).optional() }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ spec_id, section }: { spec_id: string; section?: string }) => {
      const { spec } = await readSpec(config.root, spec_id);
      const base = { id: spec.id, title: spec.title, status: spec.status };
      if (section === undefined) return { ...base, content: spec.body };
      const found = findSection(spec, section);
      if (!found) {
        throw new SpecwrightError(
          'SECTION_NOT_FOUND',
          `Section "${section}" not found in spec "${spec.id}".`,
          `Available sections: ${spec.sections.map((s) => s.key).join(', ') || '(none)'}.`,
        );
      }
      return { ...base, section: found.key, content: found.content };
    }),
  );
}
