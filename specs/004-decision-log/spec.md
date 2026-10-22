# Feature Specification: Record decisions (log_decision)

**Feature Branch**: `feature/SW-2-spec-core`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `decision-log`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record decisions (log_decision) (Priority: P1)

Spec 4 of the [Roadmap](../../docs/03-roadmap.md). It lets an agent record a decision made during implementation, linked to a spec, as a Markdown file that humans review in Git. Requirement covered: FR-7 (PRD-001). Format from TRD §6.2.

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-009 (AC-1 to AC-9 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The first call creates `decisions/0001-<slug>.md` with the frontmatter fields and the three sections, and `decisions/` is created on demand (was AC-1)
- **FR-002**: The number is the highest existing one + 1 (gaps are allowed), and files that do not match `NNNN-*.md` are ignored (was AC-2)
- **FR-003**: An unknown `spec_id` gives `SPEC_NOT_FOUND` and nothing is written (was AC-3)
- **FR-004**: The slug has no accents, only `[a-z0-9-]` and at most 50 characters, and falls back to `decision` when empty (was AC-4)
- **FR-005**: When `context` or `consequences` is missing, that section is omitted (was AC-5)
- **FR-006**: A title with YAML-sensitive characters (`: # " '`) reads back exactly through the frontmatter (was AC-6)
- **FR-007**: 10 parallel calls create 10 files numbered 0001 to 0010, and no file is overwritten (was AC-7)
- **FR-008**: The returned `path` is relative to the root and never absolute (was AC-8)
- **FR-009**: `id` is written as a quoted string (`"0007"`), so YAML does not read it as a number (was AC-9)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 9 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Listing or searching decisions (Phase 2: `list_decisions`, `search_memory`)
- Out of scope: Superseding decisions (humans edit `status`)
