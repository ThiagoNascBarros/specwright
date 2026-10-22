# Feature Specification: Check work against a spec (check_task_against_spec)

**Feature Branch**: `feature/SW-2-spec-core`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `check-task`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check work against a spec (check_task_against_spec) (Priority: P1)

Spec 5 of the [Roadmap](../../docs/03-roadmap.md) and the last one of Phase 1. Before saying "done", the agent sends its diff together with the spec id. It gets back the criteria, the excluded scope and a compact summary of the diff, and it does the comparison itself (ADR-0003: no LLM in the server). Requirement covered: FR-5 (PRD-001). It also decides TRD Q1.

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-009 (AC-1 to AC-9 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A modified file reports `added`, `removed` and `hunks` counts that match the diff, and `totals` sums all files (was AC-1)
- **FR-002**: New (`/dev/null` old side) and deleted (`/dev/null` new side) files get the `added` and `deleted` statuses, and a deleted file uses its old path (was AC-2)
- **FR-003**: A rename reports `status: renamed` with `old_path` and the new `path` (was AC-3)
- **FR-004**: A binary file is reported with `binary: true` and zero line counts (was AC-4)
- **FR-005**: A removed line `--- not a header` and an added line `+++ not a header` inside a hunk are counted as content, not as file headers (was AC-5)
- **FR-006**: Plain `diff -u` output with timestamps and no `diff --git` line is parsed (was AC-6)
- **FR-007**: The tool returns open and met criteria, the out-of-scope items and the diff summary, and never includes diff line content (was AC-7)
- **FR-008**: An empty diff or text without file headers gives `INVALID_DIFF`; an unknown spec gives `SPEC_NOT_FOUND`; an invalid spec gives `INVALID_SPEC` (was AC-8)
- **FR-009**: A 50,000-line diff is summarized in under 500 ms, and the response stays under 2,000 characters for a single file (was AC-9)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 9 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Reading the diff from Git (`base_ref`) — revisit only if dogfooding shows the token cost matters
- Out of scope: Any judgment of whether the diff satisfies a criterion
