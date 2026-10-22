import type { Section } from '../storage/markdown.js';

export interface Principle {
  /** Normalized principle name, e.g. "ii-test-first-non-negotiable". */
  key: string;
  /** Heading text, e.g. "II. Test-First (NON-NEGOTIABLE)". */
  name: string;
  /** The principle block including its `###` heading. */
  content: string;
}

/** `.specify/memory/constitution.md`, written by `/speckit-constitution`; read-only for Specwright. */
export interface Constitution {
  title: string;
  version: string;
  principles: Principle[];
  sections: Section[];
  /** Text without HTML comments. */
  content: string;
}
