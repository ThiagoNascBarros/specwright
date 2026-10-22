/**
 * Approximate token count: ceil(chars / 4) (PRD Q1, decision recorded in context-pack).
 * shortcut: no real tokenizer; upgrade only if estimates prove too far off in practice.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
