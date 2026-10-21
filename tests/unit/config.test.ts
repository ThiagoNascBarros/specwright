import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { loadConfig } from '../../src/config.js';
import { makeProject } from '../helpers.js';

describe('spec-reading: config', () => {
  it('AC-1: resolves a relative SPECWRIGHT_DIR against cwd', async () => {
    const { project } = await makeProject();
    expect(loadConfig({ SPECWRIGHT_DIR: 'docs/sw' }, project).root).toBe(join(project, 'docs/sw'));
  });

  it('AC-1: defaults to .specwright and maxResponseChars 20000', async () => {
    const { project } = await makeProject();
    expect(loadConfig({}, project)).toEqual({ root: join(project, '.specwright'), maxResponseChars: 20000 });
  });

  it('AC-1: reads maxResponseChars from config.json and ignores unknown fields', async () => {
    const { project } = await makeProject({ '.specwright/config.json': '{"maxResponseChars": 500, "other": true}' });
    expect(loadConfig({}, project)).toEqual({ root: join(project, '.specwright'), maxResponseChars: 500 });
  });

  it('AC-1: keeps the default when config.json has no maxResponseChars', async () => {
    const { project } = await makeProject({ '.specwright/config.json': '{}' });
    expect(loadConfig({}, project).maxResponseChars).toBe(20000);
  });

  it('rejects an invalid config.json with a clear message', async () => {
    const { project } = await makeProject({ '.specwright/config.json': '{"maxResponseChars": -1}' });
    expect(() => loadConfig({}, project)).toThrow(/maxResponseChars/);
  });
});
