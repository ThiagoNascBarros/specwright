---
id: TRD-001
title: Specwright — Technical Requirements Document
status: accepted
version: 1.0
implements: PRD-001
---

# TRD-001 — Specwright

Explains **how** [PRD-001](01-prd.md) is built. ADRs in [`adr/`](adr/) record the decisions taken before the server could record its own. Later decisions live in [`.specwright/decisions/`](../.specwright/decisions/), written with `log_decision`. Development follows the [Roadmap](03-roadmap.md), and each phase has its test record in [`tdd/`](tdd/).

## 1. Technical vision

Specwright is an MCP server in TypeScript with **stdio** transport, built on the official SDK v2 (`@modelcontextprotocol/server`) ([ADR-0002](adr/0002-typescript.md)). It uses no LLM ([ADR-0003](adr/0003-no-llm-in-server.md)) and no database ([ADR-0004](adr/0004-markdown-storage.md)). All state is Markdown in `.specwright/`, inside the target project's repository. That state is **re-read on every call**, so there is no index or cache that could go stale.

```
MCP client (agent)
        │ stdio / JSON-RPC
        ▼
 src/index.ts ── loads config, connects stdio
        │
 src/server.ts ── composition root: registers every module's tools
        │
 ┌──────┼──────────────┬─────────────┐
 specs/ decisions/   memory/      context/        (modules)
 └──────┴──────┬───────┴─────────────┘
               ▼
           storage/  ── the only layer that touches the disk
               ▼
 .specwright/{config.json, specs/, decisions/, memory/}
```

## 2. Global constraints

Every implementation plan copies this list verbatim into its *Global Constraints* section.

- Node.js **≥ 22.12** (Node 20 left LTS in 2026-04; Vitest 5 needs 22.12). TypeScript in `strict` mode. ESM (`"type": "module"`).
- Allowed runtime dependencies: `@modelcontextprotocol/server` (v2), `zod` (v4) and `yaml` (v2). Any other one requires an ADR.
- Development dependencies: `typescript`, `vitest`, `@types/node` and `@modelcontextprotocol/client` (v2). `tsc --noEmit && tsc -p tests` is the type gate, and there is no linter.
- Forbidden in the server: network access, `child_process`, LLM calls, and reads or writes outside `SPECWRIGHT_DIR`.
- Tool names are `snake_case` English. Error messages are in English, with a stable `code`.
- Every tool returns compact JSON in a single text block. Listings return an object with one array field (decision 0001).
- 10 tools in total (PRD NFR-2).

## 3. Code structure

Each module separates its entities, its disk access, its pure logic and its tools (one file per tool):

```
src/
├── index.ts              # entry point: loadConfig + stdio transport
├── server.ts             # createServer(config, deps): registers all modules
├── config.ts             # SPECWRIGHT_DIR + config.json
├── deps.ts               # injectable side effects (clock)
├── errors.ts             # SpecwrightError, codes, respond() truncation, tool() wrapper
├── storage/              # shared infrastructure, no domain knowledge
│   ├── paths.ts          # ensureRoot, resolveInside (path guard)
│   ├── files.ts          # readTextIfExists, listMarkdown, writeAtomic, createExclusive
│   ├── lock.ts           # withLock: cross-process lock (mkdir)
│   ├── concurrency.ts    # mapLimit: bounded parallel reads
│   ├── markdown.ts       # parseDocument, normalizeKey, listItems
│   ├── slug.ts           # slugify, localDate
│   └── text.ts           # tokenize, countOccurrences, snippet
├── specs/
│   ├── types.ts          # Spec, Criterion, SpecSummary, DiffSummary, FileChange
│   ├── schemas.ts        # zod schemas for spec_id and ac_id
│   ├── parser.ts         # parseSpec, findSection, summarize, countCriteria
│   ├── editor.ts         # setCheckbox: one-character edit
│   ├── diff.ts           # parseUnifiedDiff
│   ├── repository.ts     # readSpec, readAllSpecs, assertValid
│   ├── tools/            # list-specs, get-spec, list-open-requirements,
│   │                     # set-criterion-status, check-task-against-spec
│   └── index.ts          # register()
├── decisions/
│   ├── types.ts          # Decision, NewDecision
│   ├── repository.ts     # createDecision, readDecisions, renderDecision
│   ├── tools/            # log-decision, list-decisions
│   └── index.ts
├── memory/
│   ├── types.ts          # Memory, NewMemory, SearchResult
│   ├── repository.ts     # createMemory, readMemories
│   ├── search.ts         # score, rank
│   ├── tools/            # save-memory, search-memory
│   └── index.ts
└── context/
    ├── types.ts          # ContextItem, PackResult
    ├── estimate.ts       # estimateTokens
    ├── candidates.ts     # collectCandidates
    ├── packer.ts         # pack (greedy fill)
    ├── files.ts          # extractPaths
    ├── tools/            # pack-context
    └── index.ts
```

