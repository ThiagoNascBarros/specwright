---
id: TRD-001
title: Specwright — Technical Requirements Document
status: accepted
version: 2.0
implements: PRD-001
---

# TRD-001 — Specwright

Explains **how** [PRD-001](01-prd.md) is built. Version 2.0 adopts GitHub Spec Kit's file format. The design of that change is in the feature [`specs/009-speckit-format/`](../specs/009-speckit-format/) (spec, plan, research, data model and contracts).

Decisions are recorded in two places:
- ADRs in [`adr/`](adr/) cover the decisions taken before the server could record its own;
- later decisions live in [`.specify/memory/decisions/`](../.specify/memory/decisions/).

The project's principles are in the [constitution](../.specify/memory/constitution.md).

## 1. Technical vision

Specwright is an MCP server in TypeScript with **stdio** transport, built on the official SDK v2 (`@modelcontextprotocol/server`) ([ADR-0002](adr/0002-typescript.md)). It uses no LLM ([ADR-0003](adr/0003-no-llm-in-server.md)) and no database ([ADR-0004](adr/0004-markdown-storage.md)).

It reads the files that **Spec Kit** (v1.2.x) writes in the target repository:
- `specs/NNN-name/`;
- `.specify/memory/constitution.md`.

It writes only `tasks.md` checkboxes and its own memory in `.specify/memory/`. Files are **re-read on every call**, so no state can go stale.

```
MCP client (agent)
        │ stdio / JSON-RPC
        ▼
 src/index.ts ── loads config, connects stdio
        │
 src/server.ts ── composition root: registers every module's tools
        │
 ┌──────┬──────────────┬───────────┬──────────┬──────────┐
 features/ constitution/ decisions/  memory/   context/     (modules)
 └──────┴───────┬──────┴───────────┴──────────┴──────────┘
                ▼
            storage/  ── the only layer that touches the disk
                ▼
 <project>/specs/NNN-name/*  and  <project>/.specify/{specwright.json, memory/}
```

## 2. Global constraints

- Node.js **≥ 22.12**, TypeScript `strict`, ESM.
- Runtime dependencies: `@modelcontextprotocol/server` (v2), `zod` (v4) and `yaml` (v2). Any other one requires a recorded decision.
- Development dependencies: `typescript`, `vitest`, `@types/node` (major pinned to the Node floor) and `@modelcontextprotocol/client` (v2). `tsc --noEmit && tsc -p tests` is the type gate.
- Forbidden in the server:
  - network access, `child_process` and LLM calls;
  - reads outside `specs/` and `.specify/`;
  - writes other than `tasks.md` checkboxes and `.specify/memory/**`.
- Tool names are `snake_case` English and follow Spec Kit's vocabulary. Errors carry a stable `code`.
- Every tool returns compact JSON in one text block. A listing is an object with one array field (decision 0001).
- 18 tools in total; no two overlap (PRD NFR-2, constitution III).

## 3. Code structure

Each module separates its entities, its disk access, its pure logic and its tools (one file per tool).

```
src/
├── index.ts  server.ts  config.ts  deps.ts  errors.ts
├── storage/              # no domain knowledge
│   ├── paths.ts          # ensureRoot, resolveInside (+ specs/.specify allowlist)
│   ├── files.ts          # readTextIfExists, listMarkdown, writeAtomic, createExclusive
│   ├── lock.ts  concurrency.ts  slug.ts  text.ts
│   └── markdown.ts       # parseDocument, stripComments, scanLines, normalizeKey, listItems
├── features/             # Spec Kit features (replaces v0.1.0 specs/)
│   ├── types.ts          # Feature, Specification, UserStory, Item, Task, DiffSummary
│   ├── schemas.ts        # feature / task / story / artifact zod schemas
│   ├── artifacts.ts      # artifact → file, existingArtifacts
│   ├── spec-parser.ts    # parseSpecification
│   ├── tasks-parser.ts   # parseTasks, scanTasks (shared with the editor)
│   ├── task-editor.ts    # setTaskCheckbox
│   ├── feature.ts        # buildFeature (validation), summarize, taskProgress
│   ├── sections.ts       # findSection (ignores "*(mandatory)*" annotations)
│   ├── diff.ts           # parseUnifiedDiff
│   ├── repository.ts     # listFeatureIds, featureDir, readFeature, readAllFeatures, readArtifact, assertValid
│   └── tools/            # list-features, get-artifact, list-open-tasks, set-task-status, check-against-spec
├── constitution/         # read-only: types, parser, repository
├── decisions/            # types, repository, tools/{log-decision,list-decisions}
├── memory/               # types, repository, search, tools/{save-memory,search-memory}
└── context/              # types, estimate, candidates, packer, files, tools/pack-context
```

