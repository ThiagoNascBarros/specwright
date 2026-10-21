import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/storage/slug.js';

describe('decision-log: slug', () => {
  it('AC-4: strips accents and keeps only [a-z0-9-]', () => {
    expect(slugify('Bloqueio por conta, não por IP!')).toBe('bloqueio-por-conta-nao-por-ip');
  });

  it('AC-4: cuts to 50 characters without a trailing dash', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('AC-4: never ends mid-word when a word boundary exists', () => {
    expect(slugify('In-process queue plus exclusive create for numbering')).toBe('in-process-queue-plus-exclusive-create-for');
    expect(slugify('x'.repeat(80))).toBe('x'.repeat(50));
  });

  it('AC-4: returns an empty string when nothing is left', () => {
    expect(slugify('🚀🚀')).toBe('');
  });
});
