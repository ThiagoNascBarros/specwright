---
id: check-task
title: Check work against a spec (check_task_against_spec)
status: done
---

## Context
Spec 5 of the [Roadmap](../../docs/03-roadmap.md) and the last one of Phase 1. Before saying "done", the agent sends its diff together with the spec id. It gets back the criteria, the excluded scope and a compact summary of the diff, and it does the comparison itself (ADR-0003: no LLM in the server). Requirement covered: FR-5 (PRD-001). It also decides TRD Q1.

## Requirements
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

## Acceptance criteria
- [x] AC-1: A modified file reports `added`, `removed` and `hunks` counts that match the diff, and `totals` sums all files
- [x] AC-2: New (`/dev/null` old side) and deleted (`/dev/null` new side) files get the `added` and `deleted` statuses, and a deleted file uses its old path
- [x] AC-3: A rename reports `status: renamed` with `old_path` and the new `path`
- [x] AC-4: A binary file is reported with `binary: true` and zero line counts
- [x] AC-5: A removed line `--- not a header` and an added line `+++ not a header` inside a hunk are counted as content, not as file headers
- [x] AC-6: Plain `diff -u` output with timestamps and no `diff --git` line is parsed
- [x] AC-7: The tool returns open and met criteria, the out-of-scope items and the diff summary, and never includes diff line content
- [x] AC-8: An empty diff or text without file headers gives `INVALID_DIFF`; an unknown spec gives `SPEC_NOT_FOUND`; an invalid spec gives `INVALID_SPEC`
- [x] AC-9: A 50,000-line diff is summarized in under 500 ms, and the response stays under 2,000 characters for a single file

## Out of scope
- Reading the diff from Git (`base_ref`) — revisit only if dogfooding shows the token cost matters
- Any judgment of whether the diff satisfies a criterion
