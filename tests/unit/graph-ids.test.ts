import { describe, it, expect } from 'vitest';
import { nodeId, parseNodeId, scopeOfNode, conceptIdFor, CONCEPT_ID } from '../../src/graph/ids.js';

describe('graph: node ids', () => {
  it('FR-002: builds and parses every id kind', () => {
    expect(nodeId.requirement('006-memory', 'FR-003')).toBe('requirement:006-memory/FR-003');
    expect(parseNodeId('requirement:006-memory/FR-003')).toEqual({ kind: 'requirement', key: '006-memory/FR-003' });
    expect(nodeId.artifact('001-x', 'contract/api')).toBe('artifact:001-x/contract/api');
    expect(parseNodeId('artifact:001-x/contract/api')).toEqual({ kind: 'artifact', key: '001-x/contract/api' });
    expect(nodeId.constitution()).toBe('artifact:constitution');
    expect(nodeId.feature('001-x')).toBe('feature:001-x');
    expect(nodeId.criterion('001-x', 'SC-002')).toBe('criterion:001-x/SC-002');
    expect(nodeId.story('001-x', 'US1')).toBe('story:001-x/US1');
    expect(nodeId.task('001-x', 'T009')).toBe('task:001-x/T009');
    expect(nodeId.principle('quality')).toBe('principle:quality');
    expect(nodeId.decision('0007')).toBe('decision:0007');
    expect(nodeId.note('cache-notes')).toBe('note:cache-notes');
    expect(nodeId.doc('docs/01-prd.md')).toBe('doc:docs/01-prd.md');
    expect(nodeId.file('src/index.ts')).toBe('file:src/index.ts');
    expect(nodeId.concept('cache')).toBe('concept:cache');
  });

  it('FR-002: parseNodeId rejects unknown kinds and empty keys', () => {
    expect(parseNodeId('widget:abc')).toBeUndefined();
    expect(parseNodeId('feature:')).toBeUndefined();
    expect(parseNodeId('feature')).toBeUndefined();
    expect(parseNodeId('')).toBeUndefined();
  });

  it('FR-015: scopeOfNode is the feature, or "project"', () => {
    expect(scopeOfNode({ feature: '001-x' })).toBe('001-x');
    expect(scopeOfNode({})).toBe('project');
  });

  it('FR-014: conceptIdFor slugifies the label and matches CONCEPT_ID', () => {
    expect(conceptIdFor('Decisão de cache 🚀')).toBe('concept:decisao-de-cache');
    expect(conceptIdFor('🚀🚀')).toBe('concept:concept');
    expect(CONCEPT_ID.test(conceptIdFor('Decisão de cache 🚀'))).toBe(true);
    expect(CONCEPT_ID.test('concept:Bad_Id')).toBe(false);
  });
});
