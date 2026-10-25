import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { copyFixture, connect } from '../helpers.js';
import { DEFAULT_GRAPH_CONFIG } from '../../src/config.js';
import { resetGraphCache } from '../../src/graph/service.js';

afterEach(() => resetGraphCache());

describe('export_graph', () => {
  it('US7-AS3: obsidian export twice → the second run writes 0; a user note at a generated path is skipped and left alone; .obsidian/ is never created; notes for deleted nodes are removed', async () => {
    const { root } = await copyFixture('brain');
    const userNote = join(root, '.specify/graph/vault/decision/0001.md');
    await mkdir(join(root, '.specify/graph/vault/decision'), { recursive: true });
    await writeFile(userNote, '# My own note\n');
    const { call } = await connect(root);
    const first = await call('export_graph', { format: 'obsidian' });
    expect(first.isError).toBe(false);
    expect(first.data.path).toBe('.specify/graph/vault');
    expect(first.data.written).toBeGreaterThan(0);
    expect(first.data.skipped).toContain('.specify/graph/vault/decision/0001.md');
    expect(await readFile(userNote, 'utf8')).toBe('# My own note\n');

    const second = await call('export_graph', { format: 'obsidian' });
    expect(second.data.written).toBe(0);
    expect(second.data.unchanged).toBeGreaterThan(0);
    expect(second.data.skipped).toContain('.specify/graph/vault/decision/0001.md');
    expect(existsSync(join(root, '.obsidian'))).toBe(false);

    await rm(join(root, '.specify/memory/decisions/0002-share-links-expire.md'));
    resetGraphCache();
    const third = await connect(root);
    const after = await third.call('export_graph', { format: 'obsidian' });
    expect(after.data.removed).toBeGreaterThan(0);
    expect(existsSync(join(root, '.specify/graph/vault/decision/0002.md'))).toBe(false);
  });

  it('US7-AS4: report export writes .specify/graph/GRAPH_REPORT.md', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('export_graph', { format: 'report' });
    expect(isError).toBe(false);
    expect(data.path).toBe('.specify/graph/GRAPH_REPORT.md');
    expect(data.written).toBe(1);
    expect(await readFile(join(root, data.path), 'utf8')).toContain('# Project graph');
  });

  it('FR-020: json export writes .specify/graph/graph.json', async () => {
    const { root } = await copyFixture('brain');
    const { call } = await connect(root);
    const { isError, data } = await call('export_graph', { format: 'json' });
    expect(isError).toBe(false);
    expect(data.path).toBe('.specify/graph/graph.json');
    const value = JSON.parse(await readFile(join(root, data.path), 'utf8'));
    expect(value.schema).toBe(1);
    expect(value.generator).toMatch(/^specwright /);
  });

  it('FR-021: vaultDir "brain" exports to brain/ and no other path outside .specify/ is written', async () => {
    const { root } = await copyFixture('brain');
    const before = new Set(await readdir(root));
    const { call } = await connect(root, { graph: { ...DEFAULT_GRAPH_CONFIG, vaultDir: 'brain' } });
    const { isError, data } = await call('export_graph', { format: 'obsidian' });
    expect(isError).toBe(false);
    expect(data.path).toBe('brain');
    expect(existsSync(join(root, 'brain/_community-0.md'))).toBe(true);
    const added = (await readdir(root)).filter((n) => !before.has(n));
    expect(added).toEqual(['brain']);
  });
});