Dependency rules:
- `storage/` knows no domain. Modules depend on `storage/`, `errors.ts` and `config.ts`.
- A module may call another module's **public repository or pure functions**, but never its tools. Today these calls exist:
  - `decisions` uses `specs`, to check that a spec exists;
  - `memory` uses `decisions`, to search decisions;
  - `context` uses `specs`, `decisions` and `memory`.

  The rule was relaxed in decision 0003.
- Only `server.ts` knows every module. Each module exports `register(server, config, deps?)`.

## 4. Data flow

**Read** (e.g., `get_spec`)
1. The SDK validates the input against the tool's zod schema. Invalid input never reaches the tool.
2. `tool()` wraps the call: success goes through `respond()`, and any throw becomes a structured error.
3. The repository resolves `specs/<spec_id>.md` through `resolveInside` and reads it. Because the id is the file name, no search is needed.
4. `parseSpec` → `findSection`. `respond()` truncates to `maxResponseChars` when needed.

**Write** (e.g., `set_criterion_status`)
1. Read the raw text and refuse invalid specs (`INVALID_SPEC`).
2. `setCheckbox` changes the one checkbox character.
3. `writeAtomic` writes a temporary file in the same folder and renames it over the target. When nothing changed, nothing is written.
4. The new state is recomputed from the written text.

## 5. Storage

Root: `SPECWRIGHT_DIR`, default `.specwright`. A relative value is resolved against the server's `process.cwd()`. `config.json` is optional:

```json
{ "maxResponseChars": 20000 }
```

`maxResponseChars` must be an integer ≥ 100. Unknown fields are ignored, and an invalid file stops the server at startup with a clear message on stderr.

```
.specwright/
├── config.json
├── specs/<spec-id>.md
├── decisions/NNNN-<slug>.md    # created on demand by log_decision
└── memory/<slug>.md            # created on demand by save_memory
```

### 5.1 Guarantees
- **Path guard (NFR-6).**
  - Every path goes through `resolveInside`: `realpath` is applied (to the parent for new files), and the result must stay inside the root.
  - Absolute paths, drive letters, `..` and `..\` (backslashes are treated as separators on every platform), and symlinks that point outside the root are all rejected with `PATH_OUTSIDE_ROOT`.
- **Atomic write (NFR-5).** The temporary file is `.<name>.<pid>.<random>.tmp`. It is removed when the write or the rename fails.
- **Minimal edit (NFR-5).** Only the target checkbox character changes. Line endings, the BOM and every other byte stay as they were.
- **Exclusive creation.** New decisions and memories are written with the `wx` flag and are never overwritten. A memory whose slug is taken gets `-2`, `-3`, ….
- **Decision numbering across processes.**
  - The next number is chosen under `decisions/.lock`, a `mkdir`-based lock shared by every server process on the machine. A lock older than 10 s is broken.
  - Inside one process, creations also go through a promise queue.
  - Decision 0009 records this change; it was found by the load test with two servers.
- **Bounded reads.** Listing repositories read at most 32 files at a time, to avoid `EMFILE` on systems with a low `ulimit`.
- **Concurrent edits to the same spec** by different processes are not locked: the last write wins, and the edit stays visible in the Git diff (PRD N5).

## 6. Formats

### 6.1 Spec (`specs/<id>.md`)

```markdown
---
id: auth-login            # required; ^[a-z0-9][a-z0-9-]*$; same as the file name
title: Login with e-mail  # required
status: in-progress       # draft | in-progress | done | deprecated
---

## Context
...
## Acceptance criteria
- [x] AC-1: ...
- [ ] AC-2: ...
## Out of scope
- ...
```

Parsing rules:
- **Frontmatter.** The `---` block at the very start, read with `yaml.parse`. A BOM and CRLF are accepted. The server **never re-serializes** an existing spec's frontmatter.
- **Sections.**
  - A section runs from a `##` heading to the next `##` heading. Inner `###` headings belong to it, and `##` lines inside fenced code blocks are not headings.
  - Text before the first `##` belongs to no section.
  - The key is the heading normalized: no accents, lowercase, non-alphanumeric runs replaced by `-`.
- **Fixed aliases:** `criterios-de-aceite` = `acceptance-criteria`, and `fora-de-escopo` = `out-of-scope`.
- **Criteria.**
  - A criterion is a line of the criteria section that matches `^\s*[-*] \[( |x|X)\] (AC-\d+):\s*(.+)$`.
  - Ids are exact (`AC-1` ≠ `AC-10`) and are never renumbered.
  - A checkbox without an `AC-n` id is ignored and reported as an issue, without making the spec invalid.
