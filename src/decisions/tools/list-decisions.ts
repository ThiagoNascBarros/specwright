import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { featureIdSchema } from '../../features/schemas.js';
import { readDecisions } from '../repository.js';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates must be YYYY-MM-DD');

export function registerListDecisions(server: McpServer, config: Config) {
  server.registerTool(
    'list_decisions',
    {
      description:
        'List recorded decisions, optionally for one feature or between two dates (inclusive, YYYY-MM-DD). Use it to check what was already decided before changing an approach.',
      inputSchema: z.object({ feature: featureIdSchema.optional(), from: dateSchema.optional(), to: dateSchema.optional() }),
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ feature, from, to }: { feature?: string; from?: string; to?: string }) => {
      if (from && to && from > to) throw new SpecwrightError('INVALID_INPUT', '"from" is later than "to".');
      const decisions = (await readDecisions(config.root)).filter(
        (d) => (!feature || d.feature === feature) && (!from || d.date >= from) && (!to || d.date <= to),
      );
      return { decisions: decisions.map(({ id, feature, title, date, status, path }) => ({ id, feature, title, date, status, path })) };
    }),
  );
}
