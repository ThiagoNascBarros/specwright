# Implementation Plan: List decisions (list_decisions)

**Branch**: `feature/SW-3-project-memory` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `decision-list`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

- `src/decisions/tools/list-decisions.ts`: `list_decisions({ spec_id?, from?, to? })` → `{ decisions: [{ id, spec_id, title, date, status, path }] }`.
  - The list is sorted by id and never includes the body.
  - `from` and `to` are inclusive `YYYY-MM-DD` dates, and `from > to` gives `INVALID_INPUT`.
  - Files without a valid frontmatter are skipped.
  - When `decisions/` is missing, the list is empty.
