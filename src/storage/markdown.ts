import { parse } from 'yaml';

export interface Section {
  /** Normalized heading text, e.g. "acceptance-criteria". */
  key: string;
  /** Heading text as written. */
  heading: string;
  /** The section including its `##` heading line, with LF line endings. */
  content: string;
}

export interface ParsedDocument {
  /** Parsed YAML, or undefined when there is no frontmatter block (or it is invalid). */
  frontmatter: unknown;
  frontmatterError?: string;
  /** Everything after the frontmatter, with LF line endings. */
  body: string;
  sections: Section[];
}

const FENCE = /^\s{0,3}(```|~~~)/;
const H2 = /^##\s+(.+?)\s*#*\s*$/;

export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Removes HTML comments (Spec Kit templates are full of `<!-- ACTION REQUIRED -->` blocks). */
export function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

export interface ScannedLine {
  /** Line text without its line terminator. */
  text: string;
  /** True for fence markers, lines inside a code fence and lines inside an HTML comment. */
  skip: boolean;
}

/** Splits raw text into lines and marks the ones that are code or comments, never content. */
export function scanLines(raw: string): ScannedLine[] {
  let inFence = false;
  let inComment = false;
  return raw.split('\n').map((rawLine) => {
    const text = rawLine.replace(/\r$/, '');
    if (inComment) {
      if (text.includes('-->')) inComment = false;
      return { text, skip: true };
    }
    if (FENCE.test(text)) {
      inFence = !inFence;
      return { text, skip: true };
    }
    if (inFence) return { text, skip: true };
    if (text.trimStart().startsWith('<!--')) {
      if (!text.includes('-->')) inComment = true;
      return { text, skip: true };
    }
    return { text, skip: false };
  });
}

export function parseDocument(raw: string): ParsedDocument {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let frontmatter: unknown;
  let frontmatterError: string | undefined;
  let body = text;
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text) ?? /^---\n---[ \t]*(?:\n|$)/.exec(text);
  if (match) {
    body = text.slice(match[0].length);
    try {
      frontmatter = parse(match[1] ?? '') ?? {};
    } catch (error) {
      frontmatterError = (error as Error).message.split('\n')[0];
    }
  }
  return { frontmatter, frontmatterError, body, sections: splitSections(body) };
}

function splitSections(body: string): Section[] {
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | undefined;
  let inFence = false;
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const h = !inFence && !line.startsWith('###') ? H2.exec(line) : null;
    if (h) {
      if (current) sections.push(finish(current));
      current = { heading: h[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(finish(current));
  return sections;
}

function finish({ heading, lines }: { heading: string; lines: string[] }): Section {
  return { key: normalizeKey(heading), heading, content: lines.join('\n').replace(/\n+$/, '') };
}

/** List items (`-` or `*`, any indentation) of a block of Markdown. */
export function listItems(content: string): string[] {
  return content
    .split('\n')
    .map((line) => /^\s*[-*]\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((item): item is string => item !== undefined);
}
