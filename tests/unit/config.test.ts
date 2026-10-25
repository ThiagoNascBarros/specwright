import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.js';
import { makeProject } from '../helpers.js';

describe('FR-001: config', () => {
  it('FR-001: defaults the project root to cwd', async () => {
    const { project } = await makeProject();
    expect(loadConfig({}, project)).toEqual({ root: project, maxResponseChars: 20000, graph: { include: [], cache: 'disk', vaultDir: '.specify/graph/vault' } });
  });

  it('FR-001: resolves a relative SPECWRIGHT_ROOT against cwd', async () => {
    const { project } = await makeProject();
    expect(loadConfig({ SPECWRIGHT_ROOT: 'app' }, project).root).toBe(join(project, 'app'));
  });

  it('FR-001: reads maxResponseChars from .specify/specwright.json and ignores unknown fields', async () => {
    const { project } = await makeProject({ '.specify/specwright.json': '{"maxResponseChars": 500, "x": 1}' });
    expect(loadConfig({}, project).maxResponseChars).toBe(500);
  });

  it('rejects an invalid config file with a clear message', async () => {
    const { project } = await makeProject({ '.specify/specwright.json': '{"maxResponseChars": -1}' });
    expect(() => loadConfig({}, project)).toThrow(/maxResponseChars/);
  });

  it('ignores the v0.1.0 .specwright/config.json', async () => {
    const { project } = await makeProject({ '.specwright/config.json': '{"maxResponseChars": 500}' });
    expect(loadConfig({}, project).maxResponseChars).toBe(20000);
  });
});

describe('FR-021: graph config', () => {
  const graphFile = (graph: string) => ({ '.specify/specwright.json': `{"graph": ${graph}}` });

  it('FR-021: graph defaults to { include: [], cache: "disk", vaultDir: ".specify/graph/vault" } when absent', async () => {
    const { project } = await makeProject();
    expect(loadConfig({}, project).graph).toEqual({ include: [], cache: 'disk', vaultDir: '.specify/graph/vault' });
  });

  it('FR-021: graph.include accepts "docs" and "notes/vault/" (normalized to "notes/vault")', async () => {
    const { project } = await makeProject(graphFile('{"include": ["docs", "notes/vault/"]}'));
    expect(loadConfig({}, project).graph.include).toEqual(['docs', 'notes/vault']);
  });

  it('FR-021: graph.include rejects "../x", "/abs", "C:/x", ".obsidian", "specs", ".specify/x", "a/node_modules", "a/.git"', async () => {
    for (const bad of ['../x', '/abs', 'C:/x', '.obsidian', 'specs', '.specify/x', 'a/node_modules', 'a/.git']) {
      const { project } = await makeProject(graphFile(JSON.stringify({ include: [bad] })));
      expect(() => loadConfig({}, project), bad).toThrow(/Invalid .*specwright\.json/);
    }
  });

  it('FR-007: graph.cache accepts disk|memory|off and rejects "redis"', async () => {
    for (const cache of ['disk', 'memory', 'off']) {
      const { project } = await makeProject(graphFile(JSON.stringify({ cache })));
      expect(loadConfig({}, project).graph.cache).toBe(cache);
    }
    const { project } = await makeProject(graphFile('{"cache": "redis"}'));
    expect(() => loadConfig({}, project)).toThrow(/Invalid .*specwright\.json/);
  });

  it('FR-021: graph.vaultDir accepts ".specify/graph/vault" and "brain", and rejects "specs/x", "../x" and ".obsidian"', async () => {
    for (const ok of ['.specify/graph/vault', 'brain']) {
      const { project } = await makeProject(graphFile(JSON.stringify({ vaultDir: ok })));
      expect(loadConfig({}, project).graph.vaultDir).toBe(ok);
    }
    for (const bad of ['specs/x', '../x', '.obsidian']) {
      const { project } = await makeProject(graphFile(JSON.stringify({ vaultDir: bad })));
      expect(() => loadConfig({}, project), bad).toThrow(/Invalid .*specwright\.json/);
    }
  });
});
