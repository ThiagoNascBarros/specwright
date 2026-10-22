export type ContextItemKind = 'spec-section' | 'plan-section' | 'task' | 'constitution' | 'decision' | 'memory';

/** One unit of context the packer can choose: a spec section, a memory or a decision. */
export interface ContextItem {
  kind: ContextItemKind;
  /** `<feature>/spec.md#<key>`, `<feature>/plan.md#<key>`, `<feature>/tasks.md#T012`, `constitution#<key>`, or a decision/note id. */
  ref: string;
  title: string;
  score: number;
  /** Estimated tokens of `content` (see estimate.ts). */
  tokens: number;
  content: string;
}

export interface PackResult {
  items: ContextItem[];
  used: number;
  skipped: number;
}
