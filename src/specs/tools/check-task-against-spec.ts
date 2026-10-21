import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { parseUnifiedDiff } from '../diff.js';
import { assertValid, readSpec } from '../repository.js';
import { specIdSchema } from '../schemas.js';

export function registerCheckTaskAgainstSpec(server: McpServer, config: Config) {
  server.registerTool(
    'check_task_against_spec',
    {
      description:
        'Before declaring a task done, send your unified diff and the spec id to get the open and met criteria, the out-of-scope items and a summary of the changed files. Compare them yourself and report what is missing or out of scope.',
      inputSchema: z.object({ spec_id: specIdSchema, diff: z.string().max(5_000_000) }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ spec_id, diff }: { spec_id: string; diff: string }) => {
      const { spec } = await readSpec(config.root, spec_id);
      assertValid(spec);
      const diff_summary = parseUnifiedDiff(diff);
      if (diff_summary.files.length === 0) {
        throw new SpecwrightError('INVALID_DIFF', 'The diff has no file headers.', 'Pass the output of `git diff` (unified format).');
      }
      const toItem = (c: { id: string; text: string }) => ({ ac_id: c.id, text: c.text });
      return {
        spec_id: spec.id,
        title: spec.title,
        open_criteria: spec.criteria.filter((c) => !c.done).map(toItem),
        met_criteria: spec.criteria.filter((c) => c.done).map(toItem),
        out_of_scope: spec.outOfScope,
        diff_summary,
      };
    }),
  );
}
