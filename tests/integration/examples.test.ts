import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseSpec } from '../../src/specs/parser.js';

const dir = fileURLToPath(new URL('../../examples/starter/.specwright/specs/', import.meta.url));

describe('shipped examples', () => {
  it('every example spec is valid, so the README quick start works', async () => {
    const names = (await readdir(dir)).filter((n) => n.endsWith('.md'));
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      const spec = parseSpec(name.slice(0, -3), await readFile(dir + name, 'utf8'));
      expect(spec, name).toMatchObject({ valid: true, issues: [] });
      expect(spec.criteria.length, name).toBeGreaterThan(0);
    }
  });
});
