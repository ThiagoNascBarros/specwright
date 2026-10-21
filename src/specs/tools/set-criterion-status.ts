import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { writeAtomic } from '../../storage/files.js';
import { setCheckbox } from '../editor.js';
import { countCriteria, parseSpec } from '../parser.js';
import { assertValid, readSpec } from '../repository.js';
import { criterionIdSchema, specIdSchema } from '../schemas.js';

export function registerSetCriterionStatus(server: McpServer, config: Config) {
  server.registerTool(
    'set_criterion_status',
    {
      description:
        'Mark one acceptance criterion (AC-n) of a spec as met or not met, editing only its checkbox. Call it after you verified the criterion, never before.',
      inputSchema: z.object({ spec_id: specIdSchema, ac_id: criterionIdSchema, done: z.boolean() }),
      annotations: { idempotentHint: true, destructiveHint: false },
    },
    tool(config.maxResponseChars, async ({ spec_id, ac_id, done }: { spec_id: string; ac_id: string; done: boolean }) => {
      const { spec, path, raw } = await readSpec(config.root, spec_id);
      assertValid(spec);
      const updated = setCheckbox(raw, ac_id, done);
      if (updated === undefined) {
        throw new SpecwrightError(
          'CRITERION_NOT_FOUND',
          `Criterion ${ac_id} not found in spec "${spec_id}".`,
          `Available: ${spec.criteria.map((c) => c.id).join(', ') || '(none)'}.`,
        );
      }
      const changed = updated !== raw;
      if (changed) await writeAtomic(path, updated);
      return { spec_id, ac_id, done, changed, criteria: countCriteria(parseSpec(spec_id, updated).criteria) };
    }),
  );
}
