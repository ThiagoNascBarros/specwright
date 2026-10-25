import { describe, it, expect, afterEach } from 'vitest';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';
import { EXTRACTION_INSTRUCTIONS } from '../../src/graph/instructions.js';
import { EXTRACTOR_VERSION } from '../../src/graph/types.js';

afterEach(() => resetGraphCache());

const ALBUM_FR = 'requirement:001-photo-albums/FR-002';
const TASK = 'task:001-photo-albums/T005';
const PROJECT_LEDGER = '.specify/memory/relations/project.md';

/** Every pending unit id, in plan order, across all batches. */
async function pendingIds(call: (name: string, args?: Record<string, unknown>) => Promise<{ data: any }>): Promise<string[]> {
  const { data } = await call('extraction_batch', { limit: 200 });
  return data.batches.flatMap((b: { units: string[] }) => b.units);
}

/** Fetches units (in chunks of 30) until every one is returned as an item, and returns the items. */
async function fetchAll(call: (name: string, args?: Record<string, unknown>) => Promise<{ data: any }>, ids: string[]) {
  const items: Array<{ unit: string; hash: string }> = [];
  for (let i = 0; i < ids.length; i += 30) {
    let pending = ids.slice(i, i + 30);
    for (let guard = 0; pending.length > 0 && guard < 10; guard++) {
      const { data } = await call('extraction_batch', { units: pending });
      items.push(...data.items);
      pending = data.deferred ?? [];
    }
  }
  return items;
}

