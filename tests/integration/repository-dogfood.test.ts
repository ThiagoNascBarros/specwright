import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cp } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, makeProject } from '../helpers.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));

describe('US6: Specwright follows Spec Kit itself', () => {
  it('SC-005 / US6-AS1: the repository lists its valid features, all but the one in progress fully done', async () => {
    // A snapshot copy, so the test never depends on (or changes) the live checkboxes beyond this check.
    const { root } = await makeProject();
    await cp(join(repo, 'specs'), join(root, 'specs'), { recursive: true });
    await cp(join(repo, '.specify'), join(root, '.specify'), { recursive: true });
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features.map((f: { id: string }) => f.id)).toEqual([
      '001-project-foundation',
      '002-spec-reading',
      '003-acceptance-criteria',
      '004-decision-log',
      '005-check-task',
      '006-memory',
      '007-decision-list',
      '008-context-pack',
      '009-speckit-format',
      '010-second-brain',
    ]);
    for (const f of data.features) {
      expect(f, f.id).toMatchObject({ valid: true });
      expect(f.issues, f.id).toBeUndefined();
      if (f.id !== '010-second-brain') expect(f.tasks.done, f.id).toBe(f.tasks.total);
    }
    expect((await call('get_artifact', { artifact: 'constitution' })).data.content).toContain('Test-First (NON-NEGOTIABLE)');
    expect((await call('list_decisions')).data.decisions.length).toBeGreaterThanOrEqual(10);
  });

  it('SC-007: lint_memory on the repository copy reports 0 broken_link', async () => {
    const { root } = await makeProject();
    await cp(join(repo, 'specs'), join(root, 'specs'), { recursive: true });
    await cp(join(repo, '.specify'), join(root, '.specify'), { recursive: true });
    await cp(join(repo, 'docs'), join(root, 'docs'), { recursive: true });
    const { call } = await connect(root, { graph: { include: ['docs'], cache: 'disk', vaultDir: '.specify/graph/vault' } });
    const { isError, data } = await call('lint_memory', { limit: 1000 });
    expect(isError).toBe(false);
    expect(data.issues.filter((i: { kind: string }) => i.kind === 'broken_link')).toEqual([]);
  });

  it('SC-001: relation questions on the repository copy are answered within 1,500 tokens and at least 3 times cheaper than the files that hold them', async () => {
    const { root } = await makeProject();
    await cp(join(repo, 'specs'), join(root, 'specs'), { recursive: true });
    await cp(join(repo, '.specify'), join(root, '.specify'), { recursive: true });
    await cp(join(repo, 'docs'), join(root, 'docs'), { recursive: true });
    const { call } = await connect(root, { graph: { include: ['docs'], cache: 'disk', vaultDir: '.specify/graph/vault' }, maxResponseChars: 20000 });
    const questions: Array<{ question: string; expected: string[] }> = [
      { question: 'token estimate budget', expected: ['decision:0007', 'requirement:008-context-pack/FR-003', 'task:008-context-pack/T003', 'artifact:008-context-pack/spec', 'artifact:008-context-pack/plan', 'artifact:008-context-pack/tasks', 'artifact:009-speckit-format/spec', 'artifact:009-speckit-format/research', 'artifact:constitution'] },
      { question: 'spec kit format vocabulary', expected: ['decision:0011', 'artifact:009-speckit-format/spec', 'artifact:009-speckit-format/research', 'artifact:009-speckit-format/contract/tools'] },
      { question: 'linear response truncation', expected: ['decision:0010', 'artifact:002-spec-reading/spec', 'artifact:002-spec-reading/plan', 'artifact:002-spec-reading/tasks', 'artifact:constitution', 'artifact:009-speckit-format/research'] },
    ];
    for (const { question, expected } of questions) {
      const { isError, data } = await call('query_graph', { question, budget_tokens: 1500 });
      expect(isError, question).toBe(false);
      expect(data.used_tokens, question).toBeLessThanOrEqual(1500);
      const ids = (data.nodes as Array<{ id: string }>).map((n) => n.id);
      for (const id of expected) expect(ids, `${question}: ${id}`).toContain(id);
      const files = new Set<string>();
      for (const id of expected) {
        const path = (await call('get_node', { ref: id })).data.node?.path as string | undefined;
        if (path) files.add(path);
      }
      const sourceTokens = [...files].reduce((sum, f) => sum + Math.ceil(readFileSync(join(root, f), 'utf8').length / 4), 0);
      expect(data.used_tokens * 3, question).toBeLessThanOrEqual(sourceTokens);
    }
  });

  it('SC-005: no .specwright/ folder is left', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(repo, '.specwright'))).toBe(false);
  });
});
