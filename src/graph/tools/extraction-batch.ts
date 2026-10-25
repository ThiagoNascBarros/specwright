import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import type { Deps } from '../../deps.js';
import { tool } from '../../errors.js';
import { featureDir } from '../../features/repository.js';
import { contentHash } from '../../storage/hash.js';
import { candidatesFor, pendingUnits, planBatches } from '../extraction.js';
import { EXTRACTION_INSTRUCTIONS } from '../instructions.js';
import { unitContent } from '../units.js';
import { readSource } from '../repository.js';
import { loadGraph } from '../service.js';
import { extractionBatchInput } from '../schemas.js';
import { EXTRACTOR_VERSION } from '../types.js';
import type { Graph, Unit } from '../types.js';

const RESPONSE_OVERHEAD_CHARS = 9000; // room for the instructions and envelope (plan.md Tool contracts)
const MIN_BUDGET = 500;

type Item = { unit: string; node: string; title: string; hash: string; content: string };

/** The unit's current text read from disk, or undefined when the unit is gone since the graph was loaded. */
async function currentContent(config: Config, unit: Unit): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await readSource(config.root, unit.path, config.graph.include);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  return unitContent(raw, unit);
}

/** Plans pending work, or returns the content of the given units with their candidate ids (plan.md "Tool contracts"). */
export async function runExtractionBatch(config: Config, _deps: Deps, args: z.infer<typeof extractionBatchInput>): Promise<Record<string, unknown>> {
  const { feature } = args;
  if (feature !== undefined) await featureDir(config.root, feature);
  const graph: Graph = await loadGraph(config);
  const budget = Math.max(MIN_BUDGET, Math.min(args.budget_tokens ?? 2500, Math.floor((config.maxResponseChars - RESPONSE_OVERHEAD_CHARS) / 4)));

  if (args.units === undefined) {
    const inScope = [...graph.units.values()].filter((u) => feature === undefined || u.scope === feature).length;
    const pending = pendingUnits(graph, feature);
    return { version: EXTRACTOR_VERSION, units: inScope, pending: pending.length, batches: planBatches(pending, budget, args.limit ?? 50) };
  }

  const requested = [...new Set(args.units)];
  const found: Array<{ unit: Unit; item: Item }> = [];
  for (const id of requested) {
    const unit = graph.units.get(id);
    if (!unit) continue;
    const content = await currentContent(config, unit);
    if (content !== undefined) found.push({ unit, item: { unit: unit.id, node: unit.node, title: unit.title, hash: contentHash(content), content } });
  }

  // Greedy in request order: an item is kept when the response still fits with no candidates; the ids not kept are deferred.
  const max = config.maxResponseChars;
  const shell = (items: Item[], candidates: Array<[string, string]>, kept: Set<string>) => {
    const deferred = requested.filter((id) => !kept.has(id));
    return { version: EXTRACTOR_VERSION, instructions: EXTRACTION_INSTRUCTIONS, items, candidates, deferred };
  };
  const fits = (value: unknown): boolean => JSON.stringify(value).length <= max;
  const items: Item[] = [];
  const keptIds = new Set<string>();
  for (const { unit, item } of found) {
    const trial = new Set([...keptIds, unit.id]);
    if (fits(shell([...items, item], [], trial))) {
      items.push(item);
      keptIds.add(unit.id);
    }
  }

  const keptUnits = items.map((i) => graph.units.get(i.unit)!);
  const all = candidatesFor(graph, keptUnits);
  const candidates: Array<[string, string]> = [];
  for (const c of all) {
    if (!fits(shell(items, [...candidates, c], keptIds))) break;
    candidates.push(c);
  }

  const out: Record<string, unknown> = shell(items, candidates, keptIds);
  if ((out.deferred as string[]).length === 0) delete out.deferred;
  return out;
}

export function registerExtractionBatch(server: McpServer, config: Config, deps: Deps) {
  server.registerTool(
    'extraction_batch',
    {
      description:
        'Plan or fetch semantic extraction work for you, the agent: without units it lists pending sections grouped into batches, and with units it returns their content, instructions and the ids you may link. Save what you find with save_relations, including the covered hashes, so the same content is never analyzed twice.',
      inputSchema: extractionBatchInput,
      annotations: { openWorldHint: false, readOnlyHint: true },
    },
    tool(config.maxResponseChars, (args: z.infer<typeof extractionBatchInput>) => runExtractionBatch(config, deps, args)),
  );
}
