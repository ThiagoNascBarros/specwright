import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { SpecwrightError, tool } from '../../errors.js';
import { parseUnifiedDiff } from '../diff.js';
import { assertValid, readFeature } from '../repository.js';
import { featureIdSchema } from '../schemas.js';

export function registerCheckAgainstSpec(server: McpServer, config: Config) {
  server.registerTool(
    'check_against_spec',
    {
      description:
        'Before declaring work done, send your unified diff and the feature id to get its requirements, success criteria, user stories with acceptance scenarios, edge cases, open tasks and a summary of the changed files. Compare them yourself and report what is missing or out of scope.',
      inputSchema: z.object({ feature: featureIdSchema, diff: z.string().max(5_000_000) }),
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ feature, diff }: { feature: string; diff: string }) => {
      const { feature: f } = await readFeature(config.root, feature);
      assertValid(f);
      const diff_summary = parseUnifiedDiff(diff);
      if (diff_summary.files.length === 0) {
        throw new SpecwrightError('INVALID_DIFF', 'The diff has no file headers.', 'Pass the output of `git diff` (unified format).');
      }
      const spec = f.spec!;
      return {
        feature: f.id,
        title: f.title,
        status: f.status,
        requirements: spec.requirements,
        success_criteria: spec.successCriteria,
        user_stories: spec.userStories,
        edge_cases: spec.edgeCases,
        assumptions: spec.assumptions,
        open_clarifications: spec.clarifications,
        tasks: {
          open: f.tasks.filter((t) => !t.done).map((t) => ({ id: t.id, ...(t.story ? { story: t.story } : {}), text: t.text })),
          done: f.tasks.filter((t) => t.done).length,
          total: f.tasks.length,
        },
        diff_summary,
      };
    }),
  );
}
