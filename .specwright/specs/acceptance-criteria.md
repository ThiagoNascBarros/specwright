---
id: acceptance-criteria
title: Track acceptance criteria (list_open_requirements, set_criterion_status)
status: done
---

## Context
Spec 3 of the [Roadmap](../../docs/03-roadmap.md). With it, an agent can see what is still missing and record progress in the spec itself, which closes the loop "spec → code → validation → spec updated". Requirements covered: FR-4, FR-6, NFR-5 (PRD-001); decision in ADR-0005.

## Requirements
- `src/storage/files.ts` gains `writeAtomic(path, text)`. It writes `.<name>.<pid>.<random>.tmp` in the same folder, then renames it over the target, and removes the temporary file when the write fails (TRD §5.1).
- `src/specs/editor.ts`: `setCheckbox(raw, acId, done)` returns the new text, or the same text when nothing changes. Only the checkbox character of the matching line changes. Every other byte stays the same, including CRLF and BOM.
  - The match is exact: `AC-1` never matches `AC-10`.
  - Lines inside fenced code blocks or outside the criteria section are never touched.
- `list_open_requirements({ spec_id? })` → `{ open: [{ spec_id, ac_id, text }] }`.
  - Without `spec_id`, it covers all valid specs, sorted by spec id and then by file order. Invalid specs are left out.
  - With `spec_id`, an invalid spec gives `INVALID_SPEC`, with its issues in the hint.
- `set_criterion_status({ spec_id, ac_id, done })` → `{ spec_id, ac_id, done, changed, criteria: {done, total} }`. It is idempotent, refuses invalid specs with `INVALID_SPEC`, and reports an unknown `ac_id` as `CRITERION_NOT_FOUND`.

## Acceptance criteria
- [x] AC-1: `list_open_requirements` without `spec_id` returns the open criteria of every valid spec, sorted, and leaves out invalid specs
- [x] AC-2: `list_open_requirements` with `spec_id` returns only that spec's open criteria; an unknown id gives `SPEC_NOT_FOUND` and an invalid spec gives `INVALID_SPEC`
- [x] AC-3: `set_criterion_status` with `done: true` turns `[ ]` into `[x]` on that line only, and the file differs from the original in exactly one byte
- [x] AC-4: `set_criterion_status` with `done: false` turns `[x]` or `[X]` into `[ ]`
- [x] AC-5: Calling it with the current state returns `changed: false` and does not rewrite the file (mtime unchanged)
- [x] AC-6: CRLF line endings and a UTF-8 BOM are preserved byte for byte
- [x] AC-7: `AC-1` does not match `AC-10`, and a matching line inside a code fence or outside the criteria section is not touched
- [x] AC-8: An unknown `ac_id` gives `CRITERION_NOT_FOUND` and an invalid spec gives `INVALID_SPEC`, and the file is not changed in either case
- [x] AC-9: `writeAtomic` leaves no temporary file behind, after success and after a failed rename
- [x] AC-10: The returned `criteria` count reflects the written file

## Out of scope
- Editing criterion text, adding criteria or renumbering
- Changing the spec `status` field
- Locking between processes (TRD §5.1)
