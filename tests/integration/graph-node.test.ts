import { describe, it, expect, afterEach } from 'vitest';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyFixture, connect } from '../helpers.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

describe('get_node', () => {
  it('US1-AS2: get_node "0002" lists out belongs_to, depends_on, links_to and references, sorted by relation then id, with no incoming edges', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('get_node', { ref: '0002' });
    expect(isError).toBe(false);
    expect(data.node).toMatchObject({ id: 'decision:0002', kind: 'decision', label: 'Share links expire', feature: '002-sharing' });
    expect(data.out).toEqual([
      ['belongs_to', 'feature:002-sharing', 'Sharing'],
      ['depends_on', 'decision:0001', 'Keep photo data as plain files'],
      ['links_to', 'note:keep-ids-stable', 'Keep ids stable'],
      ['references', 'decision:0001', 'Keep photo data as plain files'],
    ]);
    expect(data.in).toEqual([]);
    expect(data.omitted).toEqual({ out: 0, in: 0 });
  });

  it('US1-AS2 (backlinks): get_node "keep-ids-stable" lists links_to from both decisions as incoming edges', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { data } = await call('get_node', { ref: 'keep-ids-stable' });
    expect(data.node.id).toBe('note:keep-ids-stable');
    expect(data.in).toEqual([
      ['links_to', 'decision:0001', 'Keep photo data as plain files'],
      ['links_to', 'decision:0002', 'Share links expire'],
    ]);
  });

  it('FR-010: get_node "FR-002" with feature 001-photo-albums reports read = { artifact: "spec", feature, section } for its heading', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { data } = await call('get_node', { ref: 'FR-002', feature: '001-photo-albums' });
    expect(data.node.id).toBe('requirement:001-photo-albums/FR-002');
    expect(data.node.read).toEqual({ artifact: 'spec', feature: '001-photo-albums', section: 'Requirements *(mandatory)*' });
    expect(data.node.excerpt.length).toBeLessThanOrEqual(500);
    expect(typeof data.community).toBe('number');
  });

  it('US1-AS5: an unknown ref is NODE_NOT_FOUND with a code and a closest-match hint', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('get_node', { ref: 'zebra-quantum-xyzzy' });
    expect(isError).toBe(true);
    expect(data.code).toBe('NODE_NOT_FOUND');
    expect(typeof data.hint).toBe('string');
  });

  it('US1-AS5: a label shared by two nodes is NODE_AMBIGUOUS with a code and a candidates hint', async () => {
    const { root } = await copyFixture('brain');
    await writeFile(join(root, '.specify/memory/notes/keep-ids-copy.md'), '---\ntitle: Keep ids stable\ntype: convention\n---\n# Keep ids stable\n\nA copy.\n');
    const { call } = await connect(root);
    const { isError, data } = await call('get_node', { ref: 'Keep ids stable' });
    expect(isError).toBe(true);
    expect(data.code).toBe('NODE_AMBIGUOUS');
    expect(data.hint).toContain('note:keep-ids-copy');
  });

  it('FEATURE_NOT_FOUND: an unknown feature is an error with a code', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('get_node', { ref: 'FR-002', feature: '999-missing' });
    expect(isError).toBe(true);
    expect(data.code).toBe('FEATURE_NOT_FOUND');
  });

  it('FR-026: two calls in two server instances return byte-identical text', async () => {
    const { root } = await copyFixture('brain');
    const a = await (await connect(root)).call('get_node', { ref: '0002' });
    resetGraphCache();
    const b = await (await connect(root)).call('get_node', { ref: '0002' });
    expect(a.data.node.id).toBe('decision:0002');
    expect(b.text).toBe(a.text);
  });
});
