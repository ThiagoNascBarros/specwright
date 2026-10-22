import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.js';
import { makeProject } from '../helpers.js';

describe('FR-001: config', () => {
  it('FR-001: defaults the project root to cwd', async () => {
    const { project } = await makeProject();
    expect(loadConfig({}, project)).toEqual({ root: project, maxResponseChars: 20000 });
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
