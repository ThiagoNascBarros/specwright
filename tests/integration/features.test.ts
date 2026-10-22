import { describe, it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, connect, makeProject, specMd } from '../helpers.js';

describe('US1: list_features', () => {
  it('SC-001 / US1-AS1 / FR-005: lists the features of an unmodified Spec Kit project', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features).toEqual([
      {
        id: '001-photo-albums',
        title: 'Photo albums',
        status: 'Draft',
        valid: true,
        issues: ['task without id ignored: "- [ ] TXXX Security hardening"'],
        artifacts: ['spec', 'plan', 'tasks', 'research', 'data-model', 'quickstart', 'contracts', 'checklists'],
        tasks: { done: 2, total: 11 },
        open_clarifications: 1,
      },
      {
        id: '002-sharing',
        title: 'Album sharing',
        status: 'In Progress',
        valid: true,
        artifacts: ['spec', 'tasks'],
        tasks: { done: 0, total: 2 },
        open_clarifications: 0,
      },
    ]);
  });

  it('FR-005: filters by status, case-insensitively', async () => {
    const { root } = await copyFixture('speckit');
    const { call } = await connect(root);
    expect((await call('list_features', { status: 'in progress' })).data.features.map((f: { id: string }) => f.id)).toEqual(['002-sharing']);
  });

  it('FR-002: lists timestamp-prefixed features and ignores other folders', async () => {
    const { root } = await makeProject({
      'specs/20261021-143000-photo-albums/spec.md': specMd('Timestamped'),
      'specs/notes/spec.md': specMd('Not a feature'),
      'specs/001-real/spec.md': specMd('Real'),
    });
    const { call } = await connect(root);
    expect((await call('list_features')).data.features.map((f: { id: string }) => f.id)).toEqual(['001-real', '20261021-143000-photo-albums']);
  });

  it('FR-015: an invalid feature is listed with its reasons, and the others still appear', async () => {
    const { root } = await makeProject({ 'specs/001-ok/spec.md': specMd('Ok') });
    await mkdir(join(root, 'specs/002-plan-only'), { recursive: true });
    await writeFile(join(root, 'specs/002-plan-only/plan.md'), '# Plan');
    const { call } = await connect(root);
    const { data } = await call('list_features');
    expect(data.features[1]).toMatchObject({ id: '002-plan-only', valid: false, issues: ['missing spec.md'], artifacts: ['plan'] });
    expect(data.features[0].valid).toBe(true);
  });

  it('returns an empty list when specs/ does not exist', async () => {
    const { root } = await makeProject();
    const { call } = await connect(root);
    expect((await call('list_features')).data).toEqual({ features: [] });
  });

  it('a missing project root gives NOT_INITIALIZED', async () => {
    const { root } = await makeProject();
    const { call } = await connect(join(root, 'nope'));
    expect((await call('list_features')).data).toMatchObject({ code: 'NOT_INITIALIZED' });
  });
});
