import { describe, it, expect } from 'vitest';
import { copyFixture, connect } from '../helpers.js';

async function setup(overrides = {}) {
  const { root } = await copyFixture('speckit');
  return connect(root, overrides);
}

describe('US1: get_artifact', () => {
  it('US1-AS2 / FR-006: returns only the requested section of spec.md, without template comments', async () => {
    const { call } = await setup();
    const { data } = await call('get_artifact', { feature: '001-photo-albums', artifact: 'spec', section: 'Requirements' });
    expect(data).toMatchObject({ artifact: 'spec', feature: '001-photo-albums', section: 'requirements-mandatory' });
    expect(data.content.startsWith('## Requirements')).toBe(true);
    expect(data.content).toContain('FR-005');
    expect(data.content).not.toContain('User Story 1');
  });

  it('FR-006: the whole spec has no comments', async () => {
    const { call } = await setup();
    const { data } = await call('get_artifact', { feature: '001-photo-albums', artifact: 'spec' });
    expect(data.content).toContain('# Feature Specification: Photo albums');
    expect(data.content).not.toContain('<!--');
    expect(data.content).not.toContain('FR-099');
  });

  it.each(['plan', 'tasks', 'research', 'data-model', 'quickstart'])('FR-006: reads the %s artifact', async (artifact) => {
    const { call } = await setup();
    const r = await call('get_artifact', { feature: '001-photo-albums', artifact });
    expect(r.isError).toBe(false);
    expect(r.data.content.length).toBeGreaterThan(0);
  });

  it('FR-006: tasks.md is returned without its YAML frontmatter', async () => {
    const { call } = await setup();
    const { data } = await call('get_artifact', { feature: '001-photo-albums', artifact: 'tasks' });
    expect(data.content.startsWith('# Tasks: Photo albums')).toBe(true);
  });

  it('US1-AS3: reads the constitution without a feature', async () => {
    const { call } = await setup();
    const { data } = await call('get_artifact', { artifact: 'constitution' });
    expect(data.artifact).toBe('constitution');
    expect(data.content).toContain('Test-First (NON-NEGOTIABLE)');
    expect(data.feature).toBeUndefined();
  });

  it('US1-AS4: reads a named checklist and contract', async () => {
    const { call } = await setup();
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'checklist', name: 'ux' })).data.content).toContain('CHK001');
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'contract', name: 'api' })).data.content).toContain('POST /photos');
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'contract', name: 'api.md' })).isError).toBe(false);
  });

  it('ARTIFACT_NOT_FOUND lists the available names or artifacts', async () => {
    const { call } = await setup();
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'checklist', name: 'security' })).data).toMatchObject({
      code: 'ARTIFACT_NOT_FOUND',
      hint: expect.stringContaining('requirements, ux'),
    });
    expect((await call('get_artifact', { feature: '002-sharing', artifact: 'plan' })).data).toMatchObject({
      code: 'ARTIFACT_NOT_FOUND',
      hint: expect.stringContaining('spec, tasks'),
    });
  });

  it('SECTION_NOT_FOUND lists the section keys', async () => {
    const { call } = await setup();
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'spec', section: 'design' })).data).toMatchObject({
      code: 'SECTION_NOT_FOUND',
      hint: expect.stringContaining('assumptions'),
    });
  });

  it('INVALID_INPUT when feature or name is missing; FEATURE_NOT_FOUND for unknown ids', async () => {
    const { call } = await setup();
    expect((await call('get_artifact', { artifact: 'spec' })).data).toMatchObject({ code: 'INVALID_INPUT' });
    expect((await call('get_artifact', { feature: '001-photo-albums', artifact: 'checklist' })).data).toMatchObject({ code: 'INVALID_INPUT' });
    expect((await call('get_artifact', { feature: '009-nope', artifact: 'spec' })).data).toMatchObject({ code: 'FEATURE_NOT_FOUND' });
  });

  it.each(['../x', '001-a/../../etc', 'Foo'])('rejects feature "%s" before touching the disk', async (feature) => {
    const { call } = await setup();
    expect((await call('get_artifact', { feature, artifact: 'spec' })).isError).toBe(true);
  });

  it('NFR-4: cuts long content and flags truncated', async () => {
    const { call } = await setup({ maxResponseChars: 500 });
    const { data } = await call('get_artifact', { feature: '001-photo-albums', artifact: 'spec' });
    expect(data.truncated).toBe(true);
    expect(data.content.length).toBe(500);
  });
});
