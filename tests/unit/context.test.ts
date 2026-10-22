import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../../src/context/estimate.js';
import { extractPaths } from '../../src/context/files.js';
import { pack } from '../../src/context/packer.js';
import type { ContextItem } from '../../src/context/types.js';

const item = (ref: string, score: number, chars: number): ContextItem => ({
  kind: 'memory',
  ref,
  title: ref,
  score,
  content: 'x'.repeat(chars),
  tokens: estimateTokens('x'.repeat(chars)),
});

describe('context-pack: units', () => {
  it('AC-2: estimates ceil(chars / 4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('AC-3: fills by score, skips what does not fit and keeps adding smaller items', () => {
    const result = pack([item('big', 9, 4000), item('a', 5, 400), item('b', 3, 400), item('c', 1, 400)], 250);
    expect(result.items.map((i) => i.ref)).toEqual(['a', 'b']);
    expect(result.used).toBe(200);
    expect(result.skipped).toBe(2);
  });

  it('AC-6: extracts unique backticked paths, most cited first, at most 20', () => {
    const text = 'Edit `src/auth.ts` and `src/auth.ts`, see `docs/02-trd.md`, run `npm test`, not `AC-1` nor `x`.';
    expect(extractPaths([text])).toEqual(['src/auth.ts', 'docs/02-trd.md']);
    const many = Array.from({ length: 30 }, (_, i) => `\`src/f${i}.ts\``).join(' ');
    expect(extractPaths([many])).toHaveLength(20);
  });
});
