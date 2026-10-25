import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FEATURE_ID_PATTERN } from '../../src/features/types.js';
import { parseSpecification } from '../../src/features/spec-parser.js';
import { parseTasks } from '../../src/features/tasks-parser.js';
import { connect, makeProject, specMd, tasksMd } from '../helpers.js';

describe('review: Spec Kit folder names (FR-002, SC-001)', () => {
  it.each(['001-álbuns-de-fotos', '004-add-JWT-auth', '002-user_profile'])('FR-002: "%s" is a feature id', (id) => {
    expect(FEATURE_ID_PATTERN.test(id)).toBe(true);
  });

  it.each(['001-a/b', '001-a\\b', '001-..', '001-a b', '001-.hidden'])('FR-002: "%s" is still refused', (id) => {
    expect(FEATURE_ID_PATTERN.test(id)).toBe(false);
  });

  it('SC-001: a Unicode, mixed-case feature folder is listed and readable', async () => {
    const { root } = await makeProject({ 'specs/001-álbuns-de-JWT/spec.md': specMd('Álbuns') });
    const { call } = await connect(root);
    expect((await call('list_features')).data.features.map((f: { id: string }) => f.id)).toEqual(['001-álbuns-de-JWT']);
    expect((await call('get_artifact', { feature: '001-álbuns-de-JWT', artifact: 'spec' })).isError).toBe(false);
  });
});

describe('review: one broken file must not break listings', () => {
  it('an escaping spec.md symlink makes only that feature invalid', async () => {
    const { root } = await makeProject({ 'specs/001-good/spec.md': specMd('Good'), 'outside.md': specMd('Evil') });
    await mkdir(join(root, 'specs/002-evil'));
    await symlink(join(root, 'outside.md'), join(root, 'specs/002-evil/spec.md'));
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features.map((f: { id: string; valid: boolean }) => [f.id, f.valid])).toEqual([['001-good', true], ['002-evil', false]]);
    expect(data.features[1].issues.join(' ')).toContain('specs/002-evil/spec.md');
    expect((await call('list_open_tasks')).isError).toBe(false);
    expect((await call('pack_context', { task: 'good' })).isError).toBe(false);
  });

  it('an escaping plan.md symlink does not break pack_context', async () => {
    const { root } = await makeProject({ 'specs/001-good/spec.md': specMd('Good', '## Requirements\n\n- **FR-001**: good things\n'), 'src/x.md': '# x' });
    await symlink(join(root, 'src/x.md'), join(root, 'specs/001-good/plan.md'));
    const { call } = await connect(root);
    expect((await call('pack_context', { task: 'good things' })).isError).toBe(false);
  });

  it('an escaping constitution.md does not break search_memory', async () => {
    const { root } = await makeProject({ 'specs/001-good/spec.md': specMd('Good'), 'evil.md': '# C\n## Core Principles\n### I. X\nx' });
    await mkdir(join(root, '.specify/memory'), { recursive: true });
    await symlink(join(root, 'evil.md'), join(root, '.specify/memory/constitution.md'));
    await writeFile(join(root, '.specify/memory/.keep'), '');
    const { call } = await connect(root);
    expect((await call('search_memory', { query: 'good' })).isError).toBe(false);
  });
});

describe('review: no directory is created through an escaping symlink', () => {
  it('save_memory with a symlinked .specify creates nothing outside', async () => {
    const { root } = await makeProject({ 'specs/001-a/spec.md': specMd('A') });
    const outside = join(root, '..', `outside-${Date.now()}`);
    await mkdir(outside);
    await symlink(outside, join(root, '.specify'));
    const { call } = await connect(root);
    expect((await call('save_memory', { type: 'learning', title: 't', body: 'b' })).data).toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
    expect((await call('log_decision', { feature: '001-a', title: 't', decision: 'd' })).data).toMatchObject({ code: 'PATH_OUTSIDE_ROOT' });
    expect(existsSync(join(outside, 'memory'))).toBe(false);
  });
});

describe('review: common template variants are parsed, never silently dropped', () => {
  it('FR-003: colon inside the bold id', () => {
    expect(parseSpecification('# Feature Specification: X\n\n- **FR-001:** text\n- **SC-001:** metric\n').requirements).toEqual([{ id: 'FR-001', text: 'text' }]);
  });

  it.each(['### User Story 1 – Thing (Priority: P1)', '### User Story 1 — Thing (Priority: P1)', '### User Story 1 - Thing (Priority: P1) 🎯 MVP'])(
    'FR-003: story heading "%s"',
    (heading) => {
      expect(parseSpecification(`# Feature Specification: X\n\n${heading}\n`).userStories).toEqual([{ number: 1, title: 'Thing', priority: 'P1', scenarios: [] }]);
    },
  );

  it.each([
    ['- [ ] T012  [P] [US1] Do x', true],
    ['- [ ] T012 [US1] [P] Do x', true],
    ['- [ ] T012 [p] [US1] Do x', true],
    ['- [ ] T012\t[P]\t[US1]\tDo x', true],
  ])('FR-004: task labels in "%s"', (line) => {
    expect(parseTasks(tasksMd([line])).tasks[0]).toMatchObject({ id: 'T012', parallel: true, story: 'US1', text: 'Do x' });
  });

  it('FR-015: a line that looks like a requirement but does not parse is reported', async () => {
    const { root } = await makeProject({ 'specs/001-a/spec.md': specMd('A', '- FR-001: no bold at all\n') });
    const { call } = await connect(root);
    expect((await call('list_features')).data.features[0].issues).toEqual([expect.stringContaining('FR-001')]);
  });
});
