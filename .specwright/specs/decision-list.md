---
id: decision-list
title: List decisions (list_decisions)
status: done
---

## Context
Phase 2 of the [Roadmap](../../docs/03-roadmap.md). It gives an agent the decisions recorded for a spec or a period, without reading every file. Requirement covered: FR-10 (PRD-001). It lives in the `decisions` module, which owns the entity (decision 0003).

## Requirements
- `src/decisions/tools/list-decisions.ts`: `list_decisions({ spec_id?, from?, to? })` → `{ decisions: [{ id, spec_id, title, date, status, path }] }`.
  - The list is sorted by id and never includes the body.
  - `from` and `to` are inclusive `YYYY-MM-DD` dates, and `from > to` gives `INVALID_INPUT`.
  - Files without a valid frontmatter are skipped.
  - When `decisions/` is missing, the list is empty.

## Acceptance criteria
- [x] AC-1: Lists every decision sorted by id with `id, spec_id, title, date, status, path` and no body
- [x] AC-2: `spec_id` keeps only that spec's decisions
- [x] AC-3: `from` and `to` are inclusive
- [x] AC-4: A date not in `YYYY-MM-DD` form is rejected, and `from` later than `to` gives `INVALID_INPUT`
- [x] AC-5: A malformed decision file is skipped and the others are still listed
- [x] AC-6: Returns `{ decisions: [] }` when `decisions/` does not exist

## Out of scope
- Full-text search (that is `search_memory`)
- Superseding decisions
