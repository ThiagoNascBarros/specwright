# Feature Specification: Track acceptance criteria (list_open_requirements, set_criterion_status)

**Feature Branch**: `feature/SW-2-spec-core`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `acceptance-criteria`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track acceptance criteria (list_open_requirements, set_criterion_status) (Priority: P1)

Spec 3 of the [Roadmap](../../docs/03-roadmap.md). With it, an agent can see what is still missing and record progress in the spec itself, which closes the loop "spec → code → validation → spec updated". Requirements covered: FR-4, FR-6, NFR-5 (PRD-001); decision in ADR-0005.

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-010 (AC-1 to AC-10 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `list_open_requirements` without `spec_id` returns the open criteria of every valid spec, sorted, and leaves out invalid specs (was AC-1)
- **FR-002**: `list_open_requirements` with `spec_id` returns only that spec's open criteria; an unknown id gives `SPEC_NOT_FOUND` and an invalid spec gives `INVALID_SPEC` (was AC-2)
- **FR-003**: `set_criterion_status` with `done: true` turns `[ ]` into `[x]` on that line only, and the file differs from the original in exactly one byte (was AC-3)
- **FR-004**: `set_criterion_status` with `done: false` turns `[x]` or `[X]` into `[ ]` (was AC-4)
- **FR-005**: Calling it with the current state returns `changed: false` and does not rewrite the file (mtime unchanged) (was AC-5)
- **FR-006**: CRLF line endings and a UTF-8 BOM are preserved byte for byte (was AC-6)
- **FR-007**: `AC-1` does not match `AC-10`, and a matching line inside a code fence or outside the criteria section is not touched (was AC-7)
- **FR-008**: An unknown `ac_id` gives `CRITERION_NOT_FOUND` and an invalid spec gives `INVALID_SPEC`, and the file is not changed in either case (was AC-8)
- **FR-009**: `writeAtomic` leaves no temporary file behind, after success and after a failed rename (was AC-9)
- **FR-010**: The returned `criteria` count reflects the written file (was AC-10)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 10 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Editing criterion text, adding criteria or renumbering
- Out of scope: Changing the spec `status` field
- Out of scope: Locking between processes (TRD §5.1)
