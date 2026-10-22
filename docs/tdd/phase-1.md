---
id: TDD-P1
title: Phase 1 — Test-driven development record
status: done
covers: project-foundation, spec-reading, acceptance-criteria, decision-log, check-task
---

# Phase 1: spec core — TDD record

Phase 1 delivers 6 tools: `list_specs`, `get_spec`, `list_open_requirements`, `set_criterion_status`, `log_decision` and `check_task_against_spec`. This record lists, for each spec:
- the failing run seen before any implementation (RED);
- the first green run (GREEN) and what had to change to reach it;
- where each acceptance criterion is tested.

## Test levels

| Level | Location | Runs | Notes |
|---|---|---|---|
| Unit | `tests/unit/` | `npm test` | Pure functions: path guard, Markdown, parser, editor, diff, slug |
| Integration | `tests/integration/` | `npm test` | Each tool, called through an in-process MCP client (`InMemoryTransport`) against a temporary project built by `tests/helpers.ts` |
| Contract | `tests/contract/` | `npm test` | The built `dist/index.js` over stdio |
| Performance | `tests/perf/` | `npm run test:load` | Serial, with a 2× budget when `CI` is set |

## RED → GREEN per spec

| Spec | RED (before implementation) | First GREEN attempt | Final |
|---|---|---|---|
| `project-foundation` | `tsc`: "No inputs were found" (no `src/`) | 3/3 | 3/3 |
| `spec-reading` | 6 test files failed: modules missing, and the contract saw `[]` tools instead of `get_spec, list_specs` (2 failed, 2 passed) | 56/57. AC-13 failed: the `get_spec` description had 3 "sentences" because "e.g." counts as a sentence end. Rewritten. | 57/57 |
| `acceptance-criteria` | 10 tests failed: `src/specs/editor.js` missing, tools not registered | 74/74 (a type error in a test was fixed for `tsc -p tests`) | 74/74 |
| `decision-log` | 9 failed, 73 passed: `src/storage/slug.js` missing, `Tool log_decision not found` | 85/85 | 86/86. Dogfooding showed a slug cut mid-word (`…numberi`), so a word-boundary rule and its test were added. |
| `check-task` | 7 failed, 85 passed: `src/specs/diff.js` missing, `Tool check_task_against_spec not found` | 100/101. AC-6 failed: plain `diff -u` from `old/` to `new/` was reported as `renamed`. Rule: only `git` headers imply a rename (decision 0006). | 101/101 |

## Acceptance criteria → tests

### `project-foundation`
| AC | Test |
|---|---|
| AC-1 | Repository created on GitHub (manual, before the spec) |
| AC-2, AC-3 | `npm ci && npm run build`, `npm run typecheck` in CI |
| AC-4 | `tests/contract/server.test.ts` › project-foundation AC-4 |
| AC-5 | Replaced by spec-reading AC-13 once tools existed (noted in that spec) |
| AC-6, AC-7 | Structure and dependency check in the plan's verification step |
| AC-8, AC-9 | CI on PR #1, merged after green |

### `spec-reading`
| AC | Test |
|---|---|
| AC-1 | `tests/unit/config.test.ts` (4 cases) |
| AC-2 | `tests/unit/paths.test.ts` › ensureRoot; `tests/integration/spec-reading.test.ts` › AC-2 |
| AC-3 | `tests/unit/paths.test.ts` › `../`, absolute, symlink, backslash |
| AC-4 | `tests/unit/markdown.test.ts` › AC-4 (sections; LF = CRLF = BOM) |
| AC-5 | `tests/unit/spec-parser.test.ts` › AC-5 (7 invalid cases plus one issue per problem); integration › AC-5 |
| AC-6, AC-7 | integration › AC-6 (sorted, counts, `AC-1` ≠ `AC-10`, no criteria = `{0,0}`), AC-7 (status filter) |
| AC-8, AC-9, AC-10 | integration › AC-8, AC-9 (key, heading, alias), AC-10 |
| AC-11 | integration › AC-11 (`../etc`, `Foo`, `a/b`, `/abs`) |
| AC-12 | integration › AC-12 (content and listings) |
| AC-13 | `tests/contract/server.test.ts` › exactly the expected tools, ≤ 12,000 chars, ≤ 2 sentences each |
| AC-14 | `tests/perf/spec-reading.perf.test.ts` |
| AC-15 | Manual smoke test: `list_specs` and `get_spec` over stdio against this repository |

### `acceptance-criteria`
| AC | Test |
|---|---|
| AC-1, AC-2 | `tests/integration/acceptance-criteria.test.ts` › AC-1, AC-2 |
| AC-3 | `tests/unit/editor.test.ts` › exactly one byte changes; integration › AC-3/AC-10 |
| AC-4, AC-5 | editor and integration › AC-4, AC-5 (mtime unchanged) |
| AC-6 | editor › CRLF and BOM byte for byte |
| AC-7 | editor › `AC-1` ≠ `AC-10`; fences and other sections untouched |
| AC-8 | editor › unknown id; integration › AC-8 (file unchanged) |
| AC-9 | `tests/unit/files.test.ts` › no temp file after success and after a failed rename |
| AC-10 | integration › AC-3/AC-10 |

### `decision-log`
| AC | Test |
|---|---|
| AC-1, AC-9 | `tests/integration/decision-log.test.ts` › AC-1/AC-9 |
| AC-2, AC-3 | integration › AC-2 (gaps, foreign files), AC-3 |
| AC-4 | `tests/unit/slug.test.ts`; integration › AC-4 (fallback) |
| AC-5, AC-6, AC-8 | integration › AC-5, AC-6 (YAML-sensitive title), AC-8 |
| AC-7 | integration › 10 parallel calls; load › two processes (Phase 3) |

### `check-task`
| AC | Test |
|---|---|
| AC-1 to AC-6 | `tests/unit/diff.test.ts` (modified, new/deleted, renames, binary, `---` inside a hunk, `diff -u`, CRLF) |
| AC-7, AC-8, AC-9 | `tests/integration/check-task.test.ts` |

## Deviations from strict TDD

These are recorded honestly:
- **`spec-reading` AC-14 (performance).** This test was written after the implementation, so it was never seen failing. It measures a budget rather than a behavior. The later performance tests in Phases 2 and 3 were written first.
- **The word-boundary slug test** (`decision-log`) was written together with its fix, after dogfooding exposed the problem.
- **`project-foundation` AC-6/AC-7** are structural and were checked by commands rather than by tests.

## Dogfooding

- From spec 3 on, the criteria of each spec were checked off with `set_criterion_status` running against this repository.
- Decisions 0001–0006 were written with `log_decision`.
- For `check-task`, the tool summarized the real 7-file, 353-line diff of that spec exactly like `git diff --numstat`.

## How to reproduce

```bash
npm ci
npm run typecheck
npm test
npm run test:load
```
