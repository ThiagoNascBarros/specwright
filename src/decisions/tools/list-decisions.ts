import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { specIdSchema } from '../../specs/schemas.js';
import { readDecisions } from '../repository.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be YYYY-MM-DD');

export function registerListDecisions(server: McpServer, config: Config) {
  server.registerTool(
    'list_decisions',
    {
      description:
        'List recorded decisions, optionally for one spec or between two dates (inclusive, YYYY-MM-DD). Use it to check what was already decided before changing an approach.',
      inputSchema: z.object({ spec_id: specIdSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional() }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ spec_id, from, to }: { spec_id?: string; from?: string; to?: string }) => {
      if (from && to && from > to) throw new SpecwrightError('INVALID_INPUT', '"from" is later than "to".');
      const decisions = (await readDecisions(config.root)).filter(
        (d) => (!spec_id || d.spec_id === spec_id) && (!from || d.date >= from) && (!to || d.date <= to),
      );
      return { decisions: decisions.map(({ id, spec_id, title, date, status, path }) => ({ id, spec_id, title, date, status, path })) };
    }),
  );
}
