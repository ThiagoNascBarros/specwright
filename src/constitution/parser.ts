import { normalizeKey, parseDocument, scanLines, stripComments } from '../storage/markdown.js';
import type { Constitution, Principle } from './types.js';

const H3 = /^###\s+(.+?)\s*$/;

/** Parses the constitution: `###` principles under `## Core Principles`, and the version line. Never throws. */
export function parseConstitution(raw: string): Constitution {
  const content = stripComments(raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')).trim();
  const doc = parseDocument(content);
  const title = /^#\s+(.+?)\s*$/m.exec(content)?.[1] ?? '';
  const version = /\*\*Version\*\*:\s*([^\s|]+)/.exec(content)?.[1] ?? '';
  const core = doc.sections.find((s) => s.key === 'core-principles');
  const principles: Principle[] = [];
  let current: { name: string; lines: string[] } | undefined;
  const flush = () => {
    if (current) principles.push({ key: normalizeKey(current.name), name: current.name, content: current.lines.join('\n').trim() });
  };
  for (const { text, skip } of scanLines(core?.content ?? '')) {
    const h = !skip ? H3.exec(text) : null;
    if (h) {
      flush();
      current = { name: h[1], lines: [text] };
    } else if (current) current.lines.push(text);
  }
  flush();
  return { title, version, principles, sections: doc.sections, content };
}
