---
id: TRD-001
title: Specwright — Technical Requirements Document
status: accepted
version: 2.1
implements: PRD-001
---

# TRD-001 — Specwright

Explains **how** [PRD-001](01-prd.md) is built. Version 2.0 adopts GitHub Spec Kit's file format; its design is in [`specs/009-speckit-format/`](../specs/009-speckit-format/). Version 2.1 adds the knowledge graph (`graph/`) and the `graph` CLI (`cli/`); their design is in the [second brain feature](../specs/010-second-brain/) (spec, plan and research).

Decisions are recorded in two places:
- ADRs in [`adr/`](adr/) cover the decisions taken before the server could record its own;
- later decisions live in [`.specify/memory/decisions/`](../.specify/memory/decisions/).

The project's principles are in the [constitution](../.specify/memory/constitution.md).

## 1. Technical vision

Specwright is an MCP server in TypeScript with **stdio** transport, built on the official SDK v2 (`@modelcontextprotocol/server`) ([ADR-0002](adr/0002-typescript.md)). It uses no LLM ([ADR-0003](adr/0003-no-llm-in-server.md)) and no database ([ADR-0004](adr/0004-markdown-storage.md)).

It reads the files that **Spec Kit** (v1.2.x) writes in the target repository:
- `specs/NNN-name/`;
- `.specify/memory/constitution.md`.

It also reads the Markdown folders listed in the graph's `include` setting, read-only.

It writes only `tasks.md` checkboxes, its own memory in `.specify/memory/`, derived files in the git-ignored graph folder under `.specify/`, and the Obsidian vault that `export_graph` writes to the `vaultDir` folder. Files are **re-read on every call**. The graph keeps a derived cache, but every call checks it against each file's size and modification time, so no state can go stale (constitution IV).

```
MCP client (agent)
        │ stdio / JSON-RPC
        ▼
 src/index.ts ── loads config; `graph <cmd>` → cli/ (prints JSON, exits), otherwise connects stdio
        │
 src/server.ts ── composition root: registers every module's tools and sends `instructions`
        │
 ┌──────┬──────────────┬───────────┬──────────┬──────────┬────────┐
 features/ constitution/ decisions/  memory/   context/    graph/     (modules)
 └──────┴───────┬──────┴───────────┴──────────┴──────────┴────────┘
                ▼
            storage/  ── the only layer that touches the disk
                ▼
 <project>/specs/NNN-name/*, <project>/.specify/{specwright.json, memory/, graph/}, graph.include folders
```

## 2. Global constraints

- Node.js **≥ 22.12**, TypeScript `strict`, ESM.
- Runtime dependencies: `@modelcontextprotocol/server` (v2), `zod` (v4) and `yaml` (v2). Any other one requires a recorded decision.
- Development dependencies: `typescript`, `vitest`, `@types/node` (major pinned to the Node floor) and `@modelcontextprotocol/client` (v2). `tsc --noEmit && tsc -p tests` is the type gate.
- Forbidden in the server:
  - network access, `child_process` and LLM calls;
  - reads outside `specs/`, `.specify/` and the graph's `include` folders;
  - writes other than `tasks.md` checkboxes, `.specify/memory/**`, the graph folder under `.specify/` and the `vaultDir` folder (by `export_graph` only);
  - writing to stdout in server mode. Only the `graph` CLI subcommand prints to stdout, and it never starts the server.
- Tool names are `snake_case` English and follow Spec Kit's vocabulary. Errors carry a stable `code`.
- Every tool returns compact JSON in one text block. A listing is an object with one array field (decision 0001).
- 18 tools in total; no two overlap (PRD NFR-2, constitution III).
- Context budgets (PRD NFR-3): each description ≤ 2 sentences, each entry of the tool listing ≤ 1,200 characters, the whole listing ≤ 16,000 characters, server `instructions` ≤ 1,200 characters.
- Every tool declares `openWorldHint: false`. Read tools declare `readOnlyHint: true`; write tools declare `destructiveHint: false`, plus `idempotentHint: true` when a repeat changes nothing.
- Graph responses are byte-identical for the same files and arguments: no time, process or file-system order leaks into them.

