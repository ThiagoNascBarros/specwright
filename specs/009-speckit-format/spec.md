# Feature Specification: Spec Kit format

**Feature Branch**: `feature/SW-8-speckit-format`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "The spec format the MCP server must follow is the same format Spec Kit uses. Research the Spec Kit standard (a GitHub plugin), understand its skills, outputs and how it writes its documents, and use the same names: Spec Kit standardizes naming for agents, files and formats, and that must be followed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a Spec Kit project (Priority: P1)

An agent works in a project set up with Spec Kit: it has `specs/NNN-short-name/` folders written by `/speckit-specify`, `/speckit-plan` and `/speckit-tasks`, plus `.specify/memory/constitution.md`. The agent lists the features and reads only the artifact, or the section of it, that it needs.

**Why this priority**: Without reading Spec Kit's own files, nothing else works; this is the MVP.

**Independent Test**: Copy a project produced by Spec Kit's templates, unchanged, into a temporary folder. List its features, then read one section of one artifact.

**Acceptance Scenarios**:

1. **Given** a project with `specs/001-photo-albums/spec.md`, `plan.md` and `tasks.md`, **When** the agent lists features, **Then** it gets `001-photo-albums` with its title, its `**Status**` value, the artifacts present and its task progress.
2. **Given** the same project, **When** the agent asks for the `spec` artifact of `001-photo-albums` with the section "Requirements", **Then** it gets only that section.
3. **Given** a project with `.specify/memory/constitution.md`, **When** the agent asks for the `constitution` artifact, **Then** it gets the constitution without naming a feature.
4. **Given** a feature with `checklists/ux.md` and `contracts/api.md`, **When** the agent asks for the `checklist` "ux" or the `contract` "api", **Then** it gets that file.

---

### User Story 2 - Track task progress like `/speckit-implement` (Priority: P1)

The agent sees which tasks (`T001`…) are still open, filtered by user story, and marks a task complete exactly as `/speckit-implement` does, by turning `- [ ]` into `- [X]` in `tasks.md`.

**Why this priority**: Progress tracking closes the spec → code → spec loop that the product exists for.

**Independent Test**: Use a `tasks.md` from Spec Kit's template. List the open tasks of `US1`, mark one done, and compare the file with the original: exactly one character differs.

**Acceptance Scenarios**:

1. **Given** a `tasks.md` with tasks across phases, **When** the agent lists open tasks, **Then** each task comes with its id, the `[P]` parallel flag, its `[USn]` story, its phase and its description.
2. **Given** an open task `T012`, **When** the agent marks it done, **Then** only that line changes, from `- [ ] T012` to `- [X] T012`.
3. **Given** a checklist under `checklists/`, **When** the agent tries to mark one of its items, **Then** it is refused, because Spec Kit checklists belong to the reviewer.

---

### User Story 3 - Check work against the spec before saying "done" (Priority: P2)

Before finishing, the agent sends its diff and the feature id. It gets back the functional requirements, the success criteria, the user stories with their acceptance scenarios, the edge cases, the assumptions, the open tasks, the unresolved clarification markers and a summary of the diff. It then compares them itself.

**Why this priority**: This prevents spec drift, but it depends on Stories 1 and 2.

**Independent Test**: Run a feature and a diff through the check. The response lists every `FR-###`, `SC-###` and scenario, and no diff line content.

**Acceptance Scenarios**:

1. **Given** a spec with `FR-001`…`FR-005`, `SC-001`…`SC-003` and two user stories, **When** the agent checks a diff, **Then** all of them are returned with their ids, and the scenarios are grouped by story and priority.
2. **Given** a spec that still has `[NEEDS CLARIFICATION: …]` markers, **When** the agent checks a diff, **Then** the open clarifications are listed.

---

### User Story 4 - Project memory in `.specify/memory/` (Priority: P2)

Decisions and notes live next to the constitution, in `.specify/memory/`. A decision is written in Spec Kit's research format (Decision / Rationale / Alternatives considered) and is linked to a feature. Later sessions list and search decisions, notes and the constitution.

**Why this priority**: It preserves knowledge between sessions, using Spec Kit's location and vocabulary.

**Independent Test**: Log a decision and save a note. A new server process then finds both, and also a constitution principle, by search.

**Acceptance Scenarios**:

1. **Given** a feature `001-photo-albums`, **When** the agent logs a decision with a rationale and alternatives, **Then** `.specify/memory/decisions/0001-<slug>.md` is created with `## Decision`, `## Rationale` and `## Alternatives considered`.
2. **Given** a constitution that contains "Test-First", **When** the agent searches "test first", **Then** that constitution principle is among the results.

