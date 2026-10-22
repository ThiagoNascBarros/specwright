import type { Section } from '../storage/markdown.js';

/** `NNN-short-name` or `YYYYMMDD-HHMMSS-short-name`, as written by Spec Kit's create-new-feature script. */
export const FEATURE_ID_PATTERN = /^(\d{3,}|\d{8}-\d{6})-[a-z0-9][a-z0-9-]*$/;
export const TASK_ID_PATTERN = /^T\d{3,}$/;
export const STORY_PATTERN = /^US\d+$/;

/** Artifacts that a feature folder may contain, in Spec Kit's order. */
export const ARTIFACT_NAMES = ['spec', 'plan', 'tasks', 'research', 'data-model', 'quickstart', 'contracts', 'checklists'] as const;
export type ArtifactName = (typeof ARTIFACT_NAMES)[number];

/** What `get_artifact` can return: a single-file artifact, a named checklist or contract, or the constitution. */
export const READABLE_ARTIFACTS = ['spec', 'plan', 'tasks', 'research', 'data-model', 'quickstart', 'checklist', 'contract', 'constitution'] as const;
export type ReadableArtifact = (typeof READABLE_ARTIFACTS)[number];

export interface Item {
  /** `FR-001`, `SC-002`… */
  id: string;
  text: string;
}

export interface UserStory {
  number: number;
  title: string;
  /** `P1`, `P2`… */
  priority: string;
  /** Acceptance scenarios as plain text: "Given …, When …, Then …". */
  scenarios: string[];
}

/** A parsed `spec.md`. */
export interface Specification {
  title: string;
  branch: string;
  created: string;
  status: string;
  input: string;
  sections: Section[];
  userStories: UserStory[];
  requirements: Item[];
  successCriteria: Item[];
  edgeCases: string[];
  assumptions: string[];
  /** Text of each unresolved `[NEEDS CLARIFICATION: …]` marker. */
  clarifications: string[];
}

/** One `- [ ] T### [P] [USn] description` line of `tasks.md`. */
export interface Task {
  id: string;
  done: boolean;
  parallel: boolean;
  story: string | undefined;
  /** Text after `## Phase N:` of the nearest phase heading; "" when none. */
  phase: string;
  text: string;
}

export interface Feature {
  /** The folder name under specs/. */
  id: string;
  title: string;
  status: string;
  artifacts: ArtifactName[];
  /** False when any blocking issue exists (FR-015). */
  valid: boolean;
  /** Blocking issues first, then warnings. */
  issues: string[];
  spec: Specification | undefined;
  tasks: Task[];
}

/** One-line summary returned by `list_features`. */
export interface FeatureSummary {
  id: string;
  title: string;
  status: string;
  valid: boolean;
  issues?: string[];
  artifacts: ArtifactName[];
  tasks: { done: number; total: number };
  open_clarifications: number;
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
