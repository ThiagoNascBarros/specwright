# Feature Specification: Pack the minimal context for a task (pack_context)

**Feature Branch**: `feature/SW-4-context-packer`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `context-pack`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pack the minimal context for a task (pack_context) (Priority: P1)

Phase 3 of the [Roadmap](../../docs/03-roadmap.md). Given a task description, the server returns the spec sections, memories and decisions that matter most, plus the file paths they mention, all within a token budget. The agent then starts work without broad reads. Requirement covered: FR-11 (PRD-001). It decides PRD Q1.

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-011 (AC-1 to AC-11 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Returns the relevant items ranked by score, each with `kind`, `ref`, `title`, `score`, `tokens` and `content` (was AC-1)
- **FR-002**: Every item's `tokens` is `ceil(content.length / 4)`, and `used_tokens` is their sum (was AC-2)
- **FR-003**: `used_tokens` never exceeds the budget. An item larger than the remaining budget is skipped and counted, and smaller lower-ranked items are still added. (was AC-3)
- **FR-004**: With `spec_id`, only that spec's sections are used, and its acceptance-criteria section comes first (was AC-4)
- **FR-005**: Relevant memories and decisions are included next to spec sections (was AC-5)
- **FR-006**: `files` lists the unique backticked paths cited by the selected items, at most 20, without reading any file outside the root (was AC-6)
- **FR-007**: Invalid specs never contribute items (was AC-7)
- **FR-008**: A task with no searchable terms gives `INVALID_INPUT`, a budget outside 200–100,000 is rejected, and an unknown `spec_id` gives `SPEC_NOT_FOUND` (was AC-8)
- **FR-009**: The effective budget is capped by `maxResponseChars`, and the response is never truncated (was AC-9)
- **FR-010**: With 500 specs and 1,000 memories, `pack_context` answers in under 1 second (was AC-10)
- **FR-011**: The finished server exposes exactly the 10 tools of PRD NFR-2, and `tools/list` stays within 12,000 characters (was AC-11)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 11 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Reading source files or their content
- Out of scope: A real tokenizer (revisit if estimates prove too far off)
