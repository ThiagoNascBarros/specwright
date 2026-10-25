---
id: TDD-P5
title: Phase 5 — Test-driven development record (second brain)
status: partial
covers: 010-second-brain
---

# Phase 5: Second brain — TDD record

Feature [`specs/010-second-brain`](../../specs/010-second-brain/spec.md) was implemented test-first, in the order of its [`tasks.md`](../../specs/010-second-brain/tasks.md), from Task 23 (analysis) to Task 34 (docs). Tasks 1–22 are recorded in the reports of the SDD ledger (`.superpowers/sdd/tasks/`).

## RED → GREEN per task

| Task | RED (before implementation) | GREEN |
|---|---|---|
| 23 analysis (`analyze.ts`) | module missing, then 5 assertion failures against a stub | 5/5 |
| 24 `graph_report` | 3/3 failed: tool not registered | 3/3 |
| 25 `lint_memory` (`lint.ts`) | unit module missing; 4 integration tests failed (tool not registered) | 10/10 |
| 26 performance (`graph.perf.test.ts`) | budgets run against the implemented tools | 4/4 perf, 15/15 load |
| 27 `graph.include` | 3/4 failed (include not discovered) | 4/4 |
| 28 renderers (mermaid, JSON, report, vault) | modules missing | 8/8 |
| 29 `export_graph` | 4/4 failed (tool not registered); one manifest bug found and fixed | 9/9 |
| 30 `graph` CLI | unit module missing; contract tests timed out (argv started the server) | 2/2 unit, 3/3 contract |
| 31 instructions and annotations | 2/3 failed (no instructions, no annotations) | 412 total |
| 32 `pack_context` graph boost | unit module missing; `graph: true` test failed | 1/1 unit, 2/2 integration |
| 33 workflow and dogfood | passed against the existing tools; two fixes (see below) | 2/2 workflow, 4/4 dogfood |

Last verification (2026-10-24): `npm run typecheck` clean; `npm test` 69 files, **419 passed**; `npm run test:load` 6 files, **15 passed**.

## Performance (SC-003, local run)

| Measure | Result | Budget |
|---|---|---|
| Cold build, 500 features + 1,000 notes (cache off), `query_graph` | ~1.05–1.1 s | < 1.5 s |
| Warm `query_graph` / `get_node` / `find_path` (median of 5) | ~120–140 ms each | < 200 ms |
| First `query_graph` with a snapshot | ~380–420 ms | < 600 ms |
| First `graph_report` | ~1.28–1.30 s (1.56 s once under load, before the Louvain buffer change) | < 1.5 s |
| Repeated `graph_report` | ~230–250 ms | < 300 ms |
| Load: 2,000 features + 5,000 notes, cold | ~3.9 s | < 6 s |

The first `graph_report` is close to its budget: about 1.0 s of it is parsing the files. Louvain local moves now reuse buffers (`perf(graph)` commit).

## Requirement and scenario → tests

| Id | Tests |
|---|---|
| FR-017, FR-018 | `tests/unit/graph-analyze.test.ts`, `tests/integration/graph-report.test.ts` |
| FR-019 | `tests/unit/graph-lint.test.ts`, `tests/integration/graph-lint.test.ts` |
| FR-020, FR-021 | `tests/unit/graph-mermaid.test.ts`, `tests/unit/graph-export.test.ts`, `tests/integration/graph-export.test.ts` |
| FR-022 | `tests/unit/cli-args.test.ts`, `tests/contract/graph-cli.test.ts` |
| FR-023, FR-025, FR-029 | `tests/contract/server.test.ts` (instructions, 18 tools, annotations, sentence budget) |
| FR-024 | `tests/unit/context-graph-boost.test.ts`, `tests/integration/context-pack.test.ts` |
| FR-026 | `tests/contract/graph-workflow.test.ts` (byte-identical across two processes) |
| US1–US2 | `tests/integration/graph-node.test.ts`, `graph-query.test.ts`, `graph-path.test.ts`, `graph-extraction.test.ts` (from Tasks 1–22) |
| US3-AS1..AS3 | `graph-report.test.ts` |
| US4-AS1..AS3 | `graph-lint.test.ts` |
| US5 / SC-003 | `tests/perf/graph.perf.test.ts`, `tests/load/graph.load.test.ts` |
| US6-AS1..AS3, Review Focus 4 | `tests/integration/graph-include.test.ts` |
| US7-AS1..AS4 | `graph-cli.test.ts`, `graph-export.test.ts` |
| US8-AS1, US8-AS2 | `server.test.ts`, `context-pack.test.ts` |
| SC-004 | `tests/contract/graph-workflow.test.ts` |
| SC-007 | `tests/integration/repository-dogfood.test.ts` (0 `broken_link` on the repository copy) |
| SC-001 | `tests/integration/repository-dogfood.test.ts`: **3 of the 5 questions planned** (see open items) |
| SC-005, SC-006 | `repository-dogfood.test.ts` (list_features), `tests/unit/graph-analyze.test.ts` |

## Deviations and open items

- **SC-001 (partial).** `query_graph` at `budget_tokens: 1500` returns about 1,490 tokens for most questions, so "3 times cheaper than the files that hold the nodes" holds only when the expected nodes sit in large files. Three questions pass (token estimate budget 5.1×, spec kit format vocabulary 4.6×, linear response truncation 3.1×). The other candidates were below 3× (lock decision numbering ~2.8×, context pack budget ~2.5×). Two are still missing.
- **Fixed in the course of T067.** `docs/02-trd.md` linked `../SECURITY.md`, which lies outside the graph's read areas, so `lint_memory` reported it broken. The link is now plain text.
- **Governance (Task 34).** The constitution is amended to 2.0.0. PRD v1.2 (FR-12..FR-19, NFR-3/6/7, §7, §8, §10, §12) and TRD v2.1 (§1–§3, §5, §6.7–§6.8, §7–§10, §13, §14) were updated on 2026-10-25.
- **SC-001 and the TRD.** The "token estimate budget" question reaches `artifact:009-speckit-format/research` only through `docs/02-trd.md`. The TRD's degree must stay below the hub threshold of 50, or `query_graph` stops expanding it and the dogfood test fails. It is at 49 after v2.1, so new backticked paths in the TRD can break SC-001.
- **Spec status.** `specs/010-second-brain/spec.md` stays `Draft` until SC-001 and the open governance sections are closed.
- **Decisions.** The `log_decision` records (T076) and the `check_against_spec` run (T075) were not executed in this pass.
- **Known issue (outside this feature).** `respond()` trims the first array field to zero for a spec as large as this one; `respond()` is unchanged, as the plan requires.
