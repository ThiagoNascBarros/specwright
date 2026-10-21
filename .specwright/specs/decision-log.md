---
id: decision-log
title: Record decisions (log_decision)
status: done
---

## Context
Spec 4 of the [Roadmap](../../docs/03-roadmap.md). It lets an agent record a decision made during implementation, linked to a spec, as a Markdown file that humans review in Git. Requirement covered: FR-7 (PRD-001). Format from TRD §6.2.

## Requirements
- A `src/decisions/` module owns the decision entity. Decisions are read by `log_decision` here, and later by `list_decisions` and `search_memory`, so they get their own module:
  - `types.ts`, the entity;
  - `repository.ts`, which creates and reads decisions;
  - `tools/log-decision.ts`, the tool.
- `src/storage/slug.ts`: `slugify(text, max = 50)`. It removes accents, lowercases, maps any other character to `-` and cuts to `max`. An empty result falls back to the caller's default.
- `src/storage/files.ts` gains `createExclusive(path, text)`, which creates the file with the `wx` flag and fails with `EEXIST` when the file already exists.
- `log_decision({ spec_id, title, decision, context?, consequences? })` → `{ id, path }`:
  - `path` is relative to the root, for example `decisions/0003-lock-by-account.md`;
  - the frontmatter comes from `yaml.stringify`: `id` (4-digit string), `spec_id`, `title`, `date` (local `YYYY-MM-DD`) and `status: accepted`;
  - the body has `## Context`, `## Decision` and `## Consequences`, and an empty section is omitted.
- Numbering is the highest existing `NNNN-*.md` + 1. Calls in the same process are serialized. Another process creating the same number is handled by retrying with the next number, up to 5 times.

## Acceptance criteria
- [x] AC-1: The first call creates `decisions/0001-<slug>.md` with the frontmatter fields and the three sections, and `decisions/` is created on demand
- [x] AC-2: The number is the highest existing one + 1 (gaps are allowed), and files that do not match `NNNN-*.md` are ignored
- [x] AC-3: An unknown `spec_id` gives `SPEC_NOT_FOUND` and nothing is written
- [x] AC-4: The slug has no accents, only `[a-z0-9-]` and at most 50 characters, and falls back to `decision` when empty
- [x] AC-5: When `context` or `consequences` is missing, that section is omitted
- [x] AC-6: A title with YAML-sensitive characters (`: # " '`) reads back exactly through the frontmatter
- [x] AC-7: 10 parallel calls create 10 files numbered 0001 to 0010, and no file is overwritten
- [x] AC-8: The returned `path` is relative to the root and never absolute
- [x] AC-9: `id` is written as a quoted string (`"0007"`), so YAML does not read it as a number

## Out of scope
- Listing or searching decisions (Phase 2: `list_decisions`, `search_memory`)
- Superseding decisions (humans edit `status`)
