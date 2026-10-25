import { describe, it, expect } from 'vitest';
import { symlink, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeProject, specMd } from '../helpers.js';
import { discoverSources, ensureGraphDir, readSnapshot, readSource, writeLedgerChanges, writeSnapshot } from '../../src/graph/repository.js';

describe('graph repository', () => {
  it('FR-006: discoverSources lists sources in plan order with kinds, skipping non-sources', async () => {
    const { root } = await makeProject({
      'specs/001-a/spec.md': specMd('A'), 'specs/001-a/plan.md': '# P', 'specs/001-a/notes.md': 'x',
      'specs/001-a/contracts/api.md': '# C', 'specs/bad/spec.md': 'x', 'specs/001-a/.hidden.md': 'x',
      '.specify/memory/constitution.md': '# C', '.specify/memory/decisions/0001-x.md': '# D',
      '.specify/memory/decisions/readme.md': 'x', '.specify/memory/notes/n.md': '# N',
      '.specify/memory/relations/project.md': '# L', 'docs/x.md': '# doc',
    });
    const got = (await discoverSources(root, ['docs'])).map((s) => [s.path, s.kind, s.feature]);
    expect(got).toEqual([
      ['specs/001-a/contracts/api.md', 'contract', '001-a'], ['specs/001-a/plan.md', 'plan', '001-a'], ['specs/001-a/spec.md', 'spec', '001-a'],
      ['.specify/memory/constitution.md', 'constitution', undefined], ['.specify/memory/decisions/0001-x.md', 'decision', undefined],
      ['.specify/memory/notes/n.md', 'note', undefined], ['.specify/memory/relations/project.md', 'ledger', undefined], ['docs/x.md', 'doc', undefined],
    ]);
  });

  it('FR-006: a symlinked source escaping the root is skipped and readSource rejects it', async () => {
    const { root } = await makeProject({ '.specify/memory/notes/ok.md': '# ok', 'outside.md': 'secret' });
    await symlink(join(root, 'outside.md'), join(root, '.specify/memory/notes/evil.md'));
    expect((await discoverSources(root, [])).map((s) => s.path)).toEqual(['.specify/memory/notes/ok.md']);
    expect(await readSource(root, '.specify/memory/notes/ok.md', [])).toBe('# ok');
    await expect(readSource(root, '.specify/memory/notes/evil.md', [])).rejects.toThrow(/outside/);
  });

  it('FR-007: snapshots round-trip; corrupt or other-schema snapshots read as undefined', async () => {
    const { root } = await makeProject();
    const snap = { schema: 1, extractor: 1, files: {} };
    await writeSnapshot(root, snap);
    expect(await readSnapshot(root)).toEqual(snap);
    await writeFile(join(root, '.specify/graph/cache.json'), '{nope');
    expect(await readSnapshot(root)).toBeUndefined();
    await writeFile(join(root, '.specify/graph/cache.json'), JSON.stringify({ ...snap, schema: 0 }));
    expect(await readSnapshot(root)).toBeUndefined();
  });

  it('FR-008: ensureGraphDir creates .gitignore "*" and never overwrites one', async () => {
    const { root } = await makeProject();
    await ensureGraphDir(root);
    expect(await readFile(join(root, '.specify/graph/.gitignore'), 'utf8')).toBe('*\n');
    await writeFile(join(root, '.specify/graph/.gitignore'), 'mine\n');
    await ensureGraphDir(root);
    expect(await readFile(join(root, '.specify/graph/.gitignore'), 'utf8')).toBe('mine\n');
  });
});

describe('graph repository: ledger writes', () => {
  it('FR-015: writeLedgerChanges creates the file, then a second identical call reports written=false', async () => {
    const { root } = await makeProject();
    const changes = { relations: [{ source: 'decision:0001', relation: 'uses', target: 'note:x', confidence: 'INFERRED' as const, score: 0.8, evidence: '', date: '2026-10-24' }] };
    const first = await writeLedgerChanges(root, 'project', changes);
    expect(first.written).toBe(true);
    expect(first.path).toBe('.specify/memory/relations/project.md');
    expect(await readFile(join(root, first.path), 'utf8')).toContain('| decision:0001 | uses | note:x | INFERRED | 0.8 |');
    const second = await writeLedgerChanges(root, 'project', changes);
    expect(second.written).toBe(false);
    expect(second.stats.relations).toEqual({ added: 0, updated: 0, unchanged: 1 });
  });
});

describe('graph repository: REJECTED rows survive writes', () => {
  const rel = (target: string, confidence: 'INFERRED' | 'REJECTED', score: number) => ({
    source: 'decision:0001', relation: 'uses', target, confidence, score, evidence: '', date: '2026-10-24',
  });

  it('FR-014: writeLedgerChanges refuses an INFERRED row whose triple is REJECTED in the file, and still writes the other rows', async () => {
    const { root } = await makeProject();
    await writeLedgerChanges(root, 'project', { relations: [rel('note:x', 'REJECTED', 0)] });
    const r = await writeLedgerChanges(root, 'project', { relations: [rel('note:x', 'INFERRED', 0.8), rel('note:y', 'INFERRED', 0.8)] });
    expect(r.rejected).toEqual([{ field: 'relations', index: 0, reason: 'previously_rejected' }]);
    expect(r.written).toBe(true);
    const text = await readFile(join(root, r.path), 'utf8');
    expect(text).toContain('| decision:0001 | uses | note:x | REJECTED | 0 |');
    expect(text).not.toContain('| decision:0001 | uses | note:x | INFERRED');
    expect(text).toContain('| decision:0001 | uses | note:y | INFERRED | 0.8 |');
  });

  it('FR-015: concurrent writes to one ledger are serialized: no row is lost and a REJECTED row is not replaced', async () => {
    const { root } = await makeProject();
    const [a, b, c] = await Promise.all([
      writeLedgerChanges(root, 'project', { relations: [rel('note:x', 'REJECTED', 0)] }),
      writeLedgerChanges(root, 'project', { relations: [rel('note:x', 'INFERRED', 0.8)] }),
      writeLedgerChanges(root, 'project', { relations: [rel('note:y', 'INFERRED', 0.8)] }),
    ]);
    expect([a.rejected, b.rejected, c.rejected]).toEqual([[], [{ field: 'relations', index: 0, reason: 'previously_rejected' }], []]);
    const text = await readFile(join(root, a.path), 'utf8');
    expect(text).toContain('| decision:0001 | uses | note:x | REJECTED | 0 |');
    expect(text).toContain('| decision:0001 | uses | note:y | INFERRED | 0.8 |');
  });
});
