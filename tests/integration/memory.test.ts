import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from '../../src/storage/markdown.js';
import { copyFixture, makeProject, connect, specMd } from '../helpers.js';

const now = () => new Date(2026, 9, 21, 12, 0);

async function project() {
  return makeProject({ 'specs/001-auth/spec.md': specMd('Auth') });
}

describe('memory: save_memory', () => {
  it('FR-011: writes .specify/memory/notes/<slug>.md with frontmatter and body', async () => {
    const { root } = await project();
    const { call } = await connect(root, {}, now);
    const r = await call('save_memory', { type: 'convention', title: 'Use kebab-case ids', body: 'Spec ids are kebab-case.', tags: ['naming', 'naming', 'ids'] });
    expect(r.data).toEqual({ id: 'use-kebab-case-ids', path: '.specify/memory/notes/use-kebab-case-ids.md' });
    const doc = parseDocument(await readFile(join(root, r.data.path), 'utf8'));
    expect(doc.frontmatter).toEqual({ id: 'use-kebab-case-ids', type: 'convention', title: 'Use kebab-case ids', tags: ['naming', 'ids'], date: '2026-10-21' });
    expect(doc.body.trim()).toBe('Spec ids are kebab-case.');
  });

  it('AC-2: a repeated title gets a numeric suffix and nothing is overwritten', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    await call('save_memory', { type: 'learning', title: 'Same', body: 'first' });
    const second = await call('save_memory', { type: 'learning', title: 'Same', body: 'second' });
    expect(second.data.id).toBe('same-2');
    expect(await readFile(join(root, '.specify/memory/notes/same.md'), 'utf8')).toContain('first');
  });

  it.each([
    [{ type: 'idea', title: 't', body: 'b' }],
    [{ type: 'pitfall', title: '', body: 'b' }],
    [{ type: 'pitfall', title: 't', body: '' }],
  ])('AC-3: rejects %j without writing', async (args) => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('save_memory', args)).isError).toBe(true);
    await expect(readdir(join(root, '.specify/memory/notes'))).rejects.toThrow();
  });

  it('AC-4: a missing root gives NOT_INITIALIZED', async () => {
    const { root } = await makeProject();
    const { call } = await connect(root + '/nope');
    expect((await call('save_memory', { type: 'pitfall', title: 't', body: 'b' })).data).toMatchObject({ code: 'NOT_INITIALIZED' });
  });
});

describe('memory: search_memory', () => {
  async function seeded() {
    const p = await project();
    const { call } = await connect(p.root, {}, now);
    await call('save_memory', { type: 'convention', title: 'Retry policy', body: 'unrelated' });
    await call('save_memory', { type: 'learning', title: 'Tagged', body: 'unrelated', tags: ['retry'] });
    await call('save_memory', { type: 'pitfall', title: 'Body only', body: 'Network calls need a retry with backoff.' });
    await call('save_memory', { type: 'convention', title: 'Convenção de logs', body: 'Logs em JSON.' });
    await call('log_decision', { feature: '001-auth', title: 'Retry login once', decision: 'One retry on timeout.' });
    return { ...p, call };
  }

  it('AC-5: title > tags > body', async () => {
    const { call } = await seeded();
    const { data } = await call('search_memory', { query: 'retry', type: 'convention' });
    expect(data.results.map((r: { title: string }) => r.title)).toEqual(['Retry policy']);
    const all = await call('search_memory', { query: 'retry' });
    const memories = all.data.results.filter((r: { kind: string }) => r.kind === 'memory').map((r: { title: string }) => r.title);
    expect(memories).toEqual(['Retry policy', 'Tagged', 'Body only']);
  });

  it('AC-6: searches decisions and filters by type "decision"', async () => {
    const { call } = await seeded();
    const { data } = await call('search_memory', { query: 'retry', type: 'decision' });
    expect(data.results).toEqual([
      expect.objectContaining({ kind: 'decision', id: '0001', title: 'Retry login once', feature: '001-auth', path: '.specify/memory/decisions/0001-retry-login-once.md' }),
    ]);
  });

  it('AC-7: accent- and case-insensitive both ways', async () => {
    const { call } = await seeded();
    expect((await call('search_memory', { query: 'CONVENCAO' })).data.results[0].title).toBe('Convenção de logs');
    expect((await call('search_memory', { query: 'convenção' })).data.results[0].title).toBe('Convenção de logs');
  });

  it('AC-8: snippet is short and contains the match; limit defaults and caps', async () => {
    const { call } = await seeded();
    const { data } = await call('search_memory', { query: 'backoff' });
    expect(data.results[0].snippet.length).toBeLessThanOrEqual(200);
    expect(data.results[0].snippet.toLowerCase()).toContain('backoff');
    expect((await call('search_memory', { query: 'retry', limit: 51 })).isError).toBe(true);
    expect((await call('search_memory', { query: 'retry', limit: 1 })).data.results).toHaveLength(1);
  });

  it('AC-8: default limit is 10', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    for (let i = 0; i < 15; i++) await call('save_memory', { type: 'learning', title: `Cache note ${i}`, body: 'cache' });
    expect((await call('search_memory', { query: 'cache' })).data.results).toHaveLength(10);
  });

  it('AC-9: stopword-only query gives INVALID_INPUT', async () => {
    const { call } = await seeded();
    expect((await call('search_memory', { query: 'the of ?' })).data).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('AC-10: a new server instance finds what an earlier one saved', async () => {
    const { root } = await project();
    await (await connect(root)).call('save_memory', { type: 'pitfall', title: 'Windows paths', body: 'Use path.join.' });
    const fresh = await connect(root);
    expect((await fresh.call('search_memory', { query: 'windows' })).data.results[0].title).toBe('Windows paths');
  });
});

describe('US4: constitution in search_memory', () => {
  it('US4-AS2 / FR-011: finds a constitution principle', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const { data } = await call('search_memory', { query: 'test first' });
    expect(data.results[0]).toMatchObject({
      kind: 'constitution',
      id: 'ii-test-first-non-negotiable',
      title: 'II. Test-First (NON-NEGOTIABLE)',
      type: 'constitution',
      path: '.specify/memory/constitution.md',
    });
  });

  it('FR-011: type "constitution" keeps only principles', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    await call('save_memory', { type: 'learning', title: 'Simplicity wins', body: 'Keep it simple.' });
    const { data } = await call('search_memory', { query: 'simplicity', type: 'constitution' });
    expect(data.results.map((r: { kind: string }) => r.kind)).toEqual(['constitution']);
  });
});
