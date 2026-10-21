import type { Section } from '../storage/markdown.js';

export const SPEC_STATUSES = ['draft', 'in-progress', 'done', 'deprecated'] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

/** `^[a-z0-9][a-z0-9-]*$`: the spec id, which is also its file name. */
export const SPEC_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface Criterion {
  /** Stable id, e.g. "AC-3". */
  id: string;
  text: string;
  done: boolean;
}

export interface CriteriaCount {
  done: number;
  total: number;
}

export interface Spec {
  /** Id taken from the file name (the source of truth for lookups). */
  id: string;
  title: string;
  status: string;
  /** False when any blocking problem was found (TRD §6.1). */
  valid: boolean;
  /** Blocking problems first, then warnings. */
  issues: string[];
  body: string;
  sections: Section[];
  criteria: Criterion[];
  outOfScope: string[];
}

export type FileChangeStatus = 'added' | 'deleted' | 'modified' | 'renamed';

/** Per-file summary of a unified diff; never carries line content. */
export interface FileChange {
  path: string;
  old_path?: string;
  status: FileChangeStatus;
  added: number;
  removed: number;
  hunks: number;
  binary?: true;
}

export interface DiffSummary {
  files: FileChange[];
  totals: { files: number; added: number; removed: number };
}

/** One-line summary returned by listings (never includes the body). */
export interface SpecSummary {
  id: string;
  title: string;
  status: string;
  valid: boolean;
  issues?: string[];
  criteria: CriteriaCount;
}