- **Invalid spec.** A spec is invalid when any of these holds:
  - the frontmatter is missing or invalid;
  - `id` or `title` is missing;
  - the `id` differs from the file name;
  - `status` is outside the enum;
  - an `AC` id or a `##` heading is duplicated.

  An invalid spec is listed with `valid: false` and its issues. Writes to it are refused with `INVALID_SPEC`, and listings of open requirements and `pack_context` ignore it.

### 6.2 Decision (`decisions/NNNN-<slug>.md`)

```markdown
---
id: "0007"                # string, so YAML does not read it as a number
spec_id: auth-login
title: Lock by account, not by IP
date: 2026-10-21          # local date
status: accepted          # accepted | superseded (superseded is edited by humans)
---
## Context
## Decision
## Consequences
```

- The frontmatter is written with `yaml.stringify`. Empty optional sections are omitted.
- The slug has no accents, uses only `[a-z0-9-]`, has at most 50 characters and is cut at a word boundary. An empty slug falls back to `decision`.

### 6.3 Memory (`memory/<slug>.md`)

```markdown
---
id: one-entity-per-file
type: convention          # convention | learning | pitfall
title: One entity per file
tags: [architecture]
date: 2026-10-21
---
Body in Markdown.
```

## 7. Tool contract

Conventions:
- Each description is at most 2 sentences and says **when** to use the tool.
- Read-only tools carry the `readOnlyHint` annotation.
- Errors come back as `isError: true` with `{ code, message, hint? }`.
- Listings never include bodies, and a response over `maxResponseChars` is cut and flagged `truncated: true`. Truncation is linear: it measures the envelope once and adds items while they fit (decision 0010).

| Tool | Input | Output |
|---|---|---|
| `list_specs` | `status?` | `{ specs: [{ id, title, status, valid, issues?, criteria: {done, total} }], truncated? }` |
| `get_spec` | `spec_id`, `section?` | `{ id, title, status, section?, content, truncated? }` |
| `list_open_requirements` | `spec_id?` | `{ open: [{ spec_id, ac_id, text }] }` |
| `set_criterion_status` | `spec_id`, `ac_id`, `done` | `{ spec_id, ac_id, done, changed, criteria }` |
| `check_task_against_spec` | `spec_id`, `diff` (≤ 5,000,000 chars) | `{ spec_id, title, open_criteria, met_criteria, out_of_scope, diff_summary }` |
| `log_decision` | `spec_id`, `title`, `decision`, `context?`, `consequences?` | `{ id, path }` |
| `list_decisions` | `spec_id?`, `from?`, `to?` (`YYYY-MM-DD`, inclusive) | `{ decisions: [{ id, spec_id, title, date, status, path }] }` |
| `save_memory` | `type`, `title`, `body`, `tags?` | `{ id, path }` |
| `search_memory` | `query`, `type?` (memory type or `decision`), `limit?` (1–50, default 10) | `{ results: [{ kind, id, title, type?, spec_id?, tags?, date, path, score, snippet }] }` |
| `pack_context` | `task`, `budget_tokens?` (200–100,000, default 4,000), `spec_id?` | `{ budget_tokens, used_tokens, items: [{ kind, ref, title, score, tokens, content }], files, skipped }` |

Behavior worth knowing:
- **`get_spec`** without `section` returns the body without the frontmatter. `section` accepts the key, the original heading or an alias.
- **`set_criterion_status`** is idempotent: `changed: false` means nothing was written.
- **`check_task_against_spec`** judges nothing.
  - The diff summary never includes line content, and hunk bodies are consumed by the `@@` line counts.
  - A rename is reported only from `git` headers (decision 0006).
  - The diff is passed as an argument, and the server never runs `git` (decision 0005, TRD Q1).
- **`search_memory`.**
  - Terms are lowercased, accent-free and stopword-filtered (English and Portuguese).
  - Score = Σ occurrences × weight, with title 3, tags 2 and body 1. Ties are broken by newest date, then by id.
  - The snippet is ≤ 200 characters.
- **`pack_context`.**
  - Sections score with heading 3, spec title 2 and content 1. Memories and decisions use the `search_memory` weights.
  - Items are added greedily in score order, and an item that does not fit is skipped.
  - With `spec_id`, that spec's acceptance criteria are pinned first.
  - Tokens are estimated as `ceil(chars/4)` (decision 0007).
  - The effective budget is capped at `floor((maxResponseChars − 2,000)/4)`, so the response is never truncated.
  - `files` holds the backticked paths cited by the selected items, at most 20. Project files are never read (decision 0008).

