---

description: "Task list for the Spec Kit format migration"
---

# Tasks: Spec Kit format

**Input**: Design documents from `/specs/009-speckit-format/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/tools.md

**Tests**: Required. Test-first is a non-negotiable principle of this project. Every test task must be written and seen failing before the implementation tasks of its group. Test names start with the requirement or scenario id, for example `it('FR-004: …')` or `it('US2-AS2: …')`.

**Organization**: Tasks are grouped by user story, so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixtures and helpers that every story's tests need

- [ ] T001 Create the Spec Kit fixture project in `tests/fixtures/speckit/`, in the official v1.2.x template shapes (template comments and the "Parallel Example" fence kept):
  - `specs/001-photo-albums/{spec.md,plan.md,tasks.md,research.md,data-model.md,quickstart.md}`, `contracts/api.md`, `checklists/requirements.md` and `checklists/ux.md`;
  - `specs/002-sharing/{spec.md,tasks.md}`;
  - `.specify/memory/constitution.md`.
- [ ] T002 [P] Add `copyFixture(name)` to `tests/helpers.ts` (copies a fixture into a temp folder and returns `{ root }`), and make `makeProject()` return the project root as `root`
- [ ] T003 [P] Add the fixture tree to `.gitattributes` coverage (`tests/fixtures/** -text` already applies) and verify with `git check-attr`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, path guard, Markdown helpers and the feature parsers that every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Phase 2

- [ ] T004 [P] FR-001 tests in `tests/unit/config.test.ts`:
  - `SPECWRIGHT_ROOT` is resolved against cwd and defaults to cwd;
  - `maxResponseChars` is read from `.specify/specwright.json`;
  - an invalid value is rejected.
- [ ] T005 [P] FR-001 tests in `tests/unit/paths.test.ts`:
  - paths under `specs/` and `.specify/` are allowed;
  - `src/x.ts`, `../x`, absolute paths, `..\\x` and a symlink inside `specs/` that points outside are refused with `PATH_OUTSIDE_ROOT`;
  - a missing root gives `NOT_INITIALIZED`, with a `specify init` hint.
- [ ] T006 [P] R4 tests in `tests/unit/markdown.test.ts`: `stripComments()` removes `<!-- … -->` blocks across lines, and code-fence masking skips fenced lines.
- [ ] T007 [P] FR-003 tests in `tests/unit/spec-parser.test.ts`:
  - title and metadata;
  - user stories with number, title, priority and scenarios;
  - FR/SC items;
  - edge cases, assumptions and clarification markers, ignoring comments and fences;
  - LF, CRLF and BOM give the same result.
- [ ] T008 [P] FR-004 tests in `tests/unit/tasks-parser.test.ts`:
  - id, done (`[x]` and `[X]`), `[P]`, `[USn]`, phase from `## Phase N:` (including the emoji suffix) and text;
  - fenced lines are skipped;
  - the frontmatter is ignored;
  - an id-less checkbox gives a warning.
- [ ] T009 [P] FR-002 and FR-015 tests in `tests/unit/feature.test.ts`:
  - folder-name validation (sequential and timestamp ids);
  - an invalid feature for each blocking issue;
  - warnings that do not invalidate.

### Implementation for Phase 2

- [ ] T010 [P] Rewrite `src/config.ts`: `loadConfig(env, cwd)` → `{ root, maxResponseChars }`, with `root = resolve(cwd, env.SPECWRIGHT_ROOT || '.')` and the config read from `.specify/specwright.json`
- [ ] T011 [P] Add the allowlist to `src/storage/paths.ts`: `resolveInside(root, rel)` rejects anything whose first segment is not `specs` or `.specify`; `ensureRoot` gets the new hint
- [ ] T012 [P] Add `stripComments(text)` and the fence-aware line iteration to `src/storage/markdown.ts`
- [ ] T013 Create `src/features/types.ts` (`Feature`, `Specification`, `UserStory`, `Item`, `Task`, `ArtifactName`, `FEATURE_ID_PATTERN`) and `src/features/schemas.ts` (`featureIdSchema`, `taskIdSchema`, `storySchema`, `artifactNameSchema`)
- [ ] T014 [P] Implement `parseSpecification(raw): Specification` in `src/features/spec-parser.ts` (depends on T012, T013)
- [ ] T015 [P] Implement `parseTasks(raw): { tasks: Task[]; warnings: string[] }` in `src/features/tasks-parser.ts` (depends on T012, T013)
- [ ] T016 Implement `src/features/artifacts.ts`: `ARTIFACT_FILES` and `existingArtifacts(dir)`. Then implement `src/features/feature.ts`: `buildFeature(id, files)` with the validation and `summarize(feature)` (depends on T014, T015)
- [ ] T017 Implement `src/features/repository.ts`: `listFeatureIds(root)`, `readFeature(root, id)`, `readAllFeatures(root)` (bounded by `mapLimit`), `readArtifact(root, id, artifact, name?)` and `assertValid(feature)` (depends on T011, T016)
- [ ] T018 Rename the error codes in `src/errors.ts`: `FEATURE_NOT_FOUND`, `ARTIFACT_NOT_FOUND`, `TASK_NOT_FOUND`, `INVALID_FEATURE`

**Checkpoint**: The parsers and the repository pass T004–T009, and user story work can begin

---

## Phase 3: User Story 1 - Read a Spec Kit project (Priority: P1) 🎯 MVP

**Goal**: `list_features` and `get_artifact` work on unmodified Spec Kit output

**Independent Test**: Copy `tests/fixtures/speckit/`, list its features, and read one section of one artifact (quickstart Scenario 1)

### Tests for User Story 1

- [ ] T019 [P] [US1] SC-001 tests in `tests/integration/features.test.ts`:
  - US1-AS1, FR-005: ids, titles, status, artifacts, task progress and open clarifications;
  - a `status` filter;
  - non-feature folders are ignored;
  - a timestamp id is listed.
- [ ] T020 [P] [US1] Tests in `tests/integration/artifacts.test.ts`:
  - US1-AS2 to US1-AS4 and FR-006: a section of `spec`; the `constitution`; a named `checklist` and `contract`;
  - comments are stripped;
  - the errors `ARTIFACT_NOT_FOUND` (hint lists names), `SECTION_NOT_FOUND` and `INVALID_INPUT`.

### Implementation for User Story 1

- [ ] T021 [P] [US1] Create `src/constitution/types.ts`, `src/constitution/parser.ts` (`parseConstitution`) and `src/constitution/repository.ts` (`readConstitution(root)`)
- [ ] T022 [P] [US1] Implement `src/features/tools/list-features.ts`
- [ ] T023 [US1] Implement `src/features/tools/get-artifact.ts` (depends on T021)
- [ ] T024 [US1] Create `src/features/index.ts` (`register`), wire it in `src/server.ts`, delete `src/specs/` and its obsolete tests, and set `EXPECTED_TOOLS` in `tests/contract/server.test.ts`

**Checkpoint**: User Story 1 is fully functional and testable on its own

---

## Phase 4: User Story 2 - Track task progress (Priority: P1)

**Goal**: `list_open_tasks` and `set_task_status` behave like `/speckit-implement`

**Independent Test**: quickstart Scenario 2, where exactly one character of `tasks.md` differs after marking a task

### Tests for User Story 2

- [ ] T025 [P] [US2] Tests in `tests/unit/task-editor.test.ts`:
  - US2-AS2 and SC-002: exactly one byte changes and `[X]` is written;
  - lowercase `[x]` is unchecked;
  - idempotent;
  - CRLF and BOM are preserved;
  - `T001` does not match `T0010`;
  - fenced lines are not touched.
- [ ] T026 [P] [US2] Tests in `tests/integration/tasks.test.ts`:
  - US2-AS1 and FR-007: the open task fields and the story filter;
  - FR-008: the `changed` flag and an unchanged mtime;
  - `TASK_NOT_FOUND`, `INVALID_FEATURE` and `ARTIFACT_NOT_FOUND`;
  - US2-AS3: no tool can modify a checklist file.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Implement `setTaskCheckbox(raw, id, done)` in `src/features/task-editor.ts`
- [ ] T028 [US2] Implement `src/features/tools/list-open-tasks.ts`
- [ ] T029 [US2] Implement `src/features/tools/set-task-status.ts` (depends on T027)

**Checkpoint**: User Stories 1 and 2 both work on their own

---

## Phase 5: User Story 3 - Check work against the spec (Priority: P2)

**Goal**: `check_against_spec` returns everything the agent needs to compare

**Independent Test**: quickstart Scenario 3

### Tests for User Story 3

- [ ] T030 [P] [US3] Tests in `tests/integration/check-against-spec.test.ts`:
  - US3-AS1 and FR-009: requirements, success criteria, stories with scenarios, edge cases, assumptions, tasks and the diff summary, with no diff content;
  - US3-AS2: open clarifications;
  - the errors.
- [ ] T031 [P] [US3] Move `tests/unit/diff.test.ts` to import from `src/features/diff.ts` (no behavior change)

### Implementation for User Story 3

- [ ] T032 [US3] Move `src/specs/diff.ts` to `src/features/diff.ts`, and implement `src/features/tools/check-against-spec.ts`

**Checkpoint**: User Stories 1 to 3 work

---

## Phase 6: User Story 4 - Project memory in `.specify/memory/` (Priority: P2)

**Goal**: decisions and notes live in `.specify/memory/`, and the constitution is searchable

**Independent Test**: quickstart Scenario 4

### Tests for User Story 4

- [ ] T033 [P] [US4] Update `tests/integration/decision-log.test.ts` and `tests/integration/decision-list.test.ts`:
  - US4-AS1 and FR-010: the path `.specify/memory/decisions/`, the `feature` field and the sections Decision, Rationale and Alternatives considered;
  - `FEATURE_NOT_FOUND`;
  - the `feature` filter;
  - a legacy decision with Context and Consequences is still read.
- [ ] T034 [P] [US4] Update `tests/integration/memory.test.ts`:
  - FR-011: notes in `.specify/memory/notes/`;
  - US4-AS2: a constitution principle is found, with `type: "constitution"`.

### Implementation for User Story 4

- [ ] T035 [P] [US4] Update `src/decisions/` (types, repository, both tools) to the new path, field and sections
- [ ] T036 [US4] Update `src/memory/` (repository path, `search.ts` with constitution principles, `search-memory` type enum) (depends on T021)

**Checkpoint**: User Stories 1 to 4 work

---

## Phase 7: User Story 5 - Minimal context from Spec Kit artifacts (Priority: P3)

**Goal**: `pack_context` draws from spec and plan sections, open tasks, the constitution, decisions and notes

**Independent Test**: a fixture task with a 1,000-token budget gives relevant items within budget, with the task file paths

### Tests for User Story 5

- [ ] T037 [P] [US5] Update `tests/integration/context-pack.test.ts`:
  - US5-AS1 and FR-012: the kinds and refs;
  - with `feature`, its open tasks are pinned first in file order;
  - task file paths appear in `files`;
  - invalid features are ignored;
  - the budget is respected.

### Implementation for User Story 5

- [ ] T038 [US5] Update `src/context/candidates.ts` and `src/context/tools/pack-context.ts` to the new sources and the `feature` parameter, and extend `src/context/files.ts` to pick up the paths written in task descriptions (`in src/x.py`)

**Checkpoint**: All six user stories but US6 work

---

## Phase 8: User Story 6 - Specwright follows Spec Kit itself (Priority: P3)

**Goal**: the repository uses the Spec Kit layout, and `.specwright/` is gone

**Independent Test**: running the server on the repository lists 9 valid features (US6-AS1)

- [ ] T039 [US6] Create `.specify/memory/constitution.md` from the PRD-001 principles and TRD §2, in the constitution template shape (Core Principles I–VI, Additional Constraints, Development Workflow, Governance, Version 1.0.0)
- [ ] T040 [US6] FR-014: Migrate the 8 existing specs into `specs/001-project-foundation` … `specs/008-context-pack`. Each gets a `spec.md` in the spec template shape (AC-n become FR-### and acceptance scenarios) and a `tasks.md` with every task `[X]`.
- [ ] T041 [US6] FR-014: Move `.specwright/decisions/*` to `.specify/memory/decisions/` (`spec_id` → `feature` with the new ids) and `.specwright/memory/*` to `.specify/memory/notes/`, then delete `.specwright/`. Update `.mcp.json` (`SPECWRIGHT_ROOT`) and `.gitignore` (`.specify/memory/decisions/.lock/`).
- [ ] T042 [US6] SC-005: Add `tests/integration/repository-dogfood.test.ts`. It copies `specs/` and `.specify/` into a temp folder and asserts 9 valid features, with features 001–008 fully done.

**Checkpoint**: The repository dogfoods the format

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Contract, performance, load and documentation

- [ ] T043 [P] FR-013 and SC-004: update `tests/contract/server.test.ts` (the 10 new names, ≤ 12,000 characters, ≤ 2 sentences) and `tests/contract/workflow.test.ts` (an end-to-end session on the Spec Kit fixture over stdio)
- [ ] T044 [P] SC-003: update `tests/perf/*.perf.test.ts` and `tests/load/stdio.load.test.ts` to generate Spec Kit features (500 and 2,000) and notes in `.specify/memory/`
- [ ] T045 [P] Update `examples/starter/` to a Spec Kit layout (`specs/001-auth-login/{spec.md,tasks.md}`, `.specify/memory/constitution.md`) and `tests/integration/examples.test.ts`
- [ ] T046 [P] FR-014: Update `README.md`:
  - Spec Kit positioning ("the memory and validation layer for Spec Kit projects");
  - the new tool table and quick start;
  - the format section;
  - migration from v0.1.0.
- [ ] T047 [P] Update `docs/01-prd.md` (FR names, v1.1), `docs/02-trd.md` (v2.0: storage, formats, tool contract, errors, structure), `docs/03-roadmap.md` (SW-8) and `CLAUDE.md`
- [ ] T048 [P] Add `docs/tdd/phase-4.md`, the RED → GREEN record and the FR/US → test map for this feature
- [ ] T049 Bump the version to 0.2.0 in `package.json` and add a `CHANGELOG.md` entry (breaking: format and tool names)
- [ ] T050 Run quickstart.md validation, then `npm run typecheck`, `npm test` and `npm run test:load`, and mark this feature's tasks with `set_task_status`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** starts immediately.
- **Foundational (Phase 2)** depends on Setup and blocks every user story.
- **US1 (Phase 3)** depends on Phase 2.
- **US2 and US3** depend on Phase 2 and reuse US1's `features/index.ts` (T024).
- **US4** depends on T021 (constitution) for search.
- **US5** depends on US1, US2 and US4 (its sources).
- **US6** depends on US1 to US4 (the migrated repository must parse).
- **Polish** depends on all stories.

### Within Each User Story

- Tests are written and must FAIL before the implementation.
- Types and parsers come before repositories, and repositories before tools.
- Commit after each task group, with `Refs: SW-8`.

### Parallel Opportunities

- T002 and T003, the six test files T004–T009, and T010–T012 can each run in parallel.
- T014 and T015 can run in parallel.
- Within each story, its test tasks can run in parallel.
- T043–T048 can run in parallel.

## Parallel Example: Phase 2 tests

```bash
Task: "FR-003 tests in tests/unit/spec-parser.test.ts"
Task: "FR-004 tests in tests/unit/tasks-parser.test.ts"
Task: "FR-002/FR-015 tests in tests/unit/feature.test.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1): read-only Spec Kit support.
3. **Stop and validate** with quickstart Scenario 1.

### Incremental Delivery

US1 → US2 (task progress) → US3 (check) → US4 (memory) → US5 (context) → US6 (dogfood) → Polish → release v0.2.0.

## Notes

- [P] tasks touch different files and have no dependencies.
- The [Story] label maps each task to its user story, for traceability.
- Verify that tests fail before implementing.
- Avoid vague tasks, same-file conflicts, and cross-story dependencies that break independence.
