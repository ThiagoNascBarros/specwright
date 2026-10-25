import { makeProject, specMd } from '../helpers.js';

export const WORDS = ['cache', 'retry', 'timeout', 'schema', 'deploy', 'naming', 'logging', 'auth', 'billing', 'queue'];

/** A Spec Kit project with `features` feature folders, `notes` notes and `decisions` decisions. */
export function speckitDataset(features: number, notes = 0, decisions = 0, opts: { links?: boolean } = {}) {
  const files: Record<string, string> = {};
  const featureId = (i: number): string => `${String(i + 1).padStart(4, '0')}-feature-${i}`;
  for (let i = 0; i < features; i++) {
    const id = `${String(i + 1).padStart(4, '0')}-feature-${i}`;
    const w = WORDS[i % WORDS.length];
    const story = `### User Story 1 - ${w} flow (Priority: P1)\n\n${`About ${w} handling. `.repeat(15)}\n\n**Acceptance Scenarios**:\n\n1. **Given** a ${w}, **When** it runs, **Then** it works\n`;
    const frs = Array.from({ length: 10 }, (_, n) => `- **FR-${String(n + 1).padStart(3, '0')}**: System MUST support ${w} case ${n + 1}`).join('\n');
    files[`specs/${id}/spec.md`] = specMd(`Feature ${i} on ${w}`, `## User Scenarios & Testing *(mandatory)*\n\n${story}\n## Requirements *(mandatory)*\n\n### Functional Requirements\n\n${frs}\n`);
    const tasks = Array.from({ length: 10 }, (_, n) => `- [${n % 2 ? 'X' : ' '}] T${String(n + 1).padStart(3, '0')} [P] [US1] ${w} task ${n + 1} in src/${w}/${n}.ts`);
    const linkTask = opts.links ? `\n- [ ] T011 [US1] check FR-003 in src/${w}.ts` : '';
    files[`specs/${id}/tasks.md`] = `# Tasks: Feature ${i}\n\n## Phase 1: User Story 1 - ${w} flow (Priority: P1)\n\n${tasks.join('\n')}${linkTask}\n`;
  }
  for (let i = 0; i < notes; i++) {
    const w = WORDS[i % WORDS.length];
    const mention = opts.links ? `\nRelates to ${featureId(i % features)}/FR-002.` : '';
    files[`.specify/memory/notes/m-${i}.md`] = `---\nid: m-${i}\ntype: learning\ntitle: Note ${i} about ${w}\ntags: [${w}]\ndate: 2026-10-21\n---\n${`Details about ${w} and more text. `.repeat(20)}${mention}\n`;
  }
  for (let i = 1; i <= decisions; i++) {
    const id = String(i).padStart(4, '0');
    const body = opts.links && notes > 0 ? `Text. See FR-001 and [[m-${(i - 1) % notes}]].` : 'Text.';
    files[`.specify/memory/decisions/${id}-d.md`] = `---\nid: "${id}"\nfeature: 0001-feature-0\ntitle: Decision ${i} on ${WORDS[i % WORDS.length]}\ndate: 2026-10-21\nstatus: accepted\n---\n## Decision\n${body}\n`;
  }
  return makeProject(files);
}
