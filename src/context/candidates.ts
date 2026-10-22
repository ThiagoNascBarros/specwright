import { readDecisions } from '../decisions/repository.js';
import { readMemories } from '../memory/repository.js';
import { score as scoreNote } from '../memory/search.js';
import { findSection } from '../specs/parser.js';
import { assertValid, readAllSpecs, readSpec } from '../specs/repository.js';
import type { Spec } from '../specs/types.js';
import { countOccurrences, tokenize } from '../storage/text.js';
import { estimateTokens } from './estimate.js';
import type { ContextItem } from './types.js';

export const SECTION_WEIGHTS = { heading: 3, specTitle: 2, content: 1 } as const;

function scoreSection(terms: string[], heading: string, specTitle: string, content: string): number {
  const h = tokenize(heading);
  const t = tokenize(specTitle);
  const c = tokenize(content);
  return terms.reduce(
    (sum, term) =>
      sum +
      countOccurrences(h, term) * SECTION_WEIGHTS.heading +
      countOccurrences(t, term) * SECTION_WEIGHTS.specTitle +
      countOccurrences(c, term) * SECTION_WEIGHTS.content,
    0,
  );
}

const makeItem = (fields: Omit<ContextItem, 'tokens'>): ContextItem => ({ ...fields, tokens: estimateTokens(fields.content) });

function sectionItems(terms: string[], spec: Spec): ContextItem[] {
  return spec.sections.map((s) =>
    makeItem({ kind: 'spec-section', ref: `${spec.id}#${s.key}`, title: `${spec.title} — ${s.heading}`, score: scoreSection(terms, s.heading, spec.title, s.content), content: s.content }),
  );
}

/**
 * Collects scored candidates for `terms`. `pinned` holds the acceptance criteria of `specId`
 * (when given); `ranked` holds every other relevant item, best first.
 */
export async function collectCandidates(root: string, terms: string[], specId?: string): Promise<{ pinned: ContextItem[]; ranked: ContextItem[] }> {
  let specs: Spec[];
  if (specId) {
    const { spec } = await readSpec(root, specId);
    assertValid(spec);
    specs = [spec];
  } else {
    specs = (await readAllSpecs(root)).filter((s) => s.valid);
  }
  const unique = [...new Set(terms)];
  const [memories, decisions] = await Promise.all([readMemories(root), readDecisions(root)]);

  const pinnedSection = specId ? findSection(specs[0], 'acceptance-criteria') : undefined;
  const pinnedRef = pinnedSection ? `${specId}#${pinnedSection.key}` : undefined;
  const all = [
    ...specs.flatMap((s) => sectionItems(unique, s)),
    ...memories.map((m) => makeItem({ kind: 'memory', ref: m.id, title: m.title, score: scoreNote(unique, m), content: m.body })),
    ...decisions.map((d) => makeItem({ kind: 'decision', ref: d.id, title: d.title, score: scoreNote(unique, { title: d.title, tags: [], body: d.body }), content: d.body })),
  ];
  const pinned = all.filter((i) => i.ref === pinnedRef);
  const ranked = all
    .filter((i) => i.ref !== pinnedRef && i.score > 0)
    .sort((a, b) => b.score - a.score || a.tokens - b.tokens || a.ref.localeCompare(b.ref));
  return { pinned, ranked };
}
