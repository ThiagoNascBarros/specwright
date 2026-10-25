import { readConstitutionIfSafe as readConstitution } from '../constitution/repository.js';
import { SpecwrightError } from '../errors.js';
import { readDecisions } from '../decisions/repository.js';
import { readArtifact, readAllFeatures, readFeature, assertValid } from '../features/repository.js';
import type { Feature, Task } from '../features/types.js';
import { readMemories } from '../memory/repository.js';
import { score as scoreNote } from '../memory/search.js';
import { parseDocument, stripComments, type Section } from '../storage/markdown.js';
import { countOccurrences, tokenize } from '../storage/text.js';
import { estimateTokens } from './estimate.js';
import type { ContextItem } from './types.js';

export const SECTION_WEIGHTS = { heading: 3, title: 2, content: 1 } as const;

function scoreText(terms: string[], heading: string, title: string, content: string): number {
  const h = tokenize(heading);
  const t = tokenize(title);
  const c = tokenize(content);
  return terms.reduce(
    (sum, term) => sum + countOccurrences(h, term) * SECTION_WEIGHTS.heading + countOccurrences(t, term) * SECTION_WEIGHTS.title + countOccurrences(c, term) * SECTION_WEIGHTS.content,
    0,
  );
}

const makeItem = (fields: Omit<ContextItem, 'tokens'>): ContextItem => ({ ...fields, tokens: estimateTokens(fields.content) });

const taskLine = (t: Task) => `- [ ] ${t.id}${t.parallel ? ' [P]' : ''}${t.story ? ` [${t.story}]` : ''} ${t.text}`.trimEnd();

function sectionItems(terms: string[], f: Feature, file: 'spec.md' | 'plan.md', sections: Section[]): ContextItem[] {
  const kind = file === 'spec.md' ? 'spec-section' : 'plan-section';
  return sections.map((s) =>
    makeItem({ kind, ref: `${f.id}/${file}#${s.key}`, title: `${f.title} — ${s.heading}`, score: scoreText(terms, s.heading, f.title, s.content), content: s.content }),
  );
}

function taskItems(terms: string[], f: Feature): ContextItem[] {
  return f.tasks
    .filter((t) => !t.done)
    .map((t) => makeItem({ kind: 'task', ref: `${f.id}/tasks.md#${t.id}`, title: `${t.id} ${t.text}`, score: scoreText(terms, t.phase, f.title, t.text), content: taskLine(t) }));
}

async function planSections(root: string, f: Feature): Promise<Section[]> {
  if (!f.artifacts.includes('plan')) return [];
  try {
    const { raw } = await readArtifact(root, f.id, 'plan');
    return parseDocument(stripComments(raw.replace(/\r\n?/g, '\n'))).sections;
  } catch (error) {
    // A plan that cannot be read safely is left out of the context, not fatal for the whole call.
    if (error instanceof SpecwrightError) return [];
    throw error;
  }
}

/**
 * Scored candidates for `terms`. `pinned` holds the open tasks of `featureId` in file order
 * (when given); `ranked` holds every other relevant item, best first.
 */
export async function collectCandidates(root: string, terms: string[], featureId?: string): Promise<{ pinned: ContextItem[]; ranked: ContextItem[] }> {
  let features: Feature[];
  if (featureId) {
    const { feature } = await readFeature(root, featureId);
    assertValid(feature);
    features = [feature];
  } else {
    features = (await readAllFeatures(root)).filter((f) => f.valid);
  }
  const unique = [...new Set(terms)];
  const [memories, decisions, constitution, plans] = await Promise.all([
    readMemories(root),
    readDecisions(root),
    readConstitution(root),
    Promise.all(features.map((f) => planSections(root, f))),
  ]);

  const pinned = featureId ? taskItems(unique, features[0]) : [];
  const all = [
    ...features.flatMap((f, i) => [...sectionItems(unique, f, 'spec.md', f.spec!.sections), ...sectionItems(unique, f, 'plan.md', plans[i]), ...(featureId ? [] : taskItems(unique, f))]),
    ...(constitution?.principles ?? []).map((p) =>
      makeItem({ kind: 'constitution', ref: `constitution#${p.key}`, title: p.name, score: scoreText(unique, p.name, '', p.content), content: p.content }),
    ),
    ...memories.map((m) => makeItem({ kind: 'memory', ref: m.id, title: m.title, score: scoreNote(unique, m), content: m.body })),
    ...decisions.map((d) => makeItem({ kind: 'decision', ref: d.id, title: d.title, score: scoreNote(unique, { title: d.title, tags: [], body: d.body }), content: d.body })),
  ];
  const ranked = all.filter((i) => i.score > 0).sort((a, b) => b.score - a.score || a.tokens - b.tokens || a.ref.localeCompare(b.ref));
  return { pinned, ranked };
}
