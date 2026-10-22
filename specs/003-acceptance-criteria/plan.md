# Implementation Plan: Track acceptance criteria (list_open_requirements, set_criterion_status)

**Branch**: `feature/SW-2-spec-core` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `acceptance-criteria`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

- `src/storage/files.ts` gains `writeAtomic(path, text)`. It writes `.<name>.<pid>.<random>.tmp` in the same folder, then renames it over the target, and removes the temporary file when the write fails (TRD §5.1).
- `src/specs/editor.ts`: `setCheckbox(raw, acId, done)` returns the new text, or the same text when nothing changes. Only the checkbox character of the matching line changes. Every other byte stays the same, including CRLF and BOM.
  - The match is exact: `AC-1` never matches `AC-10`.
  - Lines inside fenced code blocks or outside the criteria section are never touched.
- `list_open_requirements({ spec_id? })` → `{ open: [{ spec_id, ac_id, text }] }`.
  - Without `spec_id`, it covers all valid specs, sorted by spec id and then by file order. Invalid specs are left out.
  - With `spec_id`, an invalid spec gives `INVALID_SPEC`, with its issues in the hint.
- `set_criterion_status({ spec_id, ac_id, done })` → `{ spec_id, ac_id, done, changed, criteria: {done, total} }`. It is idempotent, refuses invalid specs with `INVALID_SPEC`, and reports an unknown `ac_id` as `CRITERION_NOT_FOUND`.
