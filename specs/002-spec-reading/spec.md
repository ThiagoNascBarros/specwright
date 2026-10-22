# Feature Specification: Read specs (list_specs, get_spec)

**Feature Branch**: `feature/SW-2-spec-core`

**Created**: 2026-10-21

**Status**: Implemented

**Input**: Migrated from the v0.1.0 Specwright spec `spec-reading`; its acceptance criteria AC-n became FR-00n.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read specs (list_specs, get_spec) (Priority: P1)

Spec 2 of the [Roadmap](../../docs/03-roadmap.md). This is the first vertical slice: once it is done, an agent connected to Specwright can list the project's specs and read a whole spec or a single section, without loading every file. Requirements covered: FR-1, FR-2, FR-3, NFR-3, NFR-4, NFR-6, NFR-7, NFR-8 (PRD-001). Technical reference: TRD-001 §3–§10.

**Why this priority**: It is the whole scope of this feature.

**Independent Test**: Run `npm test` and `npm run test:load`; the tests named after each criterion (see [docs/tdd/](../../docs/tdd/)) pass.

**Acceptance Scenarios**:

1. **Given** the implementation of this feature, **When** `npm test` runs, **Then** every test named after FR-001 to FR-015 (AC-1 to AC-15 in v0.1.0) passes

---

### Edge Cases

- Covered per criterion by the tests listed in [docs/tdd/](../../docs/tdd/)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `loadConfig` resolves a relative `SPECWRIGHT_DIR` against `cwd`, uses `.specwright` when unset, and returns `maxResponseChars: 20000` when `config.json` is missing or has no such field (was AC-1)
- **FR-002**: Every tool call returns `NOT_INITIALIZED`, with a hint naming `.specwright/specs/`, when the root does not exist (was AC-2)
- **FR-003**: `resolveInside` rejects `../x`, absolute paths and a symlink inside the root that points outside it, each with `PATH_OUTSIDE_ROOT` (was AC-3)
- **FR-004**: `parseDocument` handles LF, CRLF and a UTF-8 BOM and gives the same sections for all three. Text before the first `##` belongs to no section, and `###` stays inside its parent section. (was AC-4)
- **FR-005**: A spec with missing frontmatter, `id` different from the file name, `status` outside the enum, a duplicated `AC-n` or a duplicated `##` heading is reported by `list_specs` with `valid: false` and one issue per problem, and the other specs are still listed (was AC-5)
- **FR-006**: `list_specs` returns every spec sorted by `id` with `criteria: {done, total}`. `AC-1` and `AC-10` count as distinct criteria, and a spec with no criteria section gives `{0, 0}`. (was AC-6)
- **FR-007**: `list_specs({ status: "done" })` returns only specs with that status (was AC-7)
- **FR-008**: `get_spec` without `section` returns the body without the frontmatter (was AC-8)
- **FR-009**: `get_spec` with `section` accepts the normalized key (`acceptance-criteria`), the original heading text (`Acceptance criteria`) and a fixed alias (`critérios de aceite`), and returns only that section (was AC-9)
- **FR-010**: `get_spec` returns `SPEC_NOT_FOUND` for an unknown id, and `SECTION_NOT_FOUND` with a hint listing the available keys for an unknown section (was AC-10)
- **FR-011**: `get_spec` rejects `spec_id` values `../etc`, `Foo`, `a/b` and `/abs` before touching the disk (was AC-11)
- **FR-012**: A response longer than `maxResponseChars` is cut to that length and carries `truncated: true` (was AC-12)
- **FR-013**: Over stdio, `tools/list` returns exactly `list_specs` and `get_spec`, and the serialized JSON is at most 12,000 characters (NFR-3) (was AC-13)
- **FR-014**: With a generated fixture of 500 specs, `list_specs` answers in under 500 ms and `get_spec` in under 200 ms (NFR-7) (was AC-14)
- **FR-015**: Smoke dogfooding: with `.mcp.json`, an agent session lists this repo's specs and reads one section of `spec-reading` (was AC-15)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 15 functional requirements are covered by passing tests in CI on Node 22 and 24

## Assumptions

- Out of scope: Writing to specs (`set_criterion_status`, spec 3) and `storage/files`
- Out of scope: `list_open_requirements` (spec 3) and `log_decision` (spec 4)
- Out of scope: Caching or indexing (ADR-0004)
- Out of scope: Any other `config.json` fields
