# Implementation Plan: Check work against a spec (check_task_against_spec)

**Branch**: `feature/SW-2-spec-core` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `check-task`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

- **TRD Q1 decision.** The diff arrives as a tool argument. The server never runs `git` (TRD §2 forbids `child_process`). An agent that only needs the criteria can call `get_spec` instead.
- `src/specs/diff.ts`: `parseUnifiedDiff(text)` → `{ files: [{ path, status, old_path?, added, removed, hunks, binary? }], totals: { files, added, removed } }`.
  - `status` ∈ `added | deleted | modified | renamed`.
  - Supports `git diff` output (`diff --git`, `rename from/to`, `new file mode`, `deleted file mode`, `Binary files … differ`, `GIT binary patch`) and plain `diff -u` output (`---`/`+++` only).
  - Hunk bodies are consumed using the line counts from the `@@ -a,b +c,d @@` header. A removed line whose text starts with `--` is therefore never taken as a file header.
  - The `a/` and `b/` prefixes and the timestamps after a tab are stripped. For a deleted file, `path` is the old path.
- `check_task_against_spec({ spec_id, diff })` → `{ spec_id, title, open_criteria, met_criteria, out_of_scope, diff_summary }`.
  - Criteria are `{ ac_id, text }`.
  - The diff is limited to 5,000,000 characters by the schema.
  - An invalid spec gives `INVALID_SPEC`.
  - An empty diff, or one without any file header, gives `INVALID_DIFF`.
