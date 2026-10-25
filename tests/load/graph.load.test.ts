import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture } from '../helpers.js';
import { parseLedger } from '../../src/graph/ledger.js';
import type { LedgerFacts } from '../../src/graph/types.js';
import { startServer } from './stdio-client.js';

const TARGET = 'requirement:001-photo-albums/FR-002';
const PER_PROCESS = 50;

/** Every scope ledger under .specify/memory/relations/, parsed. */
async function ledgers(dir: string): Promise<Array<{ name: string; facts: LedgerFacts }>> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.md'));
  return Promise.all(names.map(async (name) => ({
    name,
    facts: parseLedger(`.specify/memory/relations/${name}`, await readFile(join(dir, name), 'utf8')),
  })));
}

describe('load: graph ledger across processes', () => {
  it('US2-AS5: two stdio server processes each save 50 distinct relations into the same project ledger concurrently; afterwards the ledger parses with 0 invalid rows and has all 100 relations', async () => {
    const { root } = await copyFixture('brain');
    const dir = join(root, '.specify/memory/relations');
    const fixtureRelations = (await ledgers(dir)).flatMap((l) => l.facts.relations).length;
    const a = await startServer(root);
    const b = await startServer(root);
    try {
      // Each process saves its own relations one call at a time; the two processes run concurrently.
      const saveAll = (s: typeof a, tag: string) => (async () => {
        const results: Array<{ isError: boolean; data: any }> = [];
        for (let i = 0; i < PER_PROCESS; i++) {
          const concept = `concept:load-${tag}-${i}`;
          results.push(await s.call('save_relations', {
            concepts: [{ id: concept, label: `Load ${tag} ${i}` }],
            relations: [{ source: concept, relation: 'related_to', target: TARGET, confidence: 'INFERRED', score: 0.8 }],
          }));
        }
        return results;
      })();
      const [ra, rb] = await Promise.all([saveAll(a, 'a'), saveAll(b, 'b')]);
      for (const r of [...ra, ...rb]) {
        expect(r.isError).toBe(false);
        expect(r.data.rejected).toEqual([]);
      }
      expect([...ra, ...rb].reduce((n, r) => n + r.data.added.relations, 0)).toBe(2 * PER_PROCESS);
    } finally {
      await a.close();
      await b.close();
    }

    const all = await ledgers(dir);
    for (const { name, facts } of all) expect({ name, invalid: facts.invalid }).toEqual({ name, invalid: [] });
    const relations = all.flatMap((l) => l.facts.relations);
    const added = relations.filter((r) => r.source.startsWith('concept:load-'));
    expect(new Set(added.map((r) => `${r.source}|${r.relation}|${r.target}`)).size).toBe(2 * PER_PROCESS);
    // The fixture's own row is still there, next to the 100 new ones.
    expect(relations.filter((r) => r.source === 'note:sorting-pitfall')).toHaveLength(1);
    expect(relations).toHaveLength(fixtureRelations + 2 * PER_PROCESS);
  });
});
