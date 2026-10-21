import { listItems, normalizeKey, parseDocument, type Section } from '../storage/markdown.js';
import { SPEC_STATUSES, type CriteriaCount, type Criterion, type Spec, type SpecSummary } from './types.js';

/** Portuguese headings from the original specs are accepted as aliases of the English keys. */
const ALIASES: Record<string, string> = {
  'criterios-de-aceite': 'acceptance-criteria',
  'fora-de-escopo': 'out-of-scope',
};

export const CRITERION_LINE = /^\s*[-*] \[( |x|X)\] (AC-\d+):\s*(.+?)\s*$/;
const CHECKBOX_LINE = /^\s*[-*] \[( |x|X)\]/;

const canonical = (key: string) => ALIASES[key] ?? key;

export function findSection(spec: Pick<Spec, 'sections'>, query: string): Section | undefined {
  const key = canonical(normalizeKey(query));
  return spec.sections.find((s) => canonical(s.key) === key);
}

export function countCriteria(criteria: Criterion[]): CriteriaCount {
  return { done: criteria.filter((c) => c.done).length, total: criteria.length };
}

export function summarize(spec: Spec): SpecSummary {
  const summary: SpecSummary = { id: spec.id, title: spec.title, status: spec.status, valid: spec.valid, criteria: countCriteria(spec.criteria) };
  if (spec.issues.length) summary.issues = spec.issues;
  return summary;
}

/** Parses a spec file. `fileId` is the file name without `.md`. Never throws. */
export function parseSpec(fileId: string, raw: string): Spec {
  const doc = parseDocument(raw);
  const errors: string[] = [];
  const warnings: string[] = [];
  const fm = (doc.frontmatter && typeof doc.frontmatter === 'object' ? doc.frontmatter : {}) as Record<string, unknown>;

  if (doc.frontmatterError) errors.push(`invalid frontmatter: ${doc.frontmatterError}`);
  else if (doc.frontmatter === undefined) errors.push('missing frontmatter');
  else {
    if (fm.id === undefined) errors.push('missing id');
    else if (String(fm.id) !== fileId) errors.push(`id "${String(fm.id)}" does not match file name "${fileId}"`);
    if (typeof fm.title !== 'string' || !fm.title.trim()) errors.push('missing title');
    if (!SPEC_STATUSES.includes(fm.status as never)) errors.push(`status must be one of ${SPEC_STATUSES.join(', ')}`);
  }

  const seen = new Set<string>();
  for (const s of doc.sections) {
    const key = canonical(s.key);
    if (seen.has(key)) errors.push(`duplicate heading "## ${s.heading}"`);
    seen.add(key);
  }

  const criteria: Criterion[] = [];
  const criteriaSection = findSection(doc, 'acceptance-criteria');
  for (const line of criteriaSection?.content.split('\n') ?? []) {
    const m = CRITERION_LINE.exec(line);
    if (m) {
      if (criteria.some((c) => c.id === m[2])) errors.push(`duplicate criterion ${m[2]}`);
      else criteria.push({ id: m[2], done: m[1] !== ' ', text: m[3] });
    } else if (CHECKBOX_LINE.test(line)) {
      warnings.push(`checkbox without AC id ignored: "${line.trim()}"`);
    }
  }

  const outOfScope = findSection(doc, 'out-of-scope');
  return {
    id: fileId,
    title: typeof fm.title === 'string' ? fm.title : '',
    status: typeof fm.status === 'string' ? fm.status : '',
    valid: errors.length === 0,
    issues: [...errors, ...warnings],
    body: doc.body.replace(/^\n+/, ''),
    sections: doc.sections,
    criteria,
    outOfScope: outOfScope ? listItems(outOfScope.content) : [],
  };
}
