import type { ContextItem, PackResult } from './types.js';

/** Greedy fill in the given order: skips items that do not fit and keeps trying smaller ones. */
export function pack(items: ContextItem[], budget: number): PackResult {
  const chosen: ContextItem[] = [];
  let used = 0;
  let skipped = 0;
  for (const item of items) {
    if (used + item.tokens <= budget) {
      chosen.push(item);
      used += item.tokens;
    } else {
      skipped++;
    }
  }
  return { items: chosen, used, skipped };
}
