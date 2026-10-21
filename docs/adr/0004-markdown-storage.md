# ADR-0004 — Markdown storage, no database

- **Status:** accepted
- **Date:** 2026-10-21

## Context
Specs, decisions and memories must be read by humans and agents, versioned, and reviewed alongside the code.

## Decision
All state is **Markdown with YAML frontmatter** in `.specwright/` inside the repository, with no database. Reading by section (headings) and simple text search. **No index and no cache:** files are re-read on every call, so edits made by the agent, the user or the server itself show up immediately. Since `id` = file name, reading a spec does not require scanning the folder.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| **Markdown in the repo** | Readable, reviewable via PR, history in Git, no infrastructure | Limited search; writes require care not to reformat |
| SQLite | Fast queries and FTS | Opaque binary in Git; not reviewable; migrations |
| Vector index | Semantic search | Embeddings require a model (conflicts with ADR-0003) and infrastructure |

## Consequences
Writes must be minimal and atomic (TRD §5.1). No lock between processes: one server per project. Listings read all frontmatters on every call (NFR-7 target); a cache or index is only introduced if that target fails in practice.

**Revision 2026-10-21:** the previous version planned an in-memory index rebuilt at startup. It was removed because it would become stale as soon as a file changed during the session.
