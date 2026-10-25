import * as z from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { Config } from '../../config.js';
import { readConstitutionIfSafe as readConstitution } from '../../constitution/repository.js';
import { readDecisions } from '../../decisions/repository.js';
import { SpecwrightError, tool } from '../../errors.js';
import { tokenize } from '../../storage/text.js';
import { readMemories } from '../repository.js';
import { rank } from '../search.js';
import { MEMORY_TYPES } from '../types.js';

export function registerSearchMemory(server: McpServer, config: Config) {
  server.registerTool(
    'search_memory',
    {
      description:
        'Search notes, recorded decisions and the constitution principles in .specify/memory/ by topic, ranked by title, tag and body matches. Use it at the start of a task to recover what earlier sessions learned or decided.',
      inputSchema: z.object({
        query: z.string().min(1).max(500),
        type: z.enum([...MEMORY_TYPES, 'decision', 'constitution']).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    tool(config.maxResponseChars, async ({ query, type, limit = 10 }: { query: string; type?: string; limit?: number }) => {
      const terms = tokenize(query);
      if (terms.length === 0) {
        throw new SpecwrightError('INVALID_INPUT', 'The query has no searchable terms.', 'Use at least one word that is not a stopword.');
      }
      const isNote = type !== undefined && (MEMORY_TYPES as readonly string[]).includes(type);
      const [memories, decisions, constitution] = await Promise.all([
        !type || isNote ? readMemories(config.root) : [],
        !type || type === 'decision' ? readDecisions(config.root) : [],
        !type || type === 'constitution' ? readConstitution(config.root) : undefined,
      ]);
      const notes = isNote ? memories.filter((m) => m.type === type) : memories;
      return { results: rank(terms, notes, decisions, constitution?.principles ?? [], limit) };
    }),
  );
}
