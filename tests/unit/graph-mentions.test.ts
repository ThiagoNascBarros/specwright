import { describe, it, expect } from 'vitest';
import { findMentions } from '../../src/graph/mentions.js';

describe('graph: mentions', () => {
  it('FR-003: finds FR-003, SC-001, US2, T012 and qualified 006-memory/FR-003 (feature set)', () => {
    expect(findMentions('FR-003, SC-001, US2, T012 and 006-memory/FR-003')).toEqual([
      { type: 'item', id: 'FR-003' }, { type: 'item', id: 'SC-001' }, { type: 'story', id: 'US2' },
      { type: 'task', id: 'T012' }, { type: 'item', id: 'FR-003', feature: '006-memory' },
    ]);
  });
  it('FR-003: "decision 0007" and "decisions 0009 and 0010" give 3 decision mentions', () => {
    expect(findMentions('see decision 0007 and decisions 0009 and 0010')).toEqual([
      { type: 'decision', id: '0007' }, { type: 'decision', id: '0009' }, { type: 'decision', id: '0010' },
    ]);
  });
  it('FR-003: feature-id tokens such as 002-sharing are returned (validated later), and dates are returned as feature candidates too', () => {
    expect(findMentions('uses 002-sharing')).toEqual([{ type: 'feature', id: '002-sharing' }]);
    expect(findMentions('on 2026-01-15')).toEqual([{ type: 'feature', id: '2026-01-15' }]);
  });
  it('FR-003: T0010 is not T001', () => {
    expect(findMentions('T0010')).not.toContainEqual({ type: 'task', id: 'T001' });
    expect(findMentions('T001')).toEqual([{ type: 'task', id: 'T001' }]);
  });
});
