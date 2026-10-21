export interface NewDecision {
  spec_id: string;
  title: string;
  decision: string;
  context?: string;
  consequences?: string;
}

export interface Decision {
  /** 4-digit number as a string, e.g. "0007". */
  id: string;
  spec_id: string;
  title: string;
  /** Local creation date, YYYY-MM-DD. */
  date: string;
  status: string;
  /** Path relative to the root, e.g. "decisions/0007-lock-by-account.md". */
  path: string;
  /** Markdown body after the frontmatter. */
  body: string;
}
