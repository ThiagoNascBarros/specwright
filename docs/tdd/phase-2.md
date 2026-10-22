---
id: TDD-P2
title: Phase 2 — Test-driven development record
status: done
covers: memory, decision-list
---

# Phase 2: project memory — TDD record

Phase 2 delivers `save_memory`, `search_memory` and `list_decisions`. The memory entity lives in `src/memory/`. `list_decisions` belongs to `src/decisions/`, which owns the decision entity (decision 0003).

## RED → GREEN

| Step | Result |
|---|---|
| RED | 5 test files failed and **21 tests failed** (100 passed, 121 total): `src/storage/text.js` was missing, and `save_memory`, `search_memory` and `list_decisions` returned "Tool … not found". The contract test saw 6 tools instead of 9. |
| First GREEN attempt | 124/124 |
| Follow-up | Dogfooding showed raw `## Context` markers in decision snippets. The snippet now turns headings into `Heading:` text, and a test was added with that change (it was not seen failing first). Final: 125/125. |

## Acceptance criteria → tests

### `memory`
| AC | Test |
|---|---|
| AC-1 | `tests/integration/memory.test.ts` › AC-1 (frontmatter, deduplicated tags, body, relative path) |
| AC-2 | › AC-2 (`same-2`; the first file is unchanged) |
| AC-3 | › AC-3 (unknown type, empty title, empty body; nothing written) |
| AC-4 | › AC-4 (`NOT_INITIALIZED`); creation on demand is covered by AC-1 |
| AC-5 | › AC-5 (title > tags > body) |
| AC-6 | › AC-6 (`kind: decision`, `type: decision`) |
| AC-7 | `tests/unit/text.test.ts` › AC-7; integration › AC-7 (both directions) |
| AC-8 | integration › AC-8 (snippet ≤ 200 characters with the match, `limit` 1/51, default 10) |
| AC-9 | unit › AC-9; integration › AC-9 (`INVALID_INPUT`) |
| AC-10 | integration › AC-10 (a new server instance on the same root) |
| AC-11 | `tests/perf/memory.perf.test.ts` |

### `decision-list`
| AC | Test |
|---|---|
| AC-1 to AC-6 | `tests/integration/decision-list.test.ts` › AC-1 … AC-6 |

## Performance (NFR-7)

| Scenario | Budget | Local median | CI median |
|---|---|---|---|
| `search_memory` over 1,000 memories and 200 decisions | 300 ms | 137–162 ms | 167–200 ms |

## Dogfooding

- The project's own conventions were saved with `save_memory`: "One entity per file", "Never write to stdout in the server" and the NFR-3 description budget.
- The searches `stdout logging` and `diff git` (`type: decision`) returned the expected notes first.
- Both specs were closed with `set_criterion_status`.
