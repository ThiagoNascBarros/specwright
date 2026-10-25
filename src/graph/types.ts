export const NODE_KINDS = ['feature', 'artifact', 'requirement', 'criterion', 'story', 'task', 'principle', 'decision', 'note', 'doc', 'file', 'concept'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const DERIVED_RELATIONS = ['contains', 'implements', 'references', 'touches', 'links_to', 'belongs_to'] as const;
export const SEMANTIC_RELATIONS = ['depends_on', 'implements', 'rationale_for', 'supersedes', 'contradicts', 'refines', 'part_of', 'tests', 'uses', 'example_of', 'similar_to', 'related_to'] as const;
export type Relation = (typeof DERIVED_RELATIONS)[number] | (typeof SEMANTIC_RELATIONS)[number];

export const CONFIDENCES = ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export type LedgerConfidence = 'INFERRED' | 'AMBIGUOUS' | 'REJECTED';

export const EXTRACTOR_VERSION = 1;  // bump when EXTRACTION_INSTRUCTIONS change meaning
export const SNAPSHOT_SCHEMA = 1;    // bump when FileFacts change shape
export const GRAPH_DIR = '.specify/graph';
export const RELATIONS_DIR = '.specify/memory/relations';

export interface GraphNode {
  id: string; kind: NodeKind; label: string;
  feature?: string;          // feature-scoped kinds and decisions with a feature
  path?: string; line?: number;
  section?: string;          // normalizeKey of the enclosing `##` heading
  heading?: string;          // that heading's text (for get_artifact's `section`)
  tags?: string[]; type?: string; done?: boolean;
  text: string;              // ≤ 2,000 chars used for scoring and excerpts
}

export interface GraphEdge {
  source: string; target: string; relation: Relation;
  confidence: Confidence; score: number;
  origin: 'derived' | 'relation-line' | 'ledger';
  path: string; line?: number; evidence?: string;
}

export type SourceKind = 'spec' | 'plan' | 'tasks' | 'research' | 'data-model' | 'quickstart' | 'contract' | 'constitution' | 'decision' | 'note' | 'doc' | 'ledger';
export interface SourceFile { path: string; kind: SourceKind; feature?: string; size: number; mtimeMs: number }

export interface Unit { id: string; node: string; path: string; section?: string; title: string; hash: string; tokens: number; scope: string }

export interface RawLink { from: string; line: number; form: 'wiki' | 'markdown'; target: string; relation?: Relation }
export type RawMention =
  | { from: string; line: number; type: 'item' | 'story' | 'task'; id: string; feature?: string }  // feature = qualifier or file scope
  | { from: string; line: number; type: 'feature'; id: string }
  | { from: string; line: number; type: 'decision'; id: string };   // 4 digits
export interface RawPath { from: string; line: number; path: string }

export interface ConceptRow { id: string; label: string; summary: string; line: number }
export interface RelationRow { source: string; relation: string; target: string; confidence: string; score: number; evidence: string; date: string; line: number }
export interface CoverageRow { unit: string; hash: string; version: number; date: string; line: number }
export interface LedgerFacts { scope: string; concepts: ConceptRow[]; relations: RelationRow[]; coverage: CoverageRow[]; invalid: Array<{ line: number; reason: string }> }

export interface FileFacts {
  path: string; kind: SourceKind; feature?: string;
  nodes: GraphNode[]; edges: GraphEdge[];          // edges fully resolved inside the file
  links: RawLink[]; mentions: RawMention[]; paths: RawPath[];
  units: Unit[]; ledger?: LedgerFacts;
  issues: Array<{ line?: number; message: string }>;
}

export type LintKind = 'broken_link' | 'dangling_relation' | 'invalid_row' | 'ambiguous_link' | 'unknown_mention' | 'duplicate_label' | 'contradiction' | 'ambiguous_relation' | 'orphan' | 'stale_coverage';
export interface Diagnostic { kind: LintKind; path: string; line?: number; node?: string; message: string; fix: string }

export interface Graph {
  version: number;                         // increments on every rebuild in this process
  nodes: Map<string, GraphNode>;           // insertion order = sorted by id
  edges: GraphEdge[];                      // sorted by source, relation, target
  out: Map<string, number[]>; in: Map<string, number[]>;  // edge indexes, sorted by (other id, relation)
  units: Map<string, Unit>;                // extraction units by id
  coverage: Map<string, CoverageRow>;      // by unit id (from ledgers)
  rejected: Set<string>;                   // "source|relation|target" keys of REJECTED rows
  diagnostics: Diagnostic[];
}
