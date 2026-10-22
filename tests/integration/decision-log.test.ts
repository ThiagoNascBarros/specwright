import { describe, it, expect } from 'vitest';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from '../../src/storage/markdown.js';
import { makeProject, connect, specMd } from '../helpers.js';

const DIR = '.specify/memory/decisions';
const fixedNow = () => new Date(2026, 9, 21, 23, 30); // local time; must produce 2026-10-21

async function project() {
  return makeProject({ 'specs/001-albums/spec.md': specMd('Albums') });
}

describe('US4: log_decision', () => {
  it('US4-AS1 / FR-010: creates .specify/memory/decisions/0001-<slug>.md in Spec Kit research format', async () => {
    const { root } = await project();
    const { call } = await connect(root, {}, fixedNow);
    const r = await call('log_decision', {
      feature: '001-albums',
      title: 'Store metadata in SQLite',
      decision: 'Use SQLite for album metadata.',
      rationale: 'Single user, local files.',
      alternatives: 'PostgreSQL: needs a server.',
    });
    expect(r.data).toEqual({ id: '0001', path: `${DIR}/0001-store-metadata-in-sqlite.md` });
    const raw = await readFile(join(root, r.data.path), 'utf8');
    expect(raw).toContain('id: "0001"');
    const doc = parseDocument(raw);
    expect(doc.frontmatter).toEqual({ id: '0001', feature: '001-albums', title: 'Store metadata in SQLite', date: '2026-10-21', status: 'accepted' });
    expect(doc.sections.map((s) => s.heading)).toEqual(['Decision', 'Rationale', 'Alternatives considered']);
  });

  it('FR-010: omits empty optional sections', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('log_decision', { feature: '001-albums', title: 'Only decision', decision: 'd' });
    expect(parseDocument(await readFile(join(root, r.data.path), 'utf8')).sections.map((s) => s.heading)).toEqual(['Decision']);
  });

  it('FR-010: numbers after the highest existing decision and ignores other files', async () => {
    const { root } = await project();
    await mkdir(join(root, DIR), { recursive: true });
    await writeFile(join(root, DIR, '0002-a.md'), '');
    await writeFile(join(root, DIR, '0007-b.md'), '');
    await writeFile(join(root, DIR, 'README.md'), '');
    const { call } = await connect(root);
    expect((await call('log_decision', { feature: '001-albums', title: 'Next', decision: 'd' })).data.id).toBe('0008');
  });

  it('FEATURE_NOT_FOUND for an unknown feature, and nothing is written', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('log_decision', { feature: '009-nope', title: 't', decision: 'd' })).data).toMatchObject({ code: 'FEATURE_NOT_FOUND' });
    await expect(readdir(join(root, DIR))).rejects.toThrow();
  });

  it('a YAML-sensitive title reads back exactly, and an emoji title falls back to "decision"', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const title = `Use "quotes": it's #1 - ok`;
    const r = await call('log_decision', { feature: '001-albums', title, decision: 'd' });
    expect((parseDocument(await readFile(join(root, r.data.path), 'utf8')).frontmatter as { title: string }).title).toBe(title);
    expect((await call('log_decision', { feature: '001-albums', title: '🚀', decision: 'd' })).data.path).toBe(`${DIR}/0002-decision.md`);
  });

  it('10 parallel calls create 10 distinct sequential files', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => call('log_decision', { feature: '001-albums', title: `P ${i}`, decision: 'd' })));
    expect(results.map((r) => r.data.id).sort()).toEqual(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(4, '0')));
    expect(await readdir(join(root, DIR))).toHaveLength(10);
  });
});