---

### User Story 5 - Minimal context from Spec Kit artifacts (Priority: P3)

Given a task description, the agent receives the most relevant sections of `spec.md` and `plan.md`, the open tasks, the constitution principles, decisions and notes, and the file paths they cite, all within a token budget.

**Why this priority**: It saves tokens, but it is useful only after Stories 1–4.

**Independent Test**: In a Spec Kit fixture, ask for context with a 1,000-token budget. The response is relevant, stays within the budget and cites the task file paths.

**Acceptance Scenarios**:

1. **Given** a feature whose tasks cite `src/models/album.py`, **When** the agent packs context for "add album sorting" with `feature: 001-photo-albums`, **Then** that feature's open tasks come first and `src/models/album.py` is among the files.

---

### User Story 6 - Specwright follows Spec Kit itself (Priority: P3)

The Specwright repository is migrated to the Spec Kit layout:
- every spec moves into `specs/NNN-name/spec.md` with a `tasks.md`;
- the PRD principles become `.specify/memory/constitution.md`;
- decisions and notes move to `.specify/memory/`;
- nothing is left in `.specwright/`.

**Why this priority**: Dogfooding proves the format end to end, and it is cheap once Stories 1–5 exist.

**Independent Test**: Run the server against this repository. It lists 9 valid features and no open tasks except those of this feature.

**Acceptance Scenarios**:

1. **Given** the migrated repository, **When** features are listed, **Then** features `001` to `009` are valid, and features `001` to `008` have every task done.

---

### Edge Cases

- What happens with timestamp-prefixed feature folders (`20261021-143000-photo-albums`)? They are features too.
- What happens with folders in `specs/` that do not match the naming? They are ignored and are not listed as features.
- What if a feature has only `plan.md`, or `spec.md` without the `# Feature Specification:` heading? It is listed as invalid, with the reason.
- What if task ids are duplicated, or a task line has no id (`- [ ] Do X`)? Duplicates make the feature invalid and block writes. A line without an id is reported, not counted.
- What about `- [x]` (lowercase)? It counts as done, and marking a task done always writes `[X]`, as `/speckit-implement` does.
- What about task-like lines inside code fences, such as the template's "Parallel Example"? They are not tasks.
- What happens with CRLF line endings, a UTF-8 BOM or emoji in headings (`## Phase 3: User Story 1 - Title (Priority: P1) 🎯 MVP`)? They are handled and preserved.
- What if `specs/` or `.specify/` is missing? Listings are empty, and a missing project root is an error with a hint to run `specify init`.
- What about paths outside `specs/` and `.specify/`, including symlinks? They are never read or written.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST treat the project root (by default the folder the server is started in) as the base. It MUST read only `specs/` and `.specify/` below it, and MUST write only `tasks.md` checkboxes and files under `.specify/memory/`.
- **FR-002**: System MUST recognize as a feature every direct subfolder of `specs/` whose name is a 3+ digit number or a `YYYYMMDD-HHMMSS` timestamp, followed by `-` and a lowercase short name. The folder name is the feature id.
- **FR-003**: System MUST read `spec.md` as Spec Kit writes it:
  - the title from `# Feature Specification: <title>`;
  - the `**Feature Branch**`, `**Created**`, `**Status**` and `**Input**` lines;
  - the user stories `### User Story N - <title> (Priority: Pn)`, with their numbered **Given**/**When**/**Then** scenarios;
  - the `FR-###` and `SC-###` items and the `[NEEDS CLARIFICATION: …]` markers;
  - the sections Edge Cases, Key Entities, Assumptions and Clarifications.
- **FR-004**: System MUST read `tasks.md` as Spec Kit writes it:
  - task lines `- [ ] T### [P] [USn] description` (the `[P]` and `[USn]` labels are optional), where `[x]` and `[X]` both mean done;
  - phases from `## Phase N: <name>` headings;
  - task-like lines inside code fences are not tasks.
- **FR-005**: `list_features` MUST return, for each feature:
  - its id, title, status, which artifacts exist (spec, plan, tasks, research, data-model, quickstart, contracts, checklists) and task progress `{done, total}`;
  - the number of open clarifications;
  - validity, with the reasons when it is invalid.
