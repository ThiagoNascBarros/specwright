import { listItems, parseDocument, scanLines, stripComments } from '../storage/markdown.js';
import type { Item, Specification, UserStory } from './types.js';

const TITLE = /^#\s+Feature Specification:\s*(.+?)\s*$/;
const META = /^\*\*(Feature Branch|Created|Status|Input)\*\*:\s*(.*?)\s*$/;
const STORY = /^###\s+User Story\s+(\d+)\s*-\s*(.+?)\s*\(Priority:\s*(P\d+)\)\s*$/;
const SCENARIO = /^\s*\d+\.\s+(.*\*\*Given\*\*.*)$/;
const ITEM = /^\s*[-*]\s+\*\*((?:FR|SC)-\d{3,})\*\*:\s*(.+?)\s*$/;
const CLARIFICATION = /\[NEEDS CLARIFICATION:\s*([^\]]+?)\s*\]/g;
const HEADING = /^#{1,6}\s/;

const plain = (text: string) => text.replace(/\*\*/g, '').trim();
const unquote = (text: string) => text.replace(/^`(.*)`$/, '$1');

/** Parses `spec.md` as Spec Kit's spec template writes it (FR-003). Never throws. */
export function parseSpecification(raw: string): Specification {
  const text = stripComments(raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n'));
  const doc = parseDocument(text);
  const meta: Record<string, string> = {};
  let title = '';
  const userStories: UserStory[] = [];
  const requirements: Item[] = [];
  const successCriteria: Item[] = [];
  const clarifications: string[] = [];
  let story: UserStory | undefined;

  for (const { text: line, skip } of scanLines(text)) {
    if (skip) continue;
    for (const m of line.matchAll(CLARIFICATION)) clarifications.push(m[1]);
    const t = TITLE.exec(line);
    if (t && !title) title = t[1];
    const m = META.exec(line);
    if (m && meta[m[1]] === undefined) meta[m[1]] = m[2];
    const s = STORY.exec(line);
    if (s) {
      story = { number: Number(s[1]), title: s[2], priority: s[3], scenarios: [] };
      userStories.push(story);
      continue;
    }
    if (HEADING.test(line)) story = undefined;
    const scenario = story && SCENARIO.exec(line);
    if (scenario) story!.scenarios.push(plain(scenario[1]));
    const item = ITEM.exec(line);
    if (item) (item[1].startsWith('FR') ? requirements : successCriteria).push({ id: item[1], text: item[2] });
  }

  const edgeCases = subsection(text, 'Edge Cases');
  const assumptions = doc.sections.find((s) => s.key === 'assumptions');
  return {
    title,
    branch: unquote(meta['Feature Branch'] ?? ''),
    created: meta.Created ?? '',
    status: meta.Status ?? '',
    input: meta.Input ?? '',
    sections: doc.sections,
    userStories,
    requirements,
    successCriteria,
    edgeCases,
    assumptions: assumptions ? listItems(assumptions.content) : [],
    clarifications,
  };
}

/** List items under a `### <name>` heading, up to the next heading. */
function subsection(text: string, name: string): string[] {
  const lines: string[] = [];
  let inside = false;
  for (const { text: line, skip } of scanLines(text)) {
    if (skip) continue;
    if (HEADING.test(line)) {
      inside = new RegExp(`^###\\s+${name}\\s*$`).test(line);
      continue;
    }
    if (inside) lines.push(line);
  }
  return listItems(lines.join('\n'));
}
