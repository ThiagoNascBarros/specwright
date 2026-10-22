# Feature Specification: List decisions (list_decisions)

**Feature Branch**: `feature/SW-3-project-memory`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `decision-list`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List decisions (list_decisions) (Priority: P1)

Phase 2 of the [Roadmap](../../docs/03-roadmap.md). It gives an agent the decisions recorded for a spec or a period, without reading every file. Requirement covered: FR-10 (PRD-001). It lives in the `decisions` module, which owns the entity (decision 0003).

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-006 (AC-1 to AC-6 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Lists every decision sorted by id with `id, spec_id, title, date, status, path` and no body (was AC-1)
- **FR-002**: `spec_id` keeps only that spec's decisions (was AC-2)
- **FR-003**: `from` and `to` are inclusive (was AC-3)
- **FR-004**: A date not in `YYYY-MM-DD` form is rejected, and `from` later than `to` gives `INVALID_INPUT` (was AC-4)
- **FR-005**: A malformed decision file is skipped and the others are still listed (was AC-5)
- **FR-006**: Returns `{ decisions: [] }` when `decisions/` does not exist (was AC-6)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 6 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Full-text search (that is `search_memory`)
- Out of scope: Superseding decisions
