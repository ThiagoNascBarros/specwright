export type ContextItemKind = 'spec-section' | 'memory' | 'decision';

/** One unit of context the packer can choose: a spec section, a memory or a decision. */
export interface ContextItem {
  kind: ContextItemKind;
  /** `<spec_id>#<section>` for sections; the memory or decision id otherwise. */
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
