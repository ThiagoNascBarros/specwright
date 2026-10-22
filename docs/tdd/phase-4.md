---
id: TDD-P4
title: Phase 4 — Test-driven development record (Spec Kit format)
status: done
covers: 009-speckit-format
---

# Phase 4: Spec Kit format — TDD record

Feature [`specs/009-speckit-format`](../../specs/009-speckit-format/spec.md) was implemented test-first, in the task-group order of its [`tasks.md`](../../specs/009-speckit-format/tasks.md).

The fixture `tests/fixtures/speckit/` is a small Spec Kit project written in the official v1.2.x template shapes. It keeps the template's HTML comments, a `## Requirements *(mandatory)*` heading, a "Parallel Example" code fence with a task-like line, a `TXXX` placeholder and the `🎯 MVP` phase suffix. Those quirks are what SC-001 ("works unchanged") needs.

## RED → GREEN per task group

| Group | RED (before implementation) | GREEN |
|---|---|---|
| Foundational (T004–T018) | **15 failed**: `src/features/*.js` missing, config still read `SPECWRIGHT_DIR`, and the path guard still allowed `src/secret.ts` | `tests/unit` 86/86. One test was wrong and was fixed: `2026-10-21-x` *is* a valid sequential id (number 2026 + short name). |
| US1 (T019–T024) | **23 failed**: `Tool list_features not found`, `Tool get_artifact not found` | 108/108 (unit + US1 integration), typecheck clean |
| US2 (T025–T029) | **7 failed**: `task-editor.js` missing, tools not found | 13/13 |
| US3 (T030–T032) | **5 failed**: `Tool check_against_spec not found` | 14/14 (with the moved diff tests) |
| US4 (T033–T036) | **19 failed**: old paths, `spec_id` field, no constitution search | 26/26 |
| US5 (T037–T038) | **6 failed**: no plan or task candidates, no bare-path extraction | 10/10 |
| US6 (T039–T042) | The dogfood test was written after the migration (see Deviations) | 2/2 |
| Polish (T043–T045) | The stdio workflow failed: `tests/load/stdio-client.ts` still passed `SPECWRIGHT_DIR`, so the child server read the wrong root. Fixed in the helper. | `npm test` **168/168**, `npm run test:load` **9/9** |

## Requirement / scenario → tests

| Id | Tests |
|---|---|
| FR-001 | `tests/unit/config.test.ts`, `tests/unit/paths.test.ts` (allowlist, traversal, symlink into `src/`) |
| FR-002 | `tests/unit/feature.test.ts` (ids), `tests/integration/features.test.ts` (timestamp ids, ignored folders) |
| FR-003 | `tests/unit/spec-parser.test.ts` (title, metadata, stories, FR/SC, edge cases, assumptions, clarifications, CRLF/BOM, fences) |
| FR-004 | `tests/unit/tasks-parser.test.ts` (labels, phases, fences, comments, frontmatter, `T001` ≠ `T0010`) |
| FR-005, US1-AS1, SC-001 | `tests/integration/features.test.ts` |
| FR-006, US1-AS2 to AS4 | `tests/integration/artifacts.test.ts` |
| FR-007, US2-AS1 | `tests/integration/tasks.test.ts` › list_open_tasks |
| FR-008, US2-AS2, US2-AS3, SC-002 | `tests/unit/task-editor.test.ts`, `tests/integration/tasks.test.ts` › set_task_status |
| FR-009, US3-AS1, US3-AS2 | `tests/integration/check-against-spec.test.ts` |
| FR-010, US4-AS1 | `tests/integration/decision-log.test.ts`, `decision-list.test.ts` (including legacy decisions) |
| FR-011, US4-AS2 | `tests/integration/memory.test.ts` › constitution in search_memory |
| FR-012, US5-AS1 | `tests/integration/context-pack.test.ts`, `tests/unit/context.test.ts` (bare paths) |
| FR-013, SC-004 | `tests/contract/server.test.ts` (exactly 10 tools, ≤ 12,000 chars, ≤ 2 sentences) |
| FR-014, FR-015 | `tests/integration/repository-dogfood.test.ts`, `tests/unit/feature.test.ts` |
| SC-003 | `tests/perf/features.perf.test.ts` |
| SC-005, US6-AS1 | `tests/integration/repository-dogfood.test.ts` |
| End to end | `tests/contract/workflow.test.ts`: all 10 tools over stdio, with a second process recovering the state |

## Performance and load (local)

| Scenario | Budget | Result |
|---|---|---|
| `list_features`, 500 features | < 500 ms | 170 ms |
| `list_open_tasks`, 500 features / 2,500 open tasks | < 500 ms | 163 ms |
| `get_artifact` section | < 200 ms | 0.5 ms |
| `search_memory`, 1,000 notes + 200 decisions | < 300 ms | 183 ms |
| `pack_context`, 500 features + 1,000 notes | < 1 s | 365 ms |
| 2,000 sequential stdio calls (100 features, 200 notes) | p95 < 50 ms | p95 35.6 ms, p99 41.2 ms |
| 500 concurrent reads | all succeed | all succeed (p50 8.6 s: the burst is queued, as in v0.1.0) |
| 200 concurrent writes | unique files | 644 ms, 100 + 100 unique |
| 2 processes × 20 decisions | no duplicates | 40 created, 40 files, 0 errors |
| 1,000 `set_task_status` calls in waves | valid `tasks.md`, no temp files | ✅ |
| Scale: 2,000 features + 5,000 notes | < 2 s (`pack_context` < 3 s) | `list_features` 603 ms, `list_open_tasks` 594 ms, `search_memory` 749 ms, `pack_context` 1,465 ms, `get_artifact` 2 ms |

Compared with v0.1.0, `list_features` is about 2× slower than `list_specs` was. Each feature reads two files (`spec.md` and `tasks.md`) and checks eight artifacts, but every budget still holds.

## Deviations from strict TDD

These are recorded honestly:
- `tests/integration/repository-dogfood.test.ts` was written after the repository was migrated, so it passed on its first run. Before the migration it would have failed: there was no `specs/`, and `.specwright/` still existed.
- `tests/unit/respond.test.ts`: the linear-time budget was raised from 200 ms to 1 s after it flaked at 255 ms under the parallel suite. 1 s still catches the old 27 s quadratic path.