**Dependency rules.**
- `storage/` knows no domain.
- A module may call another module's public repository or pure functions, but never its tools (decision 0003):
  - `decisions` uses `features` to check that a feature exists;
  - `memory` uses `decisions` and `constitution`;
  - `context` uses all four.
- Only `server.ts` knows every module.

## 4. Data flow

**Read** (`get_artifact`):
1. zod validates the input.
2. `resolveInside` checks the path against the allowlist.
3. The file is read.
4. HTML comments and the frontmatter are removed.
5. `findSection` cuts the requested section.
6. `respond()` truncates the response if it is too long.

**Write** (`set_task_status`):
1. Read the raw `tasks.md`, and refuse an invalid feature.
2. `setTaskCheckbox` changes one character, using the same line scanner as the parser.
3. `writeAtomic` writes a temp file and renames it; nothing is written when nothing changed.
4. The progress is recomputed from the written text.

## 5. Storage

The project root is `SPECWRIGHT_ROOT` (default: the server's working directory). The optional config is `.specify/specwright.json`, `{ "maxResponseChars": 20000 }` (integer ≥ 100). An invalid config stops the server at startup.

```
<project>/
├── specs/NNN-name/{spec,plan,tasks,research,data-model,quickstart}.md, contracts/, checklists/   # Spec Kit
└── .specify/
    ├── specwright.json
    └── memory/
        ├── constitution.md             # Spec Kit (/speckit-constitution); read-only here
        ├── decisions/NNNN-<slug>.md    # log_decision
        └── notes/<slug>.md             # save_memory
```

### 5.1 Guarantees
- **Path guard (NFR-6, FR-001).**
  - `resolveInside` refuses absolute paths, drive letters and backslash traversal.
  - After `realpath` (applied to the parent for new files), the path must stay inside the root, with first segment `specs` or `.specify`.
  - So a symlink in `specs/` that points into `src/` is refused.
- **Atomic, byte-minimal writes (NFR-5).** Writes use a temp file and a rename. Only the checkbox character changes, and CRLF and the BOM are preserved.
- **Exclusive creation.** Decisions and notes are written with `wx`. Notes get `-2`, `-3`… suffixes.
- **Decision numbering across processes.** Numbering runs under a `mkdir` lock at `.specify/memory/decisions/.lock` (broken after 10 s) plus an in-process queue (decision 0009).
- **Bounded reads.** Listings read at most 32 files at a time (decision 0010).
- **Concurrent edits of one `tasks.md`.** These are not locked: the last write wins, and the change is visible in Git (PRD N5).

## 6. Formats (Spec Kit v1.2.x)

The rules come from Spec Kit's `spec-template.md`, `tasks-template.md`, `checklist-template.md` and `constitution-template.md`, and from its `create-new-feature` script ([research](../specs/009-speckit-format/research.md)).

### 6.1 Feature
A feature is a direct folder of `specs/` named `^(\d{3,}|\d{8}-\d{6})-[a-z0-9][a-z0-9-]*$`. The folder name is its id; any other folder is ignored.

A feature is **invalid** when:
- `spec.md` is missing;
- `spec.md` has no `# Feature Specification:` heading;
- a `T###`, `FR-###` or `SC-###` id is duplicated.

**Warnings** (the feature stays valid):
- a checkbox line in `tasks.md` without a `T###` id;
- a missing `**Status**:` line.

### 6.2 `spec.md`

HTML comments and code fences are ignored before reading. Then:
- **Title and metadata:** the title from `# Feature Specification: <title>`, and `**Feature Branch**:`, `**Created**:`, `**Status**:` and `**Input**:`.
- **User stories:** `### User Story N - Title (Priority: Pn)`, with the numbered `**Given** … **When** … **Then** …` scenarios below it, returned as plain text.
- **Requirements and success criteria:** `- **FR-###**: text` and `- **SC-###**: text`.
- **Edge Cases and Assumptions:** the list items under `### Edge Cases` and under `## Assumptions`.
- **Clarifications:** every `[NEEDS CLARIFICATION: …]` marker.
- **Sections:** `##` blocks. Lookup accepts the key (`requirements-mandatory`), the heading, or the heading without its `*(…)*` annotation (`Requirements`).

### 6.3 `tasks.md`
- **Task line:** `- [ ] T### [P] [USn] description`. `[P]` and `[USn]` are optional and come in this order. `[x]` and `[X]` both mean done.
- **Phase:** the nearest `## Phase N: <name>` heading above the task.
- **Ignored:** the leading YAML frontmatter, code fences (such as the template's "Parallel Example") and HTML comments.
- **Writing:** `set_task_status` writes `[X]` (as `/speckit-implement` does) or a space.

### 6.4 Checklists, contracts, constitution
- **Checklists** (`checklists/<name>.md`, `CHK###` items) and **contracts** (`contracts/<file>`) are returned by name.
  - Checklists are **never written**, because their markers belong to the reviewer.
  - A contract name may include its extension (`.yaml`, `.json`).
- **Constitution:** `.specify/memory/constitution.md`.
  - The `###` principles under `## Core Principles` are indexed for search and context.
  - The `**Version**:` value is read.

### 6.5 Decision (`.specify/memory/decisions/NNNN-<slug>.md`)

```markdown
---
id: "0007"
feature: 001-photo-albums
title: Store metadata in SQLite
date: 2026-10-21
status: accepted
---
## Decision
## Rationale
## Alternatives considered
```

- These sections are Spec Kit's research format. Empty sections are omitted.
- On read, any `##` sections are accepted, and the v0.1.0 key `spec_id` is read as `feature`.
- The slug has no accents, uses `[a-z0-9-]`, has at most 50 characters and is cut at a word boundary.

### 6.6 Note (`.specify/memory/notes/<slug>.md`)
The frontmatter is `id`, `type` (`convention | learning | pitfall`), `title`, `tags` and `date`, followed by the body.

## 7. Tool contract

The full contract, with inputs, outputs and errors, is in [`specs/009-speckit-format/contracts/tools.md`](../specs/009-speckit-format/contracts/tools.md).

| Tool | Input | Output (main fields) |
|---|---|---|
| `list_features` | `status?` | `{ features: [{ id, title, status, valid, issues?, artifacts, tasks: {done,total}, open_clarifications }] }` |
| `get_artifact` | `artifact`, `feature?`, `name?`, `section?` | `{ artifact, feature?, name?, section?, content, truncated? }` |
| `list_open_tasks` | `feature?`, `story?` | `{ open: [{ feature, id, parallel, story?, phase, text }] }` |
| `set_task_status` | `feature`, `task_id`, `done` | `{ feature, task_id, done, changed, tasks }` |
| `check_against_spec` | `feature`, `diff` | `{ feature, title, status, requirements, success_criteria, user_stories, edge_cases, assumptions, open_clarifications, tasks, diff_summary }` |
| `log_decision` | `feature`, `title`, `decision`, `rationale?`, `alternatives?` | `{ id, path }` |
| `list_decisions` | `feature?`, `from?`, `to?` | `{ decisions: [{ id, feature, title, date, status, path }] }` |
| `save_memory` | `type`, `title`, `body`, `tags?` | `{ id, path }` |
| `search_memory` | `query`, `type?` (note type, `decision` or `constitution`), `limit?` | `{ results: [{ kind, id, title, type?, feature?, tags?, date?, path, score, snippet }] }` |
| `pack_context` | `task`, `budget_tokens?`, `feature?` | `{ budget_tokens, used_tokens, items: [{ kind, ref, title, score, tokens, content }], files, skipped }` |

**Behavior.**
- **`check_against_spec`** never judges. It never includes diff line content, and a rename is reported only from git headers (decisions 0005, 0006).
- **`search_memory`** scores each term occurrence: title 3, tags 2, body 1. Terms are accent-free and stopword-filtered.
- **`pack_context`** scores headings 3, titles 2 and content 1. Its candidates are:
  - spec and plan sections, open tasks and constitution principles;
  - decisions and notes.
  - With `feature`, that feature's open tasks are pinned first.
  - Tokens are estimated as `ceil(chars/4)` (decision 0007), and the budget is capped so the response is never truncated.
  - `files` lists the paths cited in backticks or bare in task lines; files are never read (decision 0008).

## 8. Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | the project root does not exist (hint: `specify init` / `SPECWRIGHT_ROOT`) |
| `FEATURE_NOT_FOUND` | no `specs/<feature>/` folder |
| `ARTIFACT_NOT_FOUND` | missing artifact file, checklist or contract (hint: available ones) |
| `SECTION_NOT_FOUND` | no such `##` section (hint: keys) |
| `TASK_NOT_FOUND` | no such `T###` (hint: ids) |
| `INVALID_FEATURE` | operation on an invalid feature (hint: issues) |
| `INVALID_DIFF` | empty diff or no file headers |
| `INVALID_INPUT` | semantically invalid input that passed the schema |
| `PATH_OUTSIDE_ROOT` | the path leaves `specs/` / `.specify/` |
| `INTERNAL` | unexpected failure; details on stderr only |

## 9. Edge cases

The covered cases are:
- comments and fences in templates;
- CRLF, a BOM and emoji in phase headings;
- timestamp feature ids, and non-feature folders in `specs/`;
- features with only a plan, and specs without a title;
- duplicate ids, id-less checkboxes, and `T001` versus `T0010`;
- lowercase `[x]`;
- symlinks into the rest of the project;
- legacy decisions;
- every diff case of v0.1.0.

## 10. Testing strategy

TDD: every `FR-###` and every acceptance scenario (`US<n>-AS<m>`) has a test named after it that was seen failing first. The records are in [`docs/tdd/`](tdd/), and [phase-4.md](tdd/phase-4.md) covers this version.

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm test` | parsers, editor, path guard, storage helpers, ranking, packer |
| Integration | `npm test` | every tool through an in-process client, on a copy of `tests/fixtures/speckit/` (built in Spec Kit's template shape) or on inline projects |
| Contract | `npm test` | the built `dist/index.js` over stdio: exactly 18 tools, the size budget, and a full agent session using all 10 tools |
| Dogfood | `npm test` | this repository's own `specs/` and `.specify/` (a snapshot copy): 9 valid features |
| Performance and load | `npm run test:load` | 500 / 2,000 features, 5,000 notes, concurrent and cross-process writes |

## 11. Build and distribution

`tsc` compiles to `dist/`, whose `index.js` has a shebang and is the `bin`. Install from source. The package keeps `private: true` until a publishing decision is made.

## 12. Security

- No network access, no command execution, and no file access outside `specs/` and `.specify/`.
- Content is data and is never interpreted as instructions.
- Identifiers are validated by regex before any disk access, and returned paths are relative.
- See SECURITY.md at the repository root.

## 13. Traceability

| PRD requirement | Tool | Feature |
|---|---|---|
| FR-1, FR-2, FR-3 | `list_features`, `get_artifact` | `002-spec-reading` → `009-speckit-format` (US1) |
| FR-4, FR-6 | `list_open_tasks`, `set_task_status` | `003-acceptance-criteria` → `009` (US2) |
| FR-5 | `check_against_spec` | `005-check-task` → `009` (US3) |
| FR-7, FR-10 | `log_decision`, `list_decisions` | `004`, `007` → `009` (US4) |
| FR-8, FR-9 | `save_memory`, `search_memory` | `006` → `009` (US4) |
| FR-11 | `pack_context` | `008` → `009` (US5) |

## 14. Open questions

- Reading `.specify/feature.json` to default the feature in `list_open_tasks` and `pack_context`. Spec 009 keeps it out of scope.
- Versioning of `.specify/specwright.json` (PRD Q3).
