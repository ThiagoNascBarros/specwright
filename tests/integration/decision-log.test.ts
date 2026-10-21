import { describe, it, expect } from 'vitest';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from '../../src/storage/markdown.js';
import { makeProject, connect, spec } from '../helpers.js';

const fixedNow = () => new Date(2026, 9, 21, 23, 30); // local time; must produce 2026-10-21

async function project() {
  return makeProject({ '.specwright/specs/auth.md': spec('auth', '## Context\nx\n') });
}

describe('decision-log: log_decision', () => {
  it('AC-1/AC-9: creates decisions/0001-<slug>.md with frontmatter and sections, creating the folder', async () => {
    const { root } = await project();
    const { call } = await connect(root, {}, fixedNow);
    const r = await call('log_decision', {
      spec_id: 'auth',
      title: 'Lock by account',
      context: 'Brute force.',
      decision: 'Lock the account for 15 minutes.',
      consequences: 'Support may need an unlock tool.',
    });
    expect(r.data).toEqual({ id: '0001', path: 'decisions/0001-lock-by-account.md' });
    const raw = await readFile(join(root, r.data.path), 'utf8');
    expect(raw).toContain('id: "0001"');
    const doc = parseDocument(raw);
    expect(doc.frontmatter).toEqual({ id: '0001', spec_id: 'auth', title: 'Lock by account', date: '2026-10-21', status: 'accepted' });
    expect(doc.sections.map((s) => s.key)).toEqual(['context', 'decision', 'consequences']);
    expect(doc.sections[1].content).toContain('Lock the account for 15 minutes.');
  });

  it('AC-2: numbers after the highest existing decision and ignores other files', async () => {
    const { root } = await project();
    await mkdir(join(root, 'decisions'));
    await writeFile(join(root, 'decisions/0002-a.md'), '');
    await writeFile(join(root, 'decisions/0007-b.md'), '');
    await writeFile(join(root, 'decisions/README.md'), '');
    await writeFile(join(root, 'decisions/9999.md'), '');
    const { call } = await connect(root);
    expect((await call('log_decision', { spec_id: 'auth', title: 'Next', decision: 'd' })).data.id).toBe('0008');
  });

  it('AC-3: unknown spec gives SPEC_NOT_FOUND and writes nothing', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('log_decision', { spec_id: 'nope', title: 't', decision: 'd' })).data).toMatchObject({ code: 'SPEC_NOT_FOUND' });
    await expect(readdir(join(root, 'decisions'))).rejects.toThrow();
  });

  it('AC-4: falls back to "decision" when the title has no slug characters', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('log_decision', { spec_id: 'auth', title: '🚀', decision: 'd' })).data.path).toBe('decisions/0001-decision.md');
  });

  it('AC-5: omits empty optional sections', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('log_decision', { spec_id: 'auth', title: 'Only decision', decision: 'd' });
    const doc = parseDocument(await readFile(join(root, r.data.path), 'utf8'));
    expect(doc.sections.map((s) => s.key)).toEqual(['decision']);
  });

  it('AC-6: a YAML-sensitive title reads back exactly', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const title = `Use "quotes": it's #1 - ok`;
    const r = await call('log_decision', { spec_id: 'auth', title, decision: 'd' });
    expect((parseDocument(await readFile(join(root, r.data.path), 'utf8')).frontmatter as { title: string }).title).toBe(title);
  });

  it('AC-7: 10 parallel calls create 10 distinct sequential files', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => call('log_decision', { spec_id: 'auth', title: `Parallel ${i}`, decision: `d${i}` })),
    );
    expect(results.map((r) => r.data.id).sort()).toEqual(Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(4, '0')));
    expect(await readdir(join(root, 'decisions'))).toHaveLength(10);
  });

  it('AC-8: the returned path is relative', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('log_decision', { spec_id: 'auth', title: 'Rel', decision: 'd' });
    expect(r.data.path.startsWith('/')).toBe(false);
    expect(r.text).not.toContain(root);
  });
});
