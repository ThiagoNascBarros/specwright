import { describe, it, expect } from 'vitest';
import { featureFacts } from '../../src/graph/facts-feature.js';

const F = '010-x';
const SPEC = `# Feature Specification: Sorting

**Input**: sort albums

### User Story 2 - Sort (Priority: P1)
Intro mentions FR-002 and [[2026-01-15]].
1. **Given** a, **When** b, **Then** c

## Requirements
- **FR-002**: Albums sort by date. See SC-001.
- **SC-001**: Fast.

<!-- FR-009 hidden -->
\`\`\`
- **FR-008**: in fence
\`\`\`
`;
const spec = () => featureFacts({ path: `specs/${F}/spec.md`, kind: 'spec', feature: F, raw: SPEC });

describe('graph: facts of feature artifacts', () => {
  it('FR-002: spec.md yields feature, artifact, requirement, criterion and story nodes with lines and sections', () => {
    const n = new Map(spec().nodes.map((x) => [x.id, x]));
    expect([...n.keys()].sort()).toEqual([`artifact:${F}/spec`, `criterion:${F}/SC-001`, `feature:${F}`, `requirement:${F}/FR-002`, `story:${F}/US2`]);
    expect(n.get(`requirement:${F}/FR-002`)).toMatchObject({ line: 10, section: 'requirements', heading: 'Requirements', label: 'FR-002 Albums sort by date. See SC-001.', feature: F, path: `specs/${F}/spec.md` });
    expect(n.get(`story:${F}/US2`)).toMatchObject({ line: 5, label: 'US2 Sort' });
    expect(n.get(`story:${F}/US2`)!.text).toContain('Given');
    expect(n.get(`feature:${F}`)).toMatchObject({ label: 'Sorting', line: 1 });
    expect(spec().edges.filter((e) => e.relation === 'contains')).toHaveLength(4);
  });

  it('FR-003: tasks.md T005 [US2] yields task node done=false, contains + implements edges, mention FR-002 owned by the task, path src/albums/sort.ts owned by the task', () => {
    const raw = '# Tasks\n\n- [ ] T005 [US2] Sort per FR-002 in `src/albums/sort.ts`\n  continues SC-001\n- [x] T006 other\n';
    const r = featureFacts({ path: `specs/${F}/tasks.md`, kind: 'tasks', feature: F, raw });
    expect(r.nodes.find((x) => x.id === `task:${F}/T005`)).toMatchObject({ done: false, line: 3 });
    expect(r.nodes.find((x) => x.id === `task:${F}/T006`)?.done).toBe(true);
    expect(r.edges.map((e) => `${e.source}>${e.relation}>${e.target}`)).toContain(`task:${F}/T005>implements>story:${F}/US2`);
    expect(r.edges.map((e) => e.relation + e.target)).toContain(`contains${'task:' + F + '/T005'}`);
    expect(r.mentions).toContainEqual({ from: `task:${F}/T005`, line: 3, type: 'item', id: 'FR-002', feature: F });
    expect(r.mentions).toContainEqual({ from: `task:${F}/T005`, line: 4, type: 'item', id: 'SC-001', feature: F });
    expect(r.paths).toEqual([{ from: `task:${F}/T005`, line: 3, path: 'src/albums/sort.ts' }]);
    expect(r.units).toEqual([]);
  });

  it('FR-003: lines in fences and comments yield nothing', () => {
    const r = spec();
    expect(r.mentions.some((m) => m.id === 'FR-002')).toBe(true);
    expect(r.mentions.some((m) => m.id === 'FR-009' || m.id === 'FR-008')).toBe(false);
    expect(r.nodes.some((x) => x.id.endsWith('FR-008'))).toBe(false);
  });

  it('FR-003: the owner of an FR item line is the requirement; of other lines, the artifact', () => {
    const r = spec();
    expect(r.mentions).toContainEqual({ from: `requirement:${F}/FR-002`, line: 10, type: 'item', id: 'SC-001', feature: F });
    expect(r.mentions.find((m) => m.line === 6 && m.id === 'FR-002')?.from).toBe(`story:${F}/US2`);
    const p = featureFacts({ path: `specs/${F}/plan.md`, kind: 'plan', feature: F, raw: '# Plan\n\n## A\nSee FR-001 and [[note]].\n' });
    expect(p.mentions[0].from).toBe(`artifact:${F}/plan`);
    expect(p.links).toEqual([{ from: `artifact:${F}/plan`, line: 4, form: 'wiki', target: 'note' }]);
  });

  it('FR-013: tasks.md has no units; spec.md has one per section', () => {
    expect(spec().units.map((u) => u.section)).toEqual(['requirements']);
    expect(featureFacts({ path: `specs/${F}/tasks.md`, kind: 'tasks', feature: F, raw: '## A\n- [ ] T001 x\n' }).units).toEqual([]);
  });

  it('FR-003: link targets are not mentions', () => {
    expect(spec().mentions.some((m) => m.id === 'FR-002' && m.line === 6)).toBe(true);
    expect(spec().mentions.some((m) => m.type === 'feature')).toBe(false);
  });
});