- **FR-006**: `get_artifact` MUST return one artifact of a feature (`spec`, `plan`, `tasks`, `research`, `data-model`, `quickstart`, a named `checklist` or a named `contract`), or the project `constitution`. It MUST be able to return a single `##` section only.
- **FR-007**: `list_open_tasks` MUST list the open tasks of one feature or of all valid features, optionally for one user story, each with its id, parallel flag, story, phase and description.
- **FR-008**: `set_task_status` MUST mark one task done (`[X]`) or open (`[ ]`). It changes only that checkbox character, is idempotent, refuses invalid features, and never edits `spec.md`, checklists or any other artifact.
- **FR-009**: `check_against_spec` MUST return, for a feature and a unified diff:
  - its requirements, success criteria, user stories with scenarios, edge cases and assumptions;
  - its open and done tasks and its open clarifications;
  - a per-file diff summary without line content.
- **FR-010**: `log_decision` MUST create `.specify/memory/decisions/NNNN-<slug>.md`, linked to a feature, with the sections Decision, Rationale and Alternatives considered (Spec Kit's research format). `list_decisions` MUST filter by feature and by date.
- **FR-011**: `save_memory` MUST create notes (convention, learning or pitfall) in `.specify/memory/notes/<slug>.md`. `search_memory` MUST search notes, decisions and the principles of the constitution.
- **FR-012**: `pack_context` MUST select among:
  - `spec.md` and `plan.md` sections, open tasks and constitution principles;
  - decisions and notes.

  With a feature given, that feature's open tasks MUST come first. It MUST stay within the token budget and list the file paths cited by the chosen items.
- **FR-013**: The server MUST expose exactly 10 tools, named after Spec Kit's vocabulary: `list_features`, `get_artifact`, `list_open_tasks`, `set_task_status`, `check_against_spec`, `log_decision`, `list_decisions`, `save_memory`, `search_memory`, `pack_context`.
- **FR-014**: The previous `.specwright/` format MUST no longer be read. The documentation MUST explain how to move a project from it, and this repository MUST be migrated (User Story 6).
- **FR-015**: A feature MUST be invalid when any of these holds, and writes to an invalid feature MUST be refused:
  - `spec.md` is missing or has no `# Feature Specification:` heading;
  - a `T###`, `FR-###` or `SC-###` id is duplicated.

### Key Entities *(include if feature involves data)*

- **Feature**: a `specs/<id>/` folder. It has an id, a title, a status, artifacts and task progress.
- **Specification (`spec.md`)**: the feature's user stories, requirements, success criteria, edge cases, assumptions and clarifications.
- **User Story**: a number, title and priority (P1…), with numbered acceptance scenarios (Given/When/Then).
- **Requirement / Success Criterion**: an `FR-###` / `SC-###` id and its text.
- **Task**: a `T###` id, a done flag, a parallel flag, a story label, a phase and a description, from `tasks.md`.
- **Checklist**: `checklists/<name>.md` with `CHK###` items. It is owned by the reviewer and is read-only for the server.
- **Constitution**: `.specify/memory/constitution.md`, with principles and governance.
- **Decision / Note**: project memory in `.specify/memory/decisions/` and `.specify/memory/notes/`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A project produced from Spec Kit's v1.2.x templates works with all 10 tools without editing a single file.
- **SC-002**: Marking a task done changes exactly one character of `tasks.md`, the same change `/speckit-implement` makes.
- **SC-003**: With 500 features, listing features and open tasks each take under 500 ms, and reading one artifact section takes under 200 ms.
- **SC-004**: The complete tool listing stays within 12,000 characters, and each tool description is at most 2 sentences.
- **SC-005**: After migration, this repository has no `.specwright/` folder and lists 9 valid features.

## Assumptions

- The reference is Spec Kit v1.2.x (released 2026-10-19). Its English template headings are the ones recognized; the Portuguese heading aliases of v0.1.0 are dropped.
- Git branches keep this project's `feature/SW-<n>-…` convention. Spec Kit's own `NNN-name` branch naming is not required, because the feature id comes from the folder, as Spec Kit allows through `.specify/feature.json`.
- Specwright does not create features, plans or tasks. That remains the job of the Spec Kit skills (`/speckit-specify`, `/speckit-plan`, `/speckit-tasks`). Specwright only reads them, tracks task progress and keeps memory.
- Checklists are never modified by the server, following Spec Kit's rule that their markers belong to the reviewer.
- Out of scope for this feature:
  - reading `.specify/feature.json` to pick a default feature;
  - Spec Kit extensions, presets and workflows;
  - writing `research.md`.
