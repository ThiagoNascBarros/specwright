# Quickstart: Spec Kit format

**Feature**: [spec.md](spec.md)

These are the validation scenarios that prove the feature end to end. Contracts are in [contracts/tools.md](contracts/tools.md).

## Prerequisites

```bash
npm ci
npm run build
```

## Scenario 1 — A Spec Kit project works unchanged (SC-001)

1. Copy `tests/fixtures/speckit/` into a temporary folder and start the server there:
   `SPECWRIGHT_ROOT=<tmp> node dist/index.js`, or use an MCP client.
2. Call `list_features`. **Expect** `001-photo-albums` and `002-sharing`, both `valid: true`, with task progress.
3. Call `get_artifact { feature: "001-photo-albums", artifact: "spec", section: "requirements" }`. **Expect** only the Requirements section, with no template comments.
4. Call `get_artifact { artifact: "constitution" }`. **Expect** the constitution text.

## Scenario 2 — Task progress like `/speckit-implement` (SC-002)

1. Call `list_open_tasks { feature: "001-photo-albums", story: "US1" }`. **Expect** the open US1 tasks, with `parallel` and `phase`.
2. Call `set_task_status { feature: "001-photo-albums", task_id: "T012", done: true }`.
3. Run `git diff --word-diff` on the copied `tasks.md`. **Expect** a single change, `[ ]` → `[X]`, on line `T012`.

## Scenario 3 — Check before "done"

Call `check_against_spec` with a `git diff`. **Expect** every `FR-###` and `SC-###`, the user stories with their scenarios, the open tasks and a per-file summary, with no diff line content.

## Scenario 4 — Memory in `.specify/memory/`

1. Call `log_decision { feature: "001-photo-albums", title: "Store metadata in SQLite", decision: "…", rationale: "…", alternatives: "…" }`. **Expect** `.specify/memory/decisions/0001-store-metadata-in-sqlite.md`.
2. Call `search_memory { query: "test first" }`. **Expect** the constitution's Test-First principle.

## Automated

```bash
npm run typecheck
npm test
npm run test:load
```