## 8. Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | the root does not exist or is not a directory (hint: create `.specwright/specs/`) |
| `SPEC_NOT_FOUND` | the `spec_id` does not exist |
| `SECTION_NOT_FOUND` | the section does not exist (hint: available keys) |
| `CRITERION_NOT_FOUND` | the `ac_id` is not in the spec's criteria section (hint: available ids) |
| `INVALID_SPEC` | a write or validation on an invalid spec (hint: its issues) |
| `INVALID_DIFF` | the diff is empty or has no file headers |
| `INVALID_INPUT` | the input passes the schema but is meaningless: a stopword-only query or task, or `from` later than `to` |
| `PATH_OUTSIDE_ROOT` | a path resolves outside the root |
| `INTERNAL` | an unexpected failure; details go to stderr, and the message never carries paths |

Input that violates a tool's zod schema is rejected by the SDK before the tool runs.

## 9. Edge cases

Each spec's tests cover the cases that touch it:
- files with CRLF or a UTF-8 BOM, empty files and frontmatter-only files;
- headings with accents, emoji or repeated spaces, and Portuguese aliases;
- `spec_id` values such as `../x`, `Foo`, `a/b` or `/abs`;
- a symlink that points outside the root, and backslash traversal;
- a spec without a criteria section, and `AC-1` next to `AC-10`;
- `##` lines inside code fences;
- renamed, binary, new and deleted files, multiple hunks, and content lines that start with `---`/`+++`;
- YAML-sensitive titles, colliding slugs, and parallel writes in one process or across two.

## 10. Testing strategy

Development follows **TDD**:
- each `AC-n` gets a test, named after its id, that was seen failing first;
- the evidence per phase is in [`docs/tdd/`](tdd/).

| Suite | Command | What it covers |
|---|---|---|
| Unit | `npm test` | storage helpers, parsers, editor, diff, ranking, packer |
| Integration | `npm test` | each tool through an in-process MCP client (`InMemoryTransport`) against a temporary project |
| Contract | `npm test` | the built `dist/index.js` over stdio: server info, exactly 10 tools, the NFR-3 budget, and an end-to-end workflow with all 10 tools |
| Performance | `npm run test:load` | NFR-7 budgets with 500 specs, 1,000 memories and 50,000-line diffs |
| Load | `npm run test:load` | the real stdio process: 2,000 sequential calls, 500 concurrent reads, 200 concurrent writes, two processes on one root, checkbox churn, 2,000 specs + 5,000 memories |

- Timing suites run serially and apart from the default suite, with a 2× margin when `CI` is set.
- The CI runs typecheck, `npm test` and `npm run test:load` on Node 22 and 24.
- The integration tests build their fixtures inline in temporary directories and never read the repository's own `.specwright/`. Dogfooding against the repository is a manual smoke test.

## 11. Build and distribution

- `tsc` generates `dist/`. The entry point is `dist/index.js`, which has a shebang and a `bin` field.
- Install from source today (see the README). The npm name `specwright-mcp` is reserved by intent only. `package.json` keeps `private: true` until a publication decision is made.

## 12. Security

- No network access, no command execution, and no file access outside the root (§2, §5.1).
- Spec, memory and decision contents are data. The server never interprets them as instructions.
- `spec_id` and `ac_id` are validated by regex before any disk access. Paths returned to clients are relative.
- See [SECURITY.md](../SECURITY.md) for reporting.

## 13. Traceability

| Requirement | Component | Spec |
|---|---|---|
| NFR-9, NFR-10 | `package.json`, `src/index.ts`, CI | `project-foundation` |
| FR-1, FR-2, FR-3, NFR-3, NFR-4, NFR-6, NFR-7, NFR-8 | `storage/*`, `specs/parser`, `specs/repository`, `list_specs`, `get_spec` | `spec-reading` |
| FR-4, FR-6, NFR-5 | `storage/files`, `specs/editor`, `list_open_requirements`, `set_criterion_status` | `acceptance-criteria` |
| FR-7 | `decisions/*`, `storage/lock` | `decision-log` |
| FR-5 | `specs/diff`, `check_task_against_spec` | `check-task` |
| FR-8, FR-9 | `memory/*`, `storage/text` | `memory` |
| FR-10 | `decisions/tools/list-decisions` | `decision-list` |
| FR-11, NFR-2 | `context/*` | `context-pack` |

## 14. Open questions

- Q3 (from the PRD): versioning of `config.json` and of the spec format. It is still deferred: a file without a version is v1.
- Whether to keep a cache for very large projects. Today no budget fails: 2,000 specs list in about 300 ms on CI. Revisit only if NFR-7 fails in real use (ADR-0004).
