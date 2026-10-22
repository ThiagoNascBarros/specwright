# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] — 2026-10-21

Specwright now follows the file format and vocabulary of [GitHub Spec Kit](https://github.com/github/spec-kit) v1.2.x.

### Changed (breaking)
- **Format.**
  - Specs are read from Spec Kit features (`specs/NNN-name/` with `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` and `checklists/`). The `.specwright/` format is no longer read.
  - Progress is the `T###` tasks of `tasks.md`, which `set_task_status` marks `[X]` like `/speckit-implement`. Checklists are read-only.
- **Tools renamed.**
  - `list_specs` → `list_features`
  - `get_spec` → `get_artifact`
  - `list_open_requirements` → `list_open_tasks`
  - `set_criterion_status` → `set_task_status`
  - `check_task_against_spec` → `check_against_spec`
- **Memory.** Decisions and notes moved to `.specify/memory/decisions/` and `.specify/memory/notes/`. A decision links to a `feature` and uses Spec Kit's research format (Decision / Rationale / Alternatives considered).
- **Configuration.** `SPECWRIGHT_DIR` was replaced by `SPECWRIGHT_ROOT` (the project root), and `.specwright/config.json` by `.specify/specwright.json`.
- **Path guard.** Reads are limited to `specs/` and `.specify/`.
- **Error codes.** `FEATURE_NOT_FOUND`, `ARTIFACT_NOT_FOUND`, `TASK_NOT_FOUND` and `INVALID_FEATURE` replace the spec and criterion codes.

### Added
- `get_artifact` returns the constitution, named checklists and contracts, or a single `##` section. Template annotations such as `*(mandatory)*` are ignored when matching section names.
- `search_memory` and `pack_context` include the constitution principles. `pack_context` also uses `plan.md` sections and open tasks, and pins a feature's tasks first.
- The repository itself is migrated: `specs/001`–`009` and `.specify/memory/constitution.md`.
- A migration guide in the README.

## [0.1.0] — 2026-10-21

First release. All three roadmap phases are complete, and the server exposes 10 tools.

### Added
- **Specs**
  - `list_specs` and `get_spec`, which can return a single section and accepts heading aliases.
  - `list_open_requirements`.
  - `set_criterion_status`, an atomic edit that changes one byte and is idempotent.
  - `check_task_against_spec`, with a unified diff parser for `git diff` and `diff -u`.
- **Decisions.** `log_decision` (numbered `NNNN-slug.md` files, cross-process safe) and `list_decisions` (filters by spec and date).
- **Memory.** `save_memory` and `search_memory`, which ranks by title, tags and body, ignores case and accents, and covers decisions too.
- **Context.** `pack_context` builds the minimal context for a task within a token budget, including the file paths the items cite.
- **Safety and limits.**
  - A path guard against traversal and symlink escape.
  - Responses truncated to `maxResponseChars`.
  - Bounded parallel reads.
- **Tests.**
  - Unit, integration and stdio contract tests, plus an end-to-end workflow that uses all 10 tools.
  - Performance and load suites (`npm run test:load`), run in CI on Node 22 and 24.
- **Documentation.** PRD, TRD, Roadmap, ADRs, the decision log, a TDD record per phase, and the open-source project files.

### Fixed (found by the load suite before release)
- Duplicate decision numbers when two server processes shared a root. A cross-process lock now guards numbering.
- Quadratic response truncation. `list_open_requirements` over 2,000 specs went from 33 s to about 0.2 s.

[Unreleased]: https://github.com/ThiagoNascBarros/specwright/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ThiagoNascBarros/specwright/releases/tag/v0.2.0
[0.1.0]: https://github.com/ThiagoNascBarros/specwright/releases/tag/v0.1.0
