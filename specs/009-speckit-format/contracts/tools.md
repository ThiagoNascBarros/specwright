# Contract: MCP tools (v0.2.0)

**Feature**: [spec.md](../spec.md)

Conventions (unchanged from v0.1.0):
- Input is validated by zod before the tool runs.
- Output is compact JSON in one text block. A listing is an object with one array field and an optional `truncated: true`.
- Errors come back as `isError: true` with `{ code, message, hint? }`.
- Each description has at most 2 sentences.

Shared patterns:
- `feature`: `^(\d{3,}|\d{8}-\d{6})-[a-z0-9][a-z0-9-]*$`
- `task_id`: `^T\d{3,}$`
- `story`: `^US\d+$`
- `name` (checklist or contract file without `.md`): `^[a-z0-9][a-z0-9._-]*$`

## `list_features`
- **In**: `{ status?: string }`, which matches the `**Status**` value case-insensitively.
- **Out**: `{ features: [{ id, title, status, valid, issues?, artifacts: string[], tasks: { done, total }, open_clarifications: number }] }`, sorted by id.

## `get_artifact`
- **In**: `{ artifact: "spec" | "plan" | "tasks" | "research" | "data-model" | "quickstart" | "checklist" | "contract" | "constitution", feature?, name?, section? }`
  - `feature` is required unless `artifact` is `constitution`.
  - `name` is required for `checklist` and `contract`.
- **Out**: `{ artifact, feature?, name?, section?, content, truncated? }`. The `content` has HTML comments stripped.
- **Errors**:
  - `FEATURE_NOT_FOUND`;
  - `ARTIFACT_NOT_FOUND`, with a hint listing the available artifacts or names;
  - `SECTION_NOT_FOUND`, with a hint listing the section keys;
  - `INVALID_INPUT`, when `feature` or `name` is missing.

## `list_open_tasks`
- **In**: `{ feature?, story? }`
- **Out**: `{ open: [{ feature, id, parallel, story?, phase, text }] }`, ordered by feature and then by file order. Invalid features are skipped. An explicit invalid `feature` gives `INVALID_FEATURE`.

## `set_task_status`
- **In**: `{ feature, task_id, done: boolean }`
- **Out**: `{ feature, task_id, done, changed, tasks: { done, total } }`
- **Behavior**: it edits one character of `specs/<feature>/tasks.md` (`[X]` or ` `) through an atomic write. When nothing changes, nothing is written.
- **Errors**: `FEATURE_NOT_FOUND`, `INVALID_FEATURE`, `ARTIFACT_NOT_FOUND` (no `tasks.md`), `TASK_NOT_FOUND`.

## `check_against_spec`
- **In**: `{ feature, diff }`, where the diff is at most 5,000,000 characters.
- **Out**:
  ```
  { feature, title, status,
    requirements: [{ id, text }], success_criteria: [{ id, text }],
    user_stories: [{ number, title, priority, scenarios: string[] }],
    edge_cases: string[], assumptions: string[], open_clarifications: string[],
    tasks: { open: [{ id, story?, text }], done: number, total: number },
    diff_summary: { files: [{ path, old_path?, status, added, removed, hunks, binary? }], totals } }
  ```
- **Errors**: `FEATURE_NOT_FOUND`, `INVALID_FEATURE`, `INVALID_DIFF`.

## `log_decision`
- **In**: `{ feature, title, decision, rationale?, alternatives? }`
- **Out**: `{ id, path }`, where `path` is relative to the project root, for example `.specify/memory/decisions/0003-store-metadata-in-sqlite.md`.
- **Errors**: `FEATURE_NOT_FOUND`.

## `list_decisions`
- **In**: `{ feature?, from?, to? }`, with dates as `YYYY-MM-DD`, inclusive.
- **Out**: `{ decisions: [{ id, feature, title, date, status, path }] }`
- **Errors**: `INVALID_INPUT`, when `from > to`.

## `save_memory`
- **In**: `{ type: "convention" | "learning" | "pitfall", title, body, tags? }`
- **Out**: `{ id, path }`, for example `.specify/memory/notes/<slug>.md`.

## `search_memory`
- **In**: `{ query, type?: "convention" | "learning" | "pitfall" | "decision" | "constitution", limit?: 1..50 }`
- **Out**: `{ results: [{ kind: "memory" | "decision" | "constitution", id, title, type?, feature?, tags?, date?, path, score, snippet }] }`
  - For the constitution, `id` is the principle key and `path` is `.specify/memory/constitution.md`.
- **Errors**: `INVALID_INPUT`, for a stopword-only query.

## `pack_context`
- **In**: `{ task, budget_tokens?: 200..100000 (default 4000), feature? }`
- **Out**: `{ budget_tokens, used_tokens, items: [{ kind, ref, title, score, tokens, content }], files, skipped }`
  - With `feature`, that feature's open tasks are pinned first, in file order.
- **Errors**: `INVALID_INPUT`, `FEATURE_NOT_FOUND`, `INVALID_FEATURE`.

## Error codes

| Code | When |
|---|---|
| `NOT_INITIALIZED` | the project root does not exist or is not a folder (hint: run `specify init` or set `SPECWRIGHT_ROOT`) |
| `FEATURE_NOT_FOUND` | no `specs/<feature>/` folder |
| `ARTIFACT_NOT_FOUND` | the artifact file (or named checklist or contract) does not exist |
| `SECTION_NOT_FOUND` | no such `##` section |
| `TASK_NOT_FOUND` | no such `T###` in `tasks.md` |
| `INVALID_FEATURE` | an operation on an invalid feature (hint: its issues) |
| `INVALID_DIFF` | the diff is empty or has no file headers |
| `INVALID_INPUT` | a semantically invalid input that passed the schema |
| `PATH_OUTSIDE_ROOT` | a path outside `specs/` or `.specify/`, or a symlink escaping them |
| `INTERNAL` | an unexpected failure; details go to stderr |
