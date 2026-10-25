import { parseLedger } from './ledger.js';
import { constitutionFacts, decisionFacts, docFacts, noteFacts } from './facts-memory.js';
import { featureFacts } from './facts-feature.js';
import type { FileFacts, SourceFile } from './types.js';

/** Per-file facts, dispatched on the source kind. */
export function factsOf(source: SourceFile, raw: string): FileFacts {
  const { path, kind } = source;
  switch (kind) {
    case 'constitution': return constitutionFacts(path, raw);
    case 'decision': return decisionFacts(path, raw);
    case 'note': return noteFacts(path, raw);
    case 'doc': return docFacts(path, raw);
    case 'ledger': {
      const ledger = parseLedger(path, raw);
      const nodes = ledger.concepts.map((c) => ({ id: c.id, kind: 'concept' as const, label: c.label, path, line: c.line, text: `${c.label} ${c.summary}`.trim() }));
      return { path, kind, nodes, edges: [], links: [], mentions: [], paths: [], units: [], ledger, issues: [] };
    }
    default: return featureFacts({ path, kind, feature: source.feature ?? '', raw });
  }
}
