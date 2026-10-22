import { normalizeKey, type Section } from '../storage/markdown.js';

// Spec Kit headings carry annotations such as "## Requirements *(mandatory)*".
const ANNOTATION = /\s*\*\([^)]*\)\*\s*$/;

/** Finds a `##` section by its key, its heading text, or its heading without the template annotation. */
export function findSection(sections: Section[], query: string): Section | undefined {
  const key = normalizeKey(query);
  return sections.find((s) => s.key === key || normalizeKey(s.heading.replace(ANNOTATION, '')) === key);
}
