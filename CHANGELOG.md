# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Branch, commit and PR conventions with task codes (`SW-<n>`) documented in CONTRIBUTING.md; history renamed to follow them.

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

[Unreleased]: https://github.com/ThiagoNascBarros/specwright/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ThiagoNascBarros/specwright/releases/tag/v0.1.0