## 3. Code structure

Each module separates its entities, its disk access, its pure logic and its tools (one file per tool).

```
src/
├── index.ts  server.ts  config.ts  deps.ts  errors.ts
├── storage/              # no domain knowledge
│   ├── paths.ts          # ensureRoot, resolveInside / resolveWithin (allowlists), isSafeRelativeDir
│   ├── files.ts          # readTextIfExists, listMarkdown(Tree), writeAtomic(IfChanged), createExclusive
│   ├── hash.ts           # contentHash
│   ├── lock.ts  concurrency.ts  slug.ts  text.ts   # text.ts also holds citedPaths
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
├── context/              # types, estimate, candidates, packer, files, graph-boost, tools/pack-context
├── graph/                # knowledge graph
│   ├── types.ts  ids.ts  schemas.ts  instructions.ts
│   ├── mentions.ts  links.ts  units.ts           # per-line parsing and extraction units
│   ├── facts.ts  facts-feature.ts  facts-memory.ts  ledger.ts   # per-file facts
│   ├── link-index.ts  build.ts  graph.ts         # buildGraph(facts[]) → Graph
│   ├── node-ref.ts  search.ts  traverse.ts  budget.ts  query.ts  path.ts
│   ├── community.ts  analyze.ts                  # Louvain, hubs, surprising connections, questions
│   ├── extraction.ts  relations.ts  lint.ts
│   ├── mermaid.ts  export-json.ts  export-report.ts  export-obsidian.ts
│   ├── repository.ts     # the module's only disk access: sources, snapshot, ledgers, exports
│   ├── service.ts        # loadGraph (cache + incremental refresh), communitiesOf
│   └── tools/            # query-graph, get-node, find-path, graph-report, extraction-batch,
│                         # save-relations, lint-memory, export-graph
└── cli/                  # args.ts (parseGraphArgs), graph.ts (runGraphCli → exit code)
```

**Dependency rules.**
- `storage/` knows no domain.
- A module may call another module's public repository or pure functions, but never its tools (decision 0003):
  - `decisions` uses `features` to check that a feature exists;
  - `memory` uses `decisions` and `constitution`;
  - `context` uses all four, and `graph` for `pack_context`'s `graph: true`;
  - `graph` uses the pure parsers of `features`, `constitution`, `decisions` and `memory`, and never imports `context`;
  - `cli` calls the tools' `run*` functions and the shared `respond` helper.
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

**Graph** (`query_graph` and every graph tool):
1. `loadGraph` lists the sources with their size and modification time. Concurrent calls share one refresh.
2. Unchanged files reuse their cached facts (from memory, or from the disk snapshot in a new process). Changed files are re-read and re-parsed; files that disappeared are dropped.
3. If anything changed, `buildGraph` rebuilds nodes, edges, units and diagnostics from all facts, and the snapshot is rewritten. The result equals a full rebuild.
4. The tool runs its pure logic (search, traversal, path, communities, lint…) and fits the response to its token budget.

**Semantic layer** (`extraction_batch` → `save_relations`):
1. A plan lists the pending units: `##` sections whose content hash and extractor version have no coverage row.
2. The client's agent fetches a batch, reads it and finds relations. The server never calls a model.
3. `save_relations` validates each item on its own and merges the valid ones into `.specify/memory/relations/<scope>.md` under a lock. Only the affected rows change.

## 5. Storage

