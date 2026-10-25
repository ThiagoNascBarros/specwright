---
id: RM-001
title: Specwright — Roadmap
status: accepted
version: 1.1
implements: TRD-001
---

# RM-001 — Roadmap

This document sets the delivery order of the development specs. It is not an implementation plan.

## Per-feature cycle (Spec Kit)

Since v0.2.0, every change is a Spec Kit feature in `specs/NNN-name/`, worked one at a time.

| # | Step | Artifact | How | Gate |
|---|---|---|---|---|
| 1 | Specify | `spec.md` + `checklists/requirements.md` | `/speckit-specify` (and `/speckit-clarify`) | the spec is approved |
| 2 | Plan | `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` | `/speckit-plan` | the plan is approved |
| 3 | Tasks | `tasks.md` | `/speckit-tasks` | the tasks are approved |
| 4 | Implement | code + tests on `feature/SW-<n>-…` | test-first; mark tasks with `set_task_status` | each `FR-###` and scenario has a test that failed before passing |
| 5 | Verify | `npm run typecheck`, `npm test`, `npm run test:load` | `check_against_spec` with the branch diff | everything green, with evidence |
| 6 | Close | `**Status**: Implemented`, decisions recorded, PR merged | `log_decision`, PR `[SW-<n>] …` | CI green |

**Definition of done for a feature**
1. Every `FR-###` and acceptance scenario is covered by a test that cites its id and was seen failing first.
2. `npm run typecheck`, `npm test` and `npm run test:load` are green, locally and in CI.
3. Every task in `tasks.md` is `[X]`, marked with `set_task_status`.
4. Non-obvious decisions are recorded with `log_decision`.

**Process note (v0.1.0).** Spec 1 had its own written plan, in [`superpowers/plans/`](superpowers/plans/). The owner then asked for the rest of the project to be finished in one go. From spec 2 on, each phase was implemented test-first, and its record is in [`tdd/`](tdd/) instead of one written plan per spec: the RED evidence, the AC → test map, and the performance and load results.

## Phase 1: spec core — done

| # | Spec id | Delivery | Requirements | Status |
|---|---|---|---|---|
| 1 | `project-foundation` | Repository, folder layout, build, CI, stdio server, contract test | NFR-9, NFR-10 | [x] |
| 2 | `spec-reading` | Config, errors, path guard, Markdown parser, `list_specs`, `get_spec` | FR-1–FR-3, NFR-3, NFR-4, NFR-6–NFR-8 | [x] |
| 3 | `acceptance-criteria` | Atomic write, minimal edit, `list_open_requirements`, `set_criterion_status` | FR-4, FR-6, NFR-5 | [x] |
| 4 | `decision-log` | `decisions` module and `log_decision` | FR-7 | [x] |
| 5 | `check-task` | Diff parser and `check_task_against_spec`; TRD Q1 decided | FR-5 | [x] |

Test record: [tdd/phase-1.md](tdd/phase-1.md).

## Phase 2: project memory — done

| Spec id | Delivery | Requirements | Status |
|---|---|---|---|
| `memory` | `save_memory` and `search_memory` (over memories and decisions) | FR-8, FR-9 | [x] |
| `decision-list` | `list_decisions` | FR-10 | [x] |

Test record: [tdd/phase-2.md](tdd/phase-2.md).

## Phase 3: context packer — done

| Spec id | Delivery | Requirements | Status |
|---|---|---|---|
| `context-pack` | Token budget and `pack_context`; PRD Q1 decided | FR-11, NFR-2 | [x] |

Phase 3 also added the stdio load suite, which found and fixed two defects (decisions 0009 and 0010). Test record: [tdd/phase-3.md](tdd/phase-3.md).

## Phase 4: Spec Kit format — done

| Feature | Delivery | Requirements | Status |
|---|---|---|---|
| `009-speckit-format` | Spec Kit layout and vocabulary, renamed tools, `.specify/memory/`, constitution, repository migrated | FR-1–FR-11 (renamed), NFR-6 | [x] |

Phases 1–3 above keep their v0.1.0 names; their specs now live in `specs/001-…` to `specs/008-…`. Test record: [tdd/phase-4.md](tdd/phase-4.md).

## Phase 5: Second brain — done

| Feature | Delivery | Requirements | Status |
|---|---|---|---|
| `010-second-brain` | Knowledge graph over specs, decisions, notes and included docs; 8 tools, CLI, exports | FR-012–FR-030, NFR-6, NFR-7 | [x] |

## Next (not scheduled)

These items would each need a spec. Each one stays out until real use asks for it:
- publishing to npm (and dropping `private: true`);
- versioning of `config.json` and of the spec format (PRD Q3);
- reading `.specify/feature.json` to default the active feature;
- a `base_ref` option for `check_against_spec`, only if passing the diff proves too costly (decision 0005).

## Documentation milestones
- [x] PRD-001 v1.0
- [x] TRD-001 v1.0
- [x] ADR-0001 to ADR-0005, and decisions 0001–0010 in `.specify/memory/decisions/`
- [x] RM-001 v1.0
- [x] TDD records for phases 1, 2, 3 and 4
- [x] Constitution (`.specify/memory/constitution.md`)
- [x] Open-source repository files (README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, templates)
