import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { SpecwrightError, tool } from '../../errors.js';
import { localDate } from '../../storage/slug.js';
import { prepareSave } from '../relations.js';
import type { Rejection } from '../relations.js';
import { writeLedgerChanges } from '../repository.js';
import { loadGraph } from '../service.js';
import { saveRelationsInput } from '../schemas.js';

/** The plan's size limits (plan.md "Tool contracts"); they live here because the input schema must stay small. */
function checkLimits(args: z.infer<typeof saveRelationsInput>): void {
  const relations = args.relations ?? [];
  const concepts = args.concepts ?? [];
  const covered = args.covered ?? [];
  if (relations.length + concepts.length + covered.length === 0) {
    throw new SpecwrightError('INVALID_INPUT', 'Nothing to save.', 'Pass at least one of relations, concepts or covered.');
  }
  const bad = relations.length > 200 || concepts.length > 50 || covered.length > 100
    || relations.some((r) => (r.evidence?.length ?? 0) > 200)
    || concepts.some((c) => c.label.length < 1 || c.label.length > 120 || (c.summary?.length ?? 0) > 300);
  if (bad) {
    throw new SpecwrightError('INVALID_INPUT', 'A list or text field is over its limit.', 'relations ≤200, concepts ≤50, covered ≤100; evidence ≤200, label 1..120, summary ≤300 characters.');
  }
}

/** Validates and stores relations, concepts and covered units into the scope ledgers (plan.md "Tool contracts"). */
export async function runSaveRelations(config: Config, deps: Deps, args: z.infer<typeof saveRelationsInput>): Promise<Record<string, unknown>> {
  checkLimits(args);
  const graph = await loadGraph(config);
  const { changes, rejected, origins } = prepareSave(graph, args, localDate(deps.now()));

  const added = { relations: 0, concepts: 0, covered: 0 };
  const updated = { relations: 0, concepts: 0, covered: 0 };
  let unchanged = 0;
  const files: string[] = [];
  const all: Rejection[] = [...rejected];
  for (const [scope, change] of changes) {
    const result = await writeLedgerChanges(config.root, scope, change);
    if (result.written) files.push(result.path);
    const { stats } = result;
    added.relations += stats.relations.added;
    added.concepts += stats.concepts.added;
    added.covered += stats.coverage.added;
    updated.relations += stats.relations.updated;
    updated.concepts += stats.concepts.updated;
    updated.covered += stats.coverage.updated;
    unchanged += stats.relations.unchanged + stats.concepts.unchanged + stats.coverage.unchanged;
    // The ledger's index points into changes.relations; origins maps it back to the caller's input index.
    for (const r of result.rejected) all.push({ field: 'relations', index: origins.get(scope)![r.index], reason: r.reason });
  }
  all.sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : a.index - b.index));
  return { added, updated, unchanged, rejected: all, files };
}

export function registerSaveRelations(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'save_relations',
    {
      description:
        'Store the relations and concepts you extracted (confidence INFERRED or AMBIGUOUS, or REJECTED to retire a wrong one) and mark analyzed units as covered, in Markdown ledgers under .specify/memory/relations/. Invalid items are reported one by one and the valid ones are still saved.',
      inputSchema: saveRelationsInput,
      annotations: { openWorldHint: false, readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof saveRelationsInput>) => runSaveRelations(config, deps, args)),
  );
}
