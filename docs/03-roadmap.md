---
id: RM-001
title: Specwright — Roadmap
status: accepted
version: 1.0
implements: TRD-001
---

# RM-001 — Roadmap

This document sets the delivery order of the development specs. It is not an implementation plan.

## Per-spec cycle

Specs are worked one at a time, and the next one starts only when the previous one is complete.

| # | Step | Artifact | Superpowers skill | Gate |
|---|---|---|---|---|
| 1 | Write the spec | `.specwright/specs/<id>.md` (format in [TRD §6.1](02-trd.md)) | `brainstorming` | the spec is approved |
| 2 | Plan | `docs/superpowers/plans/YYYY-MM-DD-<id>.md`, or the phase's TDD record | `writing-plans` | the plan is approved |
| 3 | Implement | code and tests, on a branch | `test-driven-development` | each `AC-n` has a test that failed before passing |
| 4 | Verify | output of `npm test`, `npm run typecheck` and `npm run test:load` | `verification-before-completion` | everything is green, with evidence |
| 5 | Close | criteria checked, decisions recorded, PR merged | `finishing-a-development-branch` | the spec has `status: done` |

**Definition of done for a spec**
1. Every `AC-n` is covered by a test that cites its id and was seen failing before the implementation.
2. `npm test`, `npm run typecheck` and `npm run test:load` are green.
3. The criteria are checked off. From spec 3 on, this is done with `set_criterion_status` itself.
4. Relevant decisions are recorded. From spec 4 on, this is done with `log_decision` itself; before that, as ADRs.
5. Smoke dogfooding was run against this repository, from spec 2 on.
6. CI is green on the PR.

**Process note.** Spec 1 had its own written plan, in [`superpowers/plans/`](superpowers/plans/). The owner then asked for the rest of the project to be finished in one go. From spec 2 on, each phase was implemented test-first, and its record is in [`tdd/`](tdd/) instead of one written plan per spec: the RED evidence, the AC → test map, and the performance and load results.

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

## Next (not scheduled)

These items would each need a spec. Each one stays out until real use asks for it:
- publishing to npm (and dropping `private: true`);
- versioning of `config.json` and of the spec format (PRD Q3);
- a cache for very large projects, only if NFR-7 fails in practice (ADR-0004);
- a `base_ref` option for `check_task_against_spec`, only if passing the diff proves too costly (decision 0005).

## Documentation milestones
- [x] PRD-001 v1.0
- [x] TRD-001 v1.0
- [x] ADR-0001 to ADR-0005, and decisions 0001–0010 in `.specwright/decisions/`
- [x] RM-001 v1.0
- [x] TDD records for phases 1, 2 and 3
- [x] Open-source repository files (README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, templates)
