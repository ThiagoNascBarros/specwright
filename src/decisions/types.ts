export interface NewDecision {
  feature: string;
  title: string;
  decision: string;
  rationale?: string;
  alternatives?: string;
}

export interface Decision {
  /** 4-digit number as a string, e.g. "0007". */
  id: string;
  /** The Spec Kit feature id the decision belongs to. */
  feature: string;
  title: string;
  /** Local creation date, YYYY-MM-DD. */
  date: string;
  status: string;
  /** Path relative to the project root, e.g. ".specify/memory/decisions/0007-store-metadata.md". */
  path: string;
  /** Markdown body after the frontmatter. */
  body: string;
}
