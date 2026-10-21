---
id: RM-001
title: Specwright — Roadmap
status: draft
version: 0.2
implements: TRD-001
---

# RM-001 — Roadmap

Delivery order of the development specs. This document **is not** an implementation plan: each spec gets its own plan when it is developed.

## Per-spec cycle

One spec at a time. The next one starts only when the previous one is complete.

| # | Step | Artifact | Superpowers skill | Gate |
|---|---|---|---|---|
| 1 | Write the spec | `.specwright/specs/<id>.md` (format from [TRD §6.1](02-trd.md)) | `brainstorming` | you approve the spec |
| 2 | Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<id>.md` | `writing-plans` | you approve the plan and choose the execution mode |
| 3 | Implement | code + tests, on a branch | `test-driven-development`, plus `subagent-driven-development` or `executing-plans` | each `AC-n` has a test that failed before passing |
| 4 | Verify | output of `npm test` and `npm run typecheck` | `verification-before-completion` | whole suite green, with evidence |
| 5 | Close | criteria checked, decisions recorded, merge | `finishing-a-development-branch` | spec with `status: done` |

**Definition of done for a spec**
1. All `AC-n` are covered by a test that cites the id and was seen failing before the implementation.
2. `npm test` (the whole suite) and `npm run typecheck` are green, and the output is attached to the closing.
3. The criteria are checked off in the spec. From spec 3 onward this is done with `set_criterion_status`; in specs 1 and 2, by hand.
4. Relevant decisions are recorded. From spec 4 onward this is done with `log_decision`; before that, as an ADR in `docs/adr/`.
5. The smoke dogfooding was run (TRD §10), from spec 2 onward.
6. The branch's CI is green.

## Phase 1: spec core

Spec 1 is the foundation: repository, structure, build, CI and a server that starts with no tools. From spec 2 onward, each spec is a vertical slice: when finished, the server has new tools usable by an agent.

| # | Spec id | Delivery | Requirements | Status |
|---|---|---|---|---|
| 1 | `project-foundation` | GitHub repository, folder structure from TRD §3, `package.json`, `tsconfig`, CI, stdio server with no tools and contract test | NFR-9, NFR-10 | [x] |
| 2 | `spec-reading` | `config.ts`, `errors.ts`, `storage/paths` and `storage/markdown`, spec parser, and the tools `list_specs` and `get_spec` | FR-1, FR-2, FR-3, NFR-3, NFR-4, NFR-6, NFR-7, NFR-8 | [x] |
| 3 | `acceptance-criteria` | `storage/files` (atomic write, minimal edit), `list_open_requirements` and `set_criterion_status` | FR-4, FR-6, NFR-5 | [x] |
| 4 | `decision-log` | Exclusive file creation and `log_decision` | FR-7 | [x] |
| 5 | `check-task` | Diff parser and `check_task_against_spec`; decide TRD Q1 | FR-5 | [x] |

**Phase 1 done when:** the 5 specs have `status: done`, plus one complete cycle run on the repository itself (PRD §7, Phase 1) and the installation README.

## Phase 2: project memory

| Spec id | Delivery | Requirements |
|---|---|---|
| `memory` | `save_memory` and `search_memory` (over memories and decisions) | FR-8, FR-9 |
| `decision-list` | `list_decisions` | FR-10 |

Ends when the Phase 2 success metric (PRD §7) is demonstrated.

## Phase 3: Context Packer

| Spec id | Delivery | Requirements |
|---|---|---|
| `context-pack` | Token budget and `pack_context` | FR-11 |

Before starting, decide PRD Q1 (tokenizer).

## Documentation milestones
- [x] PRD-001 (v0.2)
- [x] TRD-001 (v0.2)
- [x] ADR-0001 to ADR-0005
- [x] RM-001 (v0.2)
- [x] Spec 1 `project-foundation`
