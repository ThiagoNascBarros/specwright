# Implementation Plan: Record decisions (log_decision)

**Branch**: `feature/SW-2-spec-core` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `decision-log`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

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
