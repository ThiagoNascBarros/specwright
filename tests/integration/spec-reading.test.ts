import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { makeProject, connect, spec } from '../helpers.js';

const auth = spec(
  'auth',
  '## Context\nUsers log in.\n\n## Acceptance criteria\n- [x] AC-1: valid login\n- [ ] AC-10: lockout\n\n## Out of scope\n- social\n',
  { status: 'in-progress' },
);

async function project() {
  return makeProject({
    '.specwright/specs/auth.md': auth,
    '.specwright/specs/billing.md': spec('billing', '## Context\nPay.\n', { status: 'done' }),
    '.specwright/specs/broken.md': spec('wrong-id', ''),
  });
}

describe('spec-reading: tools', () => {
  it('AC-2: every tool returns NOT_INITIALIZED when the root is missing', async () => {
    const { root } = await makeProject();
    const { call } = await connect(root);
    for (const [name, args] of [
      ['list_specs', {}],
      ['get_spec', { spec_id: 'auth' }],
    ] as const) {
      const r = await call(name, args);
      expect(r.isError).toBe(true);
      expect(r.data).toMatchObject({ code: 'NOT_INITIALIZED', hint: expect.stringContaining('.specwright/specs/') });
    }
  });

  it('AC-5: an invalid spec is listed with valid:false and issues, and the others still appear', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const { data } = await call('list_specs');
    const broken = data.specs.find((s: { id: string }) => s.id === 'broken');
    expect(broken).toMatchObject({ valid: false, issues: [expect.stringMatching(/id/)] });
    expect(data.specs).toHaveLength(3);
  });

  it('AC-6: lists specs sorted by id with criteria counts and no body', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const { data } = await call('list_specs');
    expect(data.specs.map((s: { id: string }) => s.id)).toEqual(['auth', 'billing', 'broken']);
    expect(data.specs[0]).toEqual({
      id: 'auth',
      title: 'Title of auth',
      status: 'in-progress',
      valid: true,
      criteria: { done: 1, total: 2 },
    });
    expect(data.specs[1].criteria).toEqual({ done: 0, total: 0 });
  });

  it('AC-6: returns an empty list when specs/ does not exist yet', async () => {
    const { root } = await makeProject({ '.specwright/config.json': '{}' });
    const { call } = await connect(root);
    expect((await call('list_specs')).data).toEqual({ specs: [] });
  });

  it('AC-7: filters by status', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const { data } = await call('list_specs', { status: 'done' });
    expect(data.specs.map((s: { id: string }) => s.id)).toEqual(['billing']);
  });

  it('AC-8: get_spec without section returns the body without frontmatter', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const { data } = await call('get_spec', { spec_id: 'auth' });
    expect(data).toMatchObject({ id: 'auth', title: 'Title of auth', status: 'in-progress' });
    expect(data.content.startsWith('## Context')).toBe(true);
    expect(data.content).not.toContain('title:');
    expect(data.truncated).toBeUndefined();
  });

  it.each(['acceptance-criteria', 'Acceptance criteria', 'critérios de aceite'])(
    'AC-9: get_spec returns only the section for "%s"',
    async (section) => {
      const { root } = await project();
      const { call } = await connect(root);
      const { data } = await call('get_spec', { spec_id: 'auth', section });
      expect(data.section).toBe('acceptance-criteria');
      expect(data.content).toContain('AC-10: lockout');
      expect(data.content).not.toContain('Users log in');
    },
  );

  it('AC-10: unknown spec gives SPEC_NOT_FOUND', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    expect((await call('get_spec', { spec_id: 'nope' })).data).toMatchObject({ code: 'SPEC_NOT_FOUND' });
  });

  it('AC-10: unknown section gives SECTION_NOT_FOUND with the available keys', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('get_spec', { spec_id: 'auth', section: 'design' });
    expect(r.data).toMatchObject({ code: 'SECTION_NOT_FOUND', hint: expect.stringContaining('acceptance-criteria') });
  });

  it.each(['../etc', 'Foo', 'a/b', '/abs'])('AC-11: rejects spec_id "%s" before touching the disk', async (spec_id) => {
    const { root } = await project();
    const { call } = await connect(root);
    const r = await call('get_spec', { spec_id });
    expect(r.isError).toBe(true);
    expect(r.text).not.toContain(root);
  });

  it('AC-12: cuts content to maxResponseChars and flags truncated', async () => {
    const long = spec('long', `## Context\n${'x'.repeat(5000)}\n`);
    const { root } = await makeProject({ '.specwright/specs/long.md': long });
    const { call } = await connect(root, { maxResponseChars: 1000 });
    const { data, text } = await call('get_spec', { spec_id: 'long' });
    expect(data.truncated).toBe(true);
    expect(data.content.length).toBe(1000);
    expect(text.length).toBeLessThan(1200);
  });

  it('AC-12: truncates long listings and flags truncated', async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 60; i++) files[`.specwright/specs/s-${String(i).padStart(3, '0')}.md`] = spec(`s-${String(i).padStart(3, '0')}`);
    const { root } = await makeProject(files);
    const { call } = await connect(root, { maxResponseChars: 1000 });
    const { data, text } = await call('list_specs');
    expect(data.truncated).toBe(true);
    expect(data.specs.length).toBeLessThan(60);
    expect(text.length).toBeLessThanOrEqual(1000);
  });

  it('reads the current file on each call (no stale cache)', async () => {
    const { root } = await project();
    const { call } = await connect(root);
    await call('list_specs');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(root, 'specs/auth.md'), auth.replace('- [ ] AC-10', '- [x] AC-10'));
    const { data } = await call('list_specs');
    expect(data.specs[0].criteria).toEqual({ done: 2, total: 2 });
  });
});
