# Research: Spec Kit format

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-21

The reference was read directly from `github/spec-kit` at release v1.2.2 (2026-10-19):
- `templates/spec-template.md`, `plan-template.md`, `tasks-template.md`, `checklist-template.md` and `constitution-template.md`;
- `templates/commands/*.md`;
- `scripts/bash/create-new-feature.sh` and `common.sh`;
- `docs/integrations/claude.md`.

## R1. Project root and readable areas

- **Decision**: The server is configured with the project root. That is `SPECWRIGHT_ROOT`, or the folder the server is started in by default. The path guard allows only paths under `specs/` and `.specify/`, and writes are limited to `specs/*/tasks.md` and `.specify/memory/**`.
- **Rationale**: Spec Kit keeps features in `specs/` at the repository root and project memory in `.specify/memory/`. A single root with an allowlist keeps NFR-6 (no access beyond what is needed) while reaching both.
- **Alternatives considered**:
  - Two settings, one per folder: more configuration for no gain, because Spec Kit fixes both paths.
  - Keep `SPECWRIGHT_DIR`: its meaning changes from "Specwright folder" to "project root", so the old name would mislead.

## R2. Feature identification

- **Decision**: A feature is a direct child of `specs/` whose name matches `^(\d{3,}|\d{8}-\d{6})-[a-z0-9][a-z0-9-]*$`. The id is the folder name.
- **Rationale**: `create-new-feature.sh` produces `printf "%03d"` sequential prefixes or `YYYYMMDD-HHMMSS` timestamps, followed by a cleaned short name. Using the folder name as the id is what Spec Kit's own commands do, through `.specify/feature.json` → `feature_directory`.
- **Alternatives considered**:
  - Parse the number only: two features may share a short name across numbers.
  - Use the branch name: Spec Kit no longer requires branch = folder, and this project uses `feature/SW-n-…` branches.

## R3. What counts as progress

- **Decision**: Progress means `tasks.md` task lines (`- [ ] T### …`). `set_task_status` writes `[X]` when done and `[ ]` when open. Checklist items (`CHK###`) are read-only.
- **Rationale**: `/speckit-implement` says "mark the task off as [X] in the tasks file", and the checklist template says "`[x]` means the reviewer determined the requirements-quality criterion is satisfied… implement reads checklist state but must not modify markers". FR/SC items and Given/When/Then scenarios have no checkboxes in Spec Kit.
- **Alternatives considered**: Allowing checklist edits was rejected, because it contradicts Spec Kit's ownership rule. Adding checkboxes to FR items was rejected, because it would invent a format Spec Kit does not have.

## R4. Parsing `spec.md`

- **Decision**: Strip HTML comments and code fences first, because the templates are full of `<!-- ACTION REQUIRED … -->` blocks. Then read:
  - the title from `# Feature Specification: …`;
  - the metadata from `**Feature Branch**`, `**Created**`, `**Status**` and `**Input**`;
  - user stories from `### User Story N - Title (Priority: Pn)`, with scenarios from numbered `**Given** … **When** … **Then** …` lines until the next heading;
  - `FR-###` and `SC-###` from `- **ID**: text`;
  - list items from the `Edge Cases` (a `###` under the user scenarios) and `Assumptions` sections;
  - clarifications from `[NEEDS CLARIFICATION: …]` markers.

  Sections are still `##` blocks, so `get_artifact` can return one.
- **Rationale**: These are the exact shapes in `spec-template.md`. Stripping comments keeps template guidance from being counted as content.
- **Alternatives considered**:
  - A Markdown AST library: it would be a new runtime dependency (TRD §2) for line-level patterns.
  - Requiring frontmatter: Spec Kit's `spec.md` has none.

## R5. Parsing `tasks.md`

- **Decision**: Task line regex: `^\s*- \[( |x|X)\] (T\d{3,})(?: \[P\])?(?: \[(US\d+)\])? (.+)$`, with `[P]` and `[USn]` optional and in that order (as in the template).
  - The phase is the nearest preceding `## Phase N: …` heading.
  - Lines inside code fences, such as the template's "Parallel Example", are skipped.
  - The YAML frontmatter at the top of `tasks.md` (`description: …`) is ignored.
  - Checkbox lines without a `T###` id are reported as issues.
- **Rationale**: This matches the template's format line `[ID] [P?] [Story] Description` and its samples, for example `- [ ] T012 [P] [US1] Create [Entity1] model in src/models/[entity1].py`.
- **Alternatives considered**: Free-order labels were rejected (YAGNI): the template fixes the order.

## R6. Memory location and decision format

- **Decision**: Decisions go to `.specify/memory/decisions/NNNN-<slug>.md`, and notes go to `.specify/memory/notes/<slug>.md`.
  - A decision's frontmatter is `id`, `feature`, `title`, `date` and `status`.
  - Its body has `## Decision`, `## Rationale` and `## Alternatives considered`, and empty sections are omitted.
  - Reading accepts any `##` sections, so that migrated decisions with `Context`/`Consequences` stay readable.
- **Rationale**: `.specify/memory/` is where Spec Kit keeps the constitution (project memory). The three section names are Spec Kit's research format (`plan` command, Phase 0).
- **Alternatives considered**:
  - Writing decisions into each feature's `research.md`: that file is owned by `/speckit-plan` and may be regenerated.
  - Keeping `.specwright/`: it contradicts the requirement to follow Spec Kit's layout.

## R7. Constitution

- **Decision**: `get_artifact` can return `.specify/memory/constitution.md` (artifact `constitution`). The constitution's `###` principles under `## Core Principles` are searchable items for `search_memory` and `pack_context`. The server never writes the constitution.
- **Rationale**: The constitution is created by `/speckit-constitution`, and the plan template gates on it ("Constitution Check").
- **Alternatives considered**: A dedicated `get_constitution` tool was rejected: it would add an 11th tool (NFR-2).

## R8. Tool names

- **Decision**: The tools are `list_features`, `get_artifact`, `list_open_tasks`, `set_task_status`, `check_against_spec`, `log_decision`, `list_decisions`, `save_memory`, `search_memory` and `pack_context`. The error codes are renamed accordingly:
  - `FEATURE_NOT_FOUND`, `ARTIFACT_NOT_FOUND`, `TASK_NOT_FOUND`, `INVALID_FEATURE`;
  - the others are kept.
- **Rationale**: Spec Kit's vocabulary is feature, spec, plan, tasks, checklist, contract and constitution. The owner accepted the recommended rename.
- **Alternatives considered**: Keeping the v0.1.0 names would mislead (`list_specs` would list features, and `criterion` no longer exists).

## R9. Test fixtures

- **Decision**: `tests/fixtures/speckit/` holds a small Spec Kit project, written with the official template shapes (including the template comments and code fences), with two features and a constitution. Integration tests copy it into a temporary folder. The edge-case variants (CRLF, BOM, timestamps, invalid features) are generated inline by the tests.
- **Rationale**: SC-001 asks that real Spec Kit output works unchanged, so the fixture must keep the template's quirks.
- **Alternatives considered**: Running `specify init` in tests was rejected: it needs Python and uv, and the network.
