# Feature Specification: Project memory (save_memory, search_memory)

**Feature Branch**: `feature/SW-3-project-memory`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `memory`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Project memory (save_memory, search_memory) (Priority: P1)

Phase 2 of the [Roadmap](../../docs/03-roadmap.md). Conventions, learnings and pitfalls that an agent discovers are saved as Markdown and found again in later sessions, together with recorded decisions, without rereading files. Requirements covered: FR-8, FR-9 (PRD-001).

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-011 (AC-1 to AC-11 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `save_memory` creates `memory/<slug>.md` with the frontmatter fields and the body, and returns a relative `path` (was AC-1)
- **FR-002**: Saving the same title twice creates `<slug>-2.md`, and the first file is unchanged (was AC-2)
- **FR-003**: An unknown `type`, an empty title or an empty body is rejected, and nothing is written (was AC-3)
- **FR-004**: `memory/` is created on demand, and a missing root gives `NOT_INITIALIZED` (was AC-4)
- **FR-005**: The ranking puts a title match above a tag match above a body match (was AC-5)
- **FR-006**: Decisions are searched too (`kind: decision`), and `type` filters by memory type or `decision` (was AC-6)
- **FR-007**: The search ignores case and accents: `convenção` finds `convencao` and the reverse (was AC-7)
- **FR-008**: `limit` defaults to 10 and is capped at 50, and every snippet is at most 200 characters and contains a matched term when the body matches (was AC-8)
- **FR-009**: A query with only stopwords or punctuation gives `INVALID_INPUT` (was AC-9)
- **FR-010**: A memory saved by one server instance is found by a new instance on the same root (persists across sessions) (was AC-10)
- **FR-011**: Searching 1,000 memories and 200 decisions takes under 300 ms (was AC-11)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 11 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Editing or deleting memories (humans edit the files)
- Out of scope: Embeddings or any external index (ADR-0004)
