import { describe, it, expect, afterEach } from 'vitest';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

const PROJECT_RELATIONS = '.specify/memory/relations/project.md';

/** Inserts rows right after the existing sorted sample row of the project ledger. */
async function addRelationRows(root: string, rows: string[]): Promise<void> {
  const file = join(root, PROJECT_RELATIONS);
  const text = await readFile(file, 'utf8');
  const anchor = text.split('\n').find((l) => l.startsWith('| note:sorting-pitfall'))!;
  await writeFile(file, text.replace(anchor, [anchor, ...rows].join('\n')));
}

describe('lint_memory', () => {
  it('US4-AS1: [[missing-note]] in a note and [text](../notes/gone.md) in a decision → 2 broken_link errors with path and line', async () => {
    const { root } = await copyFixture('brain');
    await appendFile(join(root, '.specify/memory/notes/sorting-pitfall.md'), '\nSee [[missing-note]].\n');
    await appendFile(join(root, '.specify/memory/decisions/0001-keep-photo-data-as-plain-files.md'), '\nSee [text](../notes/gone.md).\n');
    const { call } = await connect(root);
    const { isError, data } = await call('lint_memory', {});
    expect(isError).toBe(false);
    const broken = data.issues.filter((i: { kind: string }) => i.kind === 'broken_link');
    expect(broken.length).toBe(2);
    expect(broken.every((i: { severity: string; path: string; line?: number }) => i.severity === 'error' && typeof i.path === 'string' && typeof i.line === 'number')).toBe(true);
    expect(data.counts.error).toBeGreaterThanOrEqual(2);
  });

  it('US4-AS2: a ledger row targeting task:001-photo-albums/T999 → dangling_relation, and the edge is absent from get_node', async () => {
    const { root } = await copyFixture('brain');
    await addRelationRows(root, ['| task:001-photo-albums/T999 | depends_on | decision:0002 | INFERRED | 0.8 | "row for a missing task" | 2026-10-24 |']);
    const { call } = await connect(root);
    const { data } = await call('lint_memory', {});
    const dangling = data.issues.filter((i: { kind: string }) => i.kind === 'dangling_relation');
    expect(dangling.length).toBe(1);
    expect(dangling[0].message).toContain('task:001-photo-albums/T999');
    const node = await call('get_node', { ref: 'decision:0002' });
    expect(JSON.stringify(node.data)).not.toContain('T999');
  });

  it('US4-AS3: an AMBIGUOUS row and a contradicts row are listed, and feature "002-sharing" keeps only that feature\'s issues', async () => {
    const { root } = await copyFixture('brain');
    await addRelationRows(root, [
      '| decision:0001 | contradicts | decision:0002 | INFERRED | 0.9 | "conflicting expiry" | 2026-10-24 |',
      '| note:sorting-pitfall | related_to | decision:0002 | AMBIGUOUS | 0.2 | "weak link" | 2026-10-24 |',
    ]);
    await appendFile(join(root, 'specs/001-photo-albums/spec.md'), '\nSee [[missing-one]].\n');
    await appendFile(join(root, 'specs/002-sharing/spec.md'), '\nSee [[missing-two]].\n');
    const { call } = await connect(root);
    const all = (await call('lint_memory', {})).data.issues as Array<{ kind: string; path: string }>;
    expect(all.some((i) => i.kind === 'contradiction')).toBe(true);
    expect(all.some((i) => i.kind === 'ambiguous_relation')).toBe(true);

    const { data } = await call('lint_memory', { feature: '002-sharing' });
    const issues = data.issues as Array<{ kind: string; path: string; message: string }>;
    expect(issues.some((i) => i.kind === 'broken_link' && i.path === 'specs/002-sharing/spec.md')).toBe(true);
    expect(issues.some((i) => i.path === 'specs/001-photo-albums/spec.md')).toBe(false);
    expect(issues.length).toBeLessThan(all.length);
  });

  it('FR-019: an ambiguous wikilink → ambiguous_link with both candidate paths in the message', async () => {
    const { root } = await copyFixture('brain');
    await mkdir(join(root, 'specs/002-sharing/contracts'), { recursive: true });
    await writeFile(join(root, 'specs/002-sharing/contracts/keep-ids-stable.md'), '# Keep ids stable\n\nA second copy.\n');
    await appendFile(join(root, '.specify/memory/notes/sorting-pitfall.md'), '\nSee [[keep-ids-stable]].\n');
    const { call } = await connect(root);
    const { data } = await call('lint_memory', {});
    const ambiguous = data.issues.filter((i: { kind: string }) => i.kind === 'ambiguous_link');
    const hit = ambiguous.find((i: { path: string }) => i.path === '.specify/memory/notes/sorting-pitfall.md');
    expect(hit.severity).toBe('warning');
    expect(hit.message).toContain('specs/002-sharing/contracts/keep-ids-stable.md');
    expect(hit.message).toContain('.specify/memory/notes/keep-ids-stable.md');
  });
});