The project root is `SPECWRIGHT_ROOT` (default: the server's working directory). The optional config is `.specify/specwright.json`. An invalid config stops the server at startup.

```json
{ "maxResponseChars": 20000, "graph": { "include": ["docs"], "cache": "disk", "vaultDir": ".specify/graph/vault" } }
```

- `maxResponseChars`: integer ≥ 100, default 20,000.
- `include`: up to 20 relative folders read as `doc` nodes. Each must have no `..`, no dot-segment, no `node_modules` or `.git`, and must not start with `specs` or `.specify`.
- `cache`: `disk` (default; memory plus a snapshot), `memory`, or `off` (rebuild on every call).
- `vaultDir`: default, a `vault` folder inside the graph folder. Any other value must pass the `include` rules and not be under `specs/`.

```
<project>/
├── specs/NNN-name/{spec,plan,tasks,research,data-model,quickstart}.md, contracts/, checklists/   # Spec Kit
└── .specify/
    ├── specwright.json
    └── memory/
        ├── constitution.md             # Spec Kit (/speckit-constitution); read-only here
        ├── decisions/NNNN-<slug>.md    # log_decision
        ├── notes/<slug>.md             # save_memory
        └── relations/<scope>.md        # save_relations: Concepts, Relations, Coverage tables
    └── graph/                          # derived, git-ignored (`.gitignore` = `*`)
        ├── cache.json                  # per-file facts snapshot
        ├── graph.json  GRAPH_REPORT.md # export_graph
        └── vault/                      # export_graph obsidian (the default vaultDir)
```

### 5.1 Guarantees
- **Path guard (NFR-6, FR-001).**
  - `resolveInside` refuses absolute paths, drive letters and backslash traversal.
  - After `realpath` (applied to the parent for new files), the path must stay inside the root, with first segment `specs` or `.specify`.
  - So a symlink in `specs/` that points into `src/` is refused.
- **Atomic, byte-minimal writes (NFR-5).** Writes use a temp file and a rename. Only the checkbox character changes, and CRLF and the BOM are preserved.
- **Exclusive creation.** Decisions and notes are written with `wx`. Notes get `-2`, `-3`… suffixes.
- **Decision numbering across processes.** Numbering runs under a `mkdir` lock at `.specify/memory/decisions/.lock` (broken after 10 s) plus an in-process queue (decision 0009).
- **Bounded reads.** Listings and graph refreshes read at most 32 files at a time (decision 0010).
- **Graph path guard.** `resolveWithin(root, rel, prefixes)` generalizes `resolveInside`. Graph reads use `specs`, `.specify` and the `include` folders; vault writes use only the `vaultDir` folder.
- **Ledgers.** Rows are kept sorted, and a save changes only the rows it adds or updates (one line for one new relation). Writes are atomic and serialized across processes by a lock folder next to the ledgers. `REJECTED` rows are never deleted by the server.
- **Derived files.** The graph folder's `.gitignore` is created with `wx` and never overwritten. A missing, corrupt or older-schema snapshot is ignored and rewritten.
- **Vault ownership.** The vault's manifest file lists the files `export_graph` owns. A file it does not own is skipped, owned files no longer produced are deleted, and `.obsidian/` is never touched.
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

### 6.7 Relation ledger (`.specify/memory/relations/<scope>.md`)
The scope is the source node's feature, or `project`. The frontmatter holds `scope`, followed by three Markdown tables:

| Table | Columns | Key |
|---|---|---|
| `## Concepts` | `id`, `label`, `summary` | `id` |
| `## Relations` | `source`, `relation`, `target`, `confidence`, `score`, `evidence`, `date` | `source` + `relation` + `target` |
| `## Coverage` | `unit`, `hash`, `version`, `date` | `unit` |

Pipes in cells are escaped as `\|`. People may edit rows by hand; `lint_memory` reports invalid rows.

### 6.8 Graph model
- **Node ids** are typed: `feature:<f>`, `artifact:<f>/<name>`, `artifact:constitution`, `requirement:<f>/FR-###`, `criterion:<f>/SC-###`, `story:<f>/US<n>`, `task:<f>/T###`, `principle:<key>`, `decision:<NNNN>`, `note:<slug>`, `doc:<path>`, `file:<path>` and `concept:<slug>`.
- **Derived edges** (`EXTRACTED`, score 1): `contains`, `implements`, `references` (`FR-###`, `SC-###`, `US<n>`, `T###`, qualified `<feature>/<ID>`, feature ids and "decision 0007"), `touches` (cited paths), `links_to` (Markdown links and wikilinks) and `belongs_to`.
- **Semantic edges** come from the ledgers: `depends_on`, `implements`, `rationale_for`, `supersedes`, `contradicts`, `refines`, `part_of`, `tests`, `uses`, `example_of`, `similar_to` and `related_to`, with confidence `INFERRED` (0.5–0.99) or `AMBIGUOUS` (0.1–0.49). A relation line `- <relation> [[Target]]` in any source also gives an edge.
- **Extraction units** are the `##` sections of each source (or the whole file), identified by `<path>#<section-key>` and hashed.
- **Communities** come from a deterministic Louvain run, numbered by size and then by the smallest member id.

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
| `pack_context` | `task`, `budget_tokens?`, `feature?`, `graph?` | `{ budget_tokens, used_tokens, items: [{ kind, ref, title, score, tokens, content }], files, skipped }` |
| `query_graph` | `question`, `feature?`, `mode?` (`bfs`\|`dfs`), `depth?` (1–4), `budget_tokens?`, `include_ambiguous?` | `{ question, seeds, nodes: [{ id, kind, label, d, path?, line? }], edges, budget_tokens, used_tokens, omitted, needed_budget_tokens?, hint? }` |
| `get_node` | `ref`, `feature?`, `relation?`, `limit?` | `{ node: { id, kind, label, …, excerpt, read? }, degree, community, out, in, omitted }` |
| `find_path` | `from`, `to`, `feature?`, `max_hops?` (1–8), `include_ambiguous?` | `{ from, to, hops, nodes, edges, reason? }` |
| `graph_report` | `top?`, `community?`, `offset?`, `limit?` | counts, most-connected nodes, communities, surprising connections, suggested questions; with `community`, its members and bridges |
| `extraction_batch` | `units?` (≤ 30), `feature?`, `budget_tokens?`, `limit?` | plan: `{ version, units, pending, batches }`; fetch: `{ version, instructions, items, candidates, deferred? }` |
| `save_relations` | `relations?` (≤ 200), `concepts?` (≤ 50), `covered?` (≤ 100) | `{ added, updated, unchanged, rejected: [{ field, index, reason }], files }` |
| `lint_memory` | `feature?`, `limit?` | `{ counts, issues: [{ kind, severity, path, line?, node?, message, fix }] }` |
| `export_graph` | `format` (`json`\|`report`\|`obsidian`) | `{ format, path, written, unchanged, removed, skipped }` |

The graph contracts are in [`specs/010-second-brain/plan.md`](../specs/010-second-brain/plan.md) ("Tool contracts").

**Behavior.**
- **`check_against_spec`** never judges. It never includes diff line content, and a rename is reported only from git headers (decisions 0005, 0006).
- **`search_memory`** scores each term occurrence: title 3, tags 2, body 1. Terms are accent-free and stopword-filtered.
- **`pack_context`** scores headings 3, titles 2 and content 1. Its candidates are:
  - spec and plan sections, open tasks and constitution principles;
  - decisions and notes.
  - With `feature`, that feature's open tasks are pinned first.
  - Tokens are estimated as `ceil(chars/4)` (decision 0007), and the budget is capped so the response is never truncated.
  - `files` lists the paths cited in backticks or bare in task lines; files are never read (decision 0008).
  - With `graph: true`, items linked to the 3 best-ranked items get at least half of the linking item's score before packing.
- **Node references** (`ref`, `from`, `to`) resolve in order: exact id; short form (`<feature>/FR-003`, `FR-003` with `feature`, `0007`, a note slug, a source path); case-insensitive exact label. Otherwise `NODE_AMBIGUOUS` (up to 10 candidates) or `NODE_NOT_FOUND` (up to 5 suggestions).
- **`query_graph`** picks up to 3 seeds by term score, traverses without expanding hubs other than the seeds, ranks by distance, edge score and term score, and fits the response to `budget_tokens` without dropping a seed. Tokens are `ceil(chars/4)` of the JSON.
- **`save_relations`** never writes `EXTRACTED` rows. A triple saved as `REJECTED` stays retired: a later `INFERRED` or `AMBIGUOUS` save of it is refused as `previously_rejected`. A coverage hash that does not match the unit's content is refused as `stale`.

**CLI.** `specwright-mcp graph query|node|path|report|lint|export …` prints the same JSON as the matching tool. Exit codes: 0 on success; 1 on error, or for `lint` when an error-severity issue exists; 2 on bad usage; 3 on `NODE_AMBIGUOUS`; 4 on `NODE_NOT_FOUND`.

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
| `PATH_OUTSIDE_ROOT` | the path leaves `specs/`, `.specify/` or the allowed graph folders |
| `NODE_NOT_FOUND` | no graph node matches the reference (hint: up to 5 closest ids) |
| `NODE_AMBIGUOUS` | the reference matches several nodes (hint: up to 10 candidates) |
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
- every diff case of v0.1.0;
- for the graph: wikilinks with aliases, headings and embeds; links in code or comments; ambiguous and broken links; symlinked include folders; escaped pipes and hand-edited ledger rows; a corrupt or older snapshot; two processes writing the same ledger; vault files the user created.

## 10. Testing strategy

TDD: every `FR-###` and every acceptance scenario (`US<n>-AS<m>`) has a test named after it that was seen failing first. The records are in [`docs/tdd/`](tdd/): [phase-4.md](tdd/phase-4.md) covers the Spec Kit format and [phase-5.md](tdd/phase-5.md) the second brain.

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm test` | parsers, editor, path guard, storage helpers, ranking, packer; every `graph/` file (`tests/unit/graph-*.test.ts`) and the CLI argument parser |
| Integration | `npm test` | every tool through an in-process client, on a copy of the `speckit` or `brain` test fixture (built in Spec Kit's template shape) or on inline projects |
| Contract | `npm test` | the built `dist/index.js` over stdio: exactly 18 tools, the size budgets, annotations and `instructions`; a full agent session; a graph workflow that is byte-identical across two processes; CLI parity and exit codes |
| Dogfood | `npm test` | this repository's own `specs/` and `.specify/` (a snapshot copy): 10 valid features, no `broken_link`, and the SC-001 relation questions |
| Performance and load | `npm run test:load` | 500 / 2,000 features, 5,000 notes, concurrent and cross-process writes; graph cold, warm and snapshot budgets; two processes writing one ledger |

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
| FR-11 | `pack_context` | `008` → `009` (US5); `graph: true` in `010` (US8) |
| FR-12 | graph build, cache and snapshot (all graph tools) | `010-second-brain` (US1, US5, US6) |
| FR-13 | `query_graph`, `get_node`, `find_path` | `010` (US1) |
| FR-14 | `graph_report` | `010` (US3) |
| FR-15, FR-16 | `extraction_batch`, `save_relations` | `010` (US2) |
| FR-17 | `lint_memory` | `010` (US4) |
| FR-18, FR-19 | `export_graph`, `specwright-mcp graph` | `010` (US7) |

## 14. Open questions

- Reading `.specify/feature.json` to default the feature in `list_open_tasks` and `pack_context`. Spec 009 keeps it out of scope.
- Versioning of `.specify/specwright.json` (PRD Q3).
- Closing `010-second-brain` SC-001: two of the five relation questions still save less than 3× the tokens of reading the files.
- The incremental refresh compares size and modification time only; a same-size edit within the file system's time resolution is missed until the next change. Switch to a content hash if stale facts are ever seen.