describe('extraction_batch', () => {
  it('US2-AS1: plan mode returns every pending unit exactly once, and every multi-unit batch is within budget', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('extraction_batch', { limit: 200 });
    expect(isError).toBe(false);
    expect(Object.keys(data).sort()).toEqual(['batches', 'pending', 'units', 'version']);
    const ids = data.batches.flatMap((b: { units: string[] }) => b.units);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(data.pending);
    for (const b of data.batches as Array<{ tokens: number; units: string[] }>) {
      if (b.units.length > 1) expect(b.tokens).toBeLessThanOrEqual(2500);
    }
  });

  it('US2-AS2: fetch mode returns content, hash, instructions and candidates including concept:album-ordering', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const [unit] = await pendingIds(call);
    const { isError, data } = await call('extraction_batch', { units: [unit] });
    expect(isError).toBe(false);
    expect(Object.keys(data).sort()).toEqual(['candidates', 'instructions', 'items', 'version']);
    expect(data.items).toHaveLength(1);
    const [item] = data.items;
    expect(item.unit).toBe(unit);
    expect(item).toEqual(expect.objectContaining({ node: expect.any(String), title: expect.any(String), hash: expect.any(String), content: expect.any(String) }));
    expect(data.instructions).toContain('save_relations');
    expect(data.candidates).toEqual(expect.arrayContaining([['concept:album-ordering', 'Album ordering']]));
  });

  it('US2-AS3: saving relations, a concept and covered hashes adds the INFERRED tuples to the graph and removes the units from the plan', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const ids = await pendingIds(call);
    const [a, b] = await fetchAll(call, ids.slice(0, 2));
    const save = await call('save_relations', {
      relations: [
        { source: 'concept:album-ordering', relation: 'refines', target: ALBUM_FR, confidence: 'INFERRED', score: 0.8, evidence: 'order by date' },
        { source: TASK, relation: 'tests', target: ALBUM_FR, confidence: 'INFERRED', score: 0.7 },
      ],
      concepts: [{ id: 'concept:sort-stability', label: 'Sort stability', summary: 'Stable order across machines' }],
      covered: [{ unit: a.unit, hash: a.hash }, { unit: b.unit, hash: b.hash }],
    });
    expect(save.isError).toBe(false);
    expect(save.data.added).toEqual({ relations: 2, concepts: 1, covered: 2 });
    expect(save.data.rejected).toEqual([]);

    const query = await call('query_graph', { question: 'album ordering' });
    expect(query.data.edges).toEqual(expect.arrayContaining([
      ['concept:album-ordering', 'refines', ALBUM_FR, 'INFERRED', 0.8],
    ]));

    const remaining = await pendingIds(call);
    expect(remaining).not.toContain(a.unit);
    expect(remaining).not.toContain(b.unit);
  });

  it('US2-AS4: a mixed save writes the valid items and reports the invalid one with its input index and reason', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('save_relations', {
      relations: [
        { source: 'concept:album-ordering', relation: 'refines', target: ALBUM_FR, confidence: 'INFERRED', score: 0.9 },
        { source: 'requirement:001-photo-albums/FR-999', relation: 'refines', target: ALBUM_FR, confidence: 'INFERRED', score: 0.9 },
      ],
    });
    expect(isError).toBe(false);
    expect(data.added.relations).toBe(1);
    expect(data.rejected).toEqual([{ field: 'relations', index: 1, reason: 'unknown_source' }]);
  });

  it('US2-AS6: re-saving with a new score updates one row, and a REJECTED save removes the edge and blocks a later INFERRED save', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const rel = { source: 'concept:album-ordering', relation: 'refines', target: ALBUM_FR };
    await call('save_relations', { relations: [{ ...rel, confidence: 'INFERRED', score: 0.8 }] });

    const rescore = await call('save_relations', { relations: [{ ...rel, confidence: 'INFERRED', score: 0.9 }] });
    expect(rescore.data.updated.relations).toBe(1);
    expect(rescore.data.added.relations).toBe(0);
    const scored = await call('get_node', { ref: 'concept:album-ordering', relation: 'refines' });
    expect(scored.data.out.find((e: string[]) => e[1] === ALBUM_FR)).toEqual(expect.arrayContaining(['refines', ALBUM_FR, expect.any(String), 'INFERRED', 0.9]));

    const retire = await call('save_relations', { relations: [{ ...rel, confidence: 'REJECTED', score: 0 }] });
    expect(retire.isError).toBe(false);
    const gone = await call('get_node', { ref: 'concept:album-ordering', relation: 'refines' });
    expect(gone.data.out.find((e: string[]) => e[1] === ALBUM_FR)).toBeUndefined();

    const blocked = await call('save_relations', { relations: [{ ...rel, confidence: 'INFERRED', score: 0.8 }] });
    expect(blocked.data.rejected).toEqual([{ field: 'relations', index: 0, reason: 'previously_rejected' }]);
    expect(blocked.data.added.relations).toBe(0);
  });

  it('SC-002: after covering every unit the plan shows pending 0, and editing one section of one file makes pending 1', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const items = await fetchAll(call, await pendingIds(call));
    const save = await call('save_relations', { covered: items.map((i) => ({ unit: i.unit, hash: i.hash })) });
    expect(save.data.rejected).toEqual([]);
    expect((await call('extraction_batch', {})).data.pending).toBe(0);

    const spec = join(root, 'specs/001-photo-albums/spec.md');
    await writeFile(spec, `${await readFile(spec, 'utf8')}\nA new sentence added to the last section.\n`);
    expect((await call('extraction_batch', {})).data.pending).toBe(1);
  });

  it('SC-006: one new relation into an existing ledger changes exactly one line of that file', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const before = (await readFile(join(root, PROJECT_LEDGER), 'utf8')).split('\n');
    await call('save_relations', {
      relations: [{ source: 'concept:album-ordering', relation: 'related_to', target: ALBUM_FR, confidence: 'INFERRED', score: 0.6 }],
    });
    const after = (await readFile(join(root, PROJECT_LEDGER), 'utf8')).split('\n');
    expect(after.length).toBe(before.length + 1);
    expect(after.filter((line) => !before.includes(line))).toHaveLength(1);
  });

  it('Review Focus 3: a unit deleted between plan and fetch is returned in deferred', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const unit = (await pendingIds(call)).find((id) => id.startsWith('specs/002-sharing/spec.md'));
    expect(unit).toBeDefined();
    await rm(join(root, 'specs/002-sharing/spec.md'));
    const { isError, data } = await call('extraction_batch', { units: [unit] });
    expect(isError).toBe(false);
    expect(data.items).toEqual([]);
    expect(data.deferred).toEqual([unit]);
  });

  it('Review Focus 3: a unit edited between fetch and save is rejected as stale', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const note = '.specify/memory/notes/sorting-pitfall.md';
    const { data } = await call('extraction_batch', { units: [note] });
    const [item] = data.items;
    expect(item.unit).toBe(note);
    const file = join(root, note);
    await writeFile(file, `${await readFile(file, 'utf8')}\nEdited between fetch and save.\n`);
    const save = await call('save_relations', { covered: [{ unit: note, hash: item.hash }] });
    expect(save.data.rejected).toEqual([{ field: 'covered', index: 0, reason: 'stale' }]);
    expect(save.data.added.covered).toBe(0);
  });

  it('Review Focus 5: with maxResponseChars 3000, a huge unit is deferred and a small one is returned whole', async () => {
    const { root } = await copyFixture('brain');
    const huge = '.specify/memory/notes/huge-note.md';
    const small = '.specify/memory/notes/keep-ids-stable.md';
    await writeFile(join(root, huge), `---\ntitle: Huge note\ntype: pitfall\ntags: []\n---\n# Huge note\n\n${'x'.repeat(20000)}\n`);
    const { call } = await connect(root, { maxResponseChars: 3000 });
    const { isError, data } = await call('extraction_batch', { units: [huge, small] });
    expect(isError).toBe(false);
    expect(data.deferred).toEqual([huge]);
    expect(data.items.map((i: { unit: string }) => i.unit)).toEqual([small]);
    expect(data.items[0].content.length).toBeGreaterThan(0);
  });

  it('plan fitting stage 1: a response limit just below the full fetch drops candidates from the end and keeps every item', async () => {
    const { root } = await copyFixture('brain');
    const [unit] = await pendingIds((await connect(root)).call);
    const full = await (await connect(root)).call('extraction_batch', { units: [unit] });
    const max = full.text.length - 300;
    const limited = await (await connect(root, { maxResponseChars: max })).call('extraction_batch', { units: [unit] });
    expect(limited.isError).toBe(false);
    expect(limited.data.items.map((i: { unit: string }) => i.unit)).toEqual([unit]);
    expect(limited.data.deferred).toBeUndefined();
    expect(limited.data.candidates.length).toBeLessThan(full.data.candidates.length);
    expect(limited.data.candidates).toEqual(full.data.candidates.slice(0, limited.data.candidates.length));
    expect(limited.text.length).toBeLessThanOrEqual(max);
  });

  it('plan fitting stage 2: when items no longer fit together, the last ones move to deferred and kept items stay a request-order prefix', async () => {
    const { root } = await copyFixture('brain');
    const ids = await pendingIds((await connect(root)).call);
    const { call } = await connect(root);
    // Three units: A fits alone, B fits alone but not with A, C is small enough to fit with A.
    const fetched = await Promise.all(ids.slice(0, 3).map(async (id) => (await call('extraction_batch', { units: [id] })).data.items[0]));
    const bySize = [...fetched].sort((x, y) => x.content.length - y.content.length);
    const [c, a, b] = bySize; // b is the largest
    const size = (items: unknown[], deferred: string[]) => JSON.stringify({ version: EXTRACTOR_VERSION, instructions: EXTRACTION_INSTRUCTIONS, items, candidates: [], deferred }).length;
    const max = size([a, c], [b.unit]);
    expect(size([b], [a.unit, c.unit])).toBeLessThanOrEqual(max); // B fits alone
    expect(size([a, b], [c.unit])).toBeGreaterThan(max);          // A and B do not fit together
    const limited = await (await connect(root, { maxResponseChars: max })).call('extraction_batch', { units: [a.unit, b.unit, c.unit] });
    expect(limited.data.items.map((i: { unit: string }) => i.unit)).toEqual([a.unit]);
    expect(limited.data.deferred).toEqual([b.unit, c.unit]);
  });

  describe('save_relations runtime bounds', () => {
    const rel = { source: 'concept:album-ordering', relation: 'refines', target: ALBUM_FR, confidence: 'INFERRED', score: 0.8 };
    const cases: Array<[string, Record<string, unknown>]> = [
      ['an empty save', {}],
      ['relations over 200', { relations: Array.from({ length: 201 }, () => rel) }],
      ['concepts over 50', { concepts: Array.from({ length: 51 }, (_, i) => ({ id: `concept:c${i}`, label: 'C' })) }],
      ['covered over 100', { covered: Array.from({ length: 101 }, (_, i) => ({ unit: `u${i}`, hash: 'h' })) }],
      ['evidence over 200 characters', { relations: [{ ...rel, evidence: 'e'.repeat(201) }] }],
      ['a label of 0 characters', { concepts: [{ id: 'concept:x', label: '' }] }],
      ['a label over 120 characters', { concepts: [{ id: 'concept:x', label: 'l'.repeat(121) }] }],
      ['a summary over 300 characters', { concepts: [{ id: 'concept:x', label: 'X', summary: 's'.repeat(301) }] }],
    ];
    for (const [name, args] of cases) {
      it(`save_relations: ${name} returns INVALID_INPUT`, async () => {
        const { root } = await copyFixture('brain');
        const { call } = await connect(root);
        const { isError, data } = await call('save_relations', args);
        expect(isError).toBe(true);
        expect(data.code).toBe('INVALID_INPUT');
      });
    }
  });
});
