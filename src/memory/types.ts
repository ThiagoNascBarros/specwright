export const MEMORY_TYPES = ['convention', 'learning', 'pitfall'] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface NewMemory {
  type: MemoryType;
  title: string;
  body: string;
  tags?: string[];
}

export interface Memory {
  /** The slug, which is also the file name without `.md`. */
  id: string;
  type: string;
  title: string;
  tags: string[];
  /** Local creation date, YYYY-MM-DD. */
  date: string;
  /** Path relative to the root, e.g. "memory/use-kebab-case-ids.md". */
  path: string;
  body: string;
}

/** One ranked hit of `search_memory`: a memory or a decision. */
export interface SearchResult {
  kind: 'memory' | 'decision';
  id: string;
  title: string;
  type?: string;
  spec_id?: string;
  tags?: string[];
  date: string;
  path: string;
  score: number;
  snippet: string;
}
