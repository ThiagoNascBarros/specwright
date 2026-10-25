import { describe, it, expect } from 'vitest';
import { contentHash } from '../../src/storage/hash.js';

describe('FR-021: contentHash', () => {
  it('FR-021: normalizes line endings, ignores the BOM and is 16 hex chars', () => {
    expect(contentHash('a\r\nb')).toBe(contentHash('a\nb'));
    expect(contentHash('a\rb')).toBe(contentHash('a\nb'));
    expect(contentHash('\uFEFFa\nb')).toBe(contentHash('a\nb'));
    expect(contentHash('a\nb')).toMatch(/^[0-9a-f]{16}$/);
  });
});
