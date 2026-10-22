---
id: TDD-P3
title: Phase 3 — Test-driven development record (context packer and load)
status: done
covers: context-pack, load suite
---

# Phase 3: context packer and load — TDD record

Phase 3 delivers `pack_context`, the tenth and last tool. It also adds the end-to-end workflow test and the stdio load suite. The load suite found two defects, and both were fixed test-first.

## RED → GREEN

| Step | Result |
|---|---|
| RED | 4 test files failed and **9 tests failed** (124 passed, 133 total): `src/context/estimate.js` was missing and `Tool pack_context not found`. The contract test saw 9 tools instead of 10. |
| First GREEN attempt | 136/136 |
| End-to-end workflow test | The first run failed. The test itself was wrong: it searched `lockout`, but the decision's title says "Lock". The search matches exact terms, so the query became `account lockout`. |

## Acceptance criteria → tests (`context-pack`)

| AC | Test |
|---|---|
| AC-1, AC-5 | `tests/integration/context-pack.test.ts` › AC-1/AC-5 |
| AC-2, AC-3 | `tests/unit/context.test.ts` › AC-2, AC-3; integration › AC-2/AC-3 |
| AC-4 | integration › AC-4 (acceptance criteria pinned first) |
| AC-6 | unit › AC-6; integration › AC-6 |
| AC-7, AC-8, AC-9 | integration › AC-7, AC-8, AC-9 (budget capped, response never truncated) |
| AC-10 | `tests/perf/context.perf.test.ts` |
| AC-11 | `tests/contract/server.test.ts` (exactly 10 tools, ≤ 12,000 characters) |

## End-to-end workflow (all 10 tools)

`tests/contract/workflow.test.ts` starts the built server over stdio, the way an MCP client does, and runs one agent session:

`list_specs` → `list_open_requirements` → `get_spec` (section) → `check_task_against_spec` → `set_criterion_status` → `log_decision` → `save_memory`

It then starts a **second server process** on the same root and runs `list_open_requirements`, `list_decisions`, `search_memory` and `pack_context`.

## Load suite (`tests/load/stdio.load.test.ts`)

Every scenario runs against the real `dist/index.js` child process over stdio.

### Defects found (RED)

| Scenario | Failure | Root cause | Fix |
|---|---|---|---|
| Two server processes, 40 decisions | `expected 28 to be 40`: duplicate decision numbers | `wx` protects the full file name, but each title gives a different slug, so `0001-a.md` and `0001-b.md` could both be created | `decisions/.lock`, a `mkdir`-based cross-process lock that is broken when stale; regression tests in `tests/unit/lock.test.ts` (decision 0009) |
| `list_open_requirements` over 2,000 specs | **33,315 ms** (budget 2,000 ms) | `respond()` re-serialized the whole response for every item it dropped: O(n²) | Linear truncation; regression test in `tests/unit/respond.test.ts`, which failed at 27,557 ms before the fix (decision 0010) |
| Parallel runs of the timing tests | `search_memory` perf failed beside the parallel default suite | Contention, not the code: alone it took 154 ms | Timing suites moved to `npm run test:load` and run serially; CI runs them on both Node versions |

Bounded reads were added together with these fixes. `mapLimit` caps every listing at 32 open files, to avoid `EMFILE` on systems with a low `ulimit`. It has its own unit test.

### Results after the fixes

| Scenario | Local | CI (Node 22 / 24) |
|---|---|---|
| 2,000 sequential mixed reads (100 specs, 200 memories) | p50 5.1 ms, p95 24.7 ms, p99 26.9 ms; 126 calls/s | p95 28.6 / 36.7 ms |
| 500 concurrent reads in flight | all succeeded; p50 2.7 s, p95 6.6 s | all succeeded; p50 8.8 / 9.5 s |
| 200 concurrent writes (100 decisions + 100 memories) | 485 ms wall; 100 unique ids | 676 / 811 ms |
| 2 processes × 20 decisions on one root | 40 created, 40 files, 0 errors | same |
| 1,000 `set_criterion_status` calls in waves of 50 | spec stays valid with 10 criteria, no stray temp files | same |
| Scale, 2,000 specs + 5,000 memories + 500 decisions: `list_specs` | 217 ms | 275 / 332 ms |
| Scale: `list_open_requirements` | 188 ms (33 s before the fix) | 221 / 283 ms |
| Scale: `search_memory` | 540 ms | 599 / 766 ms |
| Scale: `pack_context` | 751 ms | 883 / 1,035 ms |
| Scale: `get_spec` | 1 ms | 1 ms |

**Known limit.** A burst of 500 simultaneous calls is queued. Each call rereads its files, because there is no cache (ADR-0004), so latency grows with the burst, but every call succeeds. Agents call tools one at a time, so this is accepted. A cache would need a spec, and only if NFR-7 fails in real use.

## Deviations from strict TDD

These are recorded honestly:
- The `mapLimit` test and the snippet-heading test (Phase 2) were written together with their code. They guard a refactor and a cosmetic change, and were not seen failing first.
- The load scenarios were written after the tools existed. They are acceptance tests for NFRs, not drivers of the design. Each of the two defects they found got a unit regression test, and that test was seen failing first.
