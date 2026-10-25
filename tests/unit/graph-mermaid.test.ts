import { describe, it, expect } from 'vitest';
import { mermaidFlowchart } from '../../src/graph/mermaid.js';
import type { Confidence, GraphEdge, GraphNode, Relation } from '../../src/graph/types.js';

const node = (id: string, label = id): GraphNode => ({ id, kind: 'concept', label, text: '' });
const edge = (s: string, t: string, relation: Relation = 'related_to', confidence: Confidence = 'EXTRACTED'): GraphEdge =>
  ({ source: s, target: t, relation, confidence, score: 1, origin: 'derived', path: 'x.md' });

describe('mermaidFlowchart', () => {
  it('FR-020: mermaid caps at 40 nodes and 100 edges', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `concept:c${String(i).padStart(2, '0')}`);
    const nodes = ids.map((id) => node(id));
    const edges = ids.flatMap((id, i) => [1, 2, 3].map((d) => edge(id, ids[(i + d) % ids.length])));
    const out = mermaidFlowchart(nodes, edges);
    const nodeLines = out.split('\n').filter((l) => /^\s+n\d+\["/.test(l));
    const edgeLines = out.split('\n').filter((l) => /-->\||-\.->\|/.test(l));
    expect(nodeLines.length).toBe(40);
    expect(edgeLines.length).toBe(100);
  });

  it('FR-020: labels are quoted with " replaced by #quot;, and cut to 40 characters', () => {
    const out = mermaidFlowchart([node('concept:a', 'say "hi" to everyone in the whole wide world today')], []);
    expect(out).toContain('say #quot;hi#quot; to everyone in the');
    expect(out).not.toContain('whole');
    expect(out.startsWith('flowchart LR')).toBe(true);
  });

  it('FR-020: EXTRACTED uses -->, INFERRED -.->, AMBIGUOUS -.->|relation?|', () => {
    const out = mermaidFlowchart(
      [node('concept:a'), node('concept:b'), node('concept:c')],
      [edge('concept:a', 'concept:b', 'depends_on'), edge('concept:b', 'concept:c', 'related_to', 'INFERRED'), edge('concept:c', 'concept:a', 'related_to', 'AMBIGUOUS')],
    );
    expect(out).toContain('-->|depends_on|');
    expect(out).toContain('-.->|related_to|');
    expect(out).toContain('-.->|related_to?|');
  });
});
