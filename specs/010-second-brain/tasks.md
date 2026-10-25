---

description: "Task list for the second brain (project knowledge graph)"
---

# Tasks: Second brain (project knowledge graph)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> - **PLAN_FILE** for the Superpowers scripts is this file: `bash scripts/task-brief specs/010-second-brain/tasks.md <N>` extracts `### Task <N>`.
> - Steps are the Spec Kit task lines (`T###`). Mark them done with Specwright's `set_task_status` (or by turning `[ ]` into `[X]`) once the task review is clean.

**Goal:** Give agents (Codex, Claude Code) a queryable knowledge graph of the project's specs, tasks, decisions, notes and cited files, with a semantic layer they build themselves and a cache that keeps both calls and model tokens cheap. It must work with or without Obsidian.

**Architecture:**
- A new `src/graph/` module derives a typed graph from the files Specwright already reads.
- Per-file parse results are cached in memory and in a disk snapshot, validated by size and mtime on every call.
- Semantic relations, concepts and coverage hashes live in Markdown ledgers in `.specify/memory/relations/`.
- Eight MCP tools, a `graph` CLI subcommand and three export formats sit on top.

**Tech Stack:** TypeScript (strict, ESM), Node.js ≥ 22.12, `@modelcontextprotocol/server` v2, `zod` v4, `yaml` v2, Vitest. No new runtime dependency.

**Spec:** [`specs/010-second-brain/spec.md`](spec.md), which is the binding authority. Design and contracts: [`plan.md`](plan.md). Decisions R1–R18: [`research.md`](research.md).

**Input**: Design documents from `/specs/010-second-brain/`

**Prerequisites**: spec.md, plan.md (holds the data model and the contracts), research.md

**Tests**: Required. Test-first is a non-negotiable principle of this project. Write every test task first, run it, and see it fail for the expected reason before the implementation task of its group. Test names start with the requirement or scenario id, for example `it('FR-009: …')` or `it('US1-AS4: …')`. Record RED and GREEN evidence for `docs/tdd/phase-5.md`.

**Organization**: Tasks are grouped into Superpowers units (`### Task N`), inside Spec Kit phases ordered by user story priority.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies). Under subagent-driven development, implementers still run one at a time.
- **[Story]**: Which user story this task belongs to (US1–US8)

## Global Constraints

Every task's requirements include these. The exact values come from the spec and the plan.

- Node.js ≥ 22.12, TypeScript strict, ESM imports with `.js` suffixes. **No new runtime or dev dependency.**
- No network, no `child_process` and no LLM in `src/`. In server mode nothing is written to stdout: diagnostics go to `console.error`, and only the `graph` CLI subcommand writes to stdout.
- **One responsibility per file.** Entities go in `types.ts`, disk access in `repository.ts`, pure logic in its own file, and each tool in `tools/<tool-name>.ts`. Only `storage/` and the modules' `repository.ts` touch the disk. `graph/` never imports `context/`.
- **Reads:** `specs/`, `.specify/` and the `graph.include` folders, only through `resolveWithin`. **Writes:** `tasks.md` checkboxes, `.specify/memory/**` (ledgers in `.specify/memory/relations/`), `.specify/graph/**` and `graph.vaultDir`. Writes are atomic (`writeAtomic`), byte-minimal, and never overwrite a file the code does not own.
- **Determinism (FR-026):** sort with plain string comparison (`<`, never `localeCompare`), no timestamps in responses, no dependence on `Map` or file-system order. The same files and arguments give byte-identical output.
- **Tokens** are estimated as `Math.ceil(chars / 4)` (decision 0007). Responses go through `tool()`/`respond()` and stay within `maxResponseChars` (default 20,000).
- **Tool budgets (FR-025):** ≤ 2 sentences per description, ≤ 1,200 characters per tool entry in `tools/list`, ≤ 16,000 characters in total. Every tool has `openWorldHint: false`. Read tools have `readOnlyHint: true`. `save_relations` and `export_graph` have `readOnlyHint: false, destructiveHint: false, idempotentHint: true`.
- **Errors:** `SpecwrightError(code, message, hint)` with the existing codes plus `NODE_NOT_FOUND` and `NODE_AMBIGUOUS`. Messages never contain absolute paths.
- **Relation vocabulary (FR-014):** `depends_on, implements, rationale_for, supersedes, contradicts, refines, part_of, tests, uses, example_of, similar_to, related_to`. Score bands: INFERRED 0.5–0.99, AMBIGUOUS 0.1–0.49, REJECTED 0. Clients never write EXTRACTED.
- **Constants:** `EXTRACTOR_VERSION = 1`, `SNAPSHOT_SCHEMA = 1`, `GRAPH_DIR = '.specify/graph'`, `RELATIONS_DIR = '.specify/memory/relations'`, default `graph = { include: [], cache: 'disk', vaultDir: '.specify/graph/vault' }`.
- **Every task leaves the suite green:** `npm run typecheck` and `npm test` pass at each commit, and `npm run test:load` passes from Task 22 on. When a task adds a tool, it adds the name to `EXPECTED_TOOLS` in `tests/contract/server.test.ts`.
- **Git:**
  - branch `feature/SW-10-second-brain`;
  - Conventional Commits, with scope = the module (`graph`, `storage`, `context`, `server`, …);
  - a `Refs: SW-10` trailer on every commit;
  - **no co-author trailers** (the repository owner is the only author);
  - everything in English.

## Review Focus

These five conditions are implied by the spec but are easy to miss. Each has a test in the task that owns the code.

1. **Ledger rows edited by hand with padding or column alignment** (`|  decision:0001  | rationale_for |…`) must parse with trimmed cells and be rewritten only when their content changes. Owning task: Task 10 (T019).
2. **Accented or non-ASCII titles** (Portuguese notes such as "Decisão de cache", emoji in headings) keep their labels as written, and produce ASCII slugs in concept ids and vault file names. Owning tasks: Task 5 (T009) and Task 28 (T057).
3. **A unit that changed or disappeared between `extraction_batch` plan and fetch** is returned in `deferred` (when missing), or with its new hash. It never crashes and is never covered with a stale hash. Owning task: Task 21 (T042).
4. **An include folder or vault folder that is a symlink pointing outside the root** is refused (no read, no write), with `PATH_OUTSIDE_ROOT` or a config error. Owning tasks: Task 3 (T005) and Task 27 (T055).
5. **A huge single section** (larger than the batch budget and larger than `maxResponseChars`) gets its own batch in plan mode. In fetch mode it is `deferred` and does not truncate other items. Owning task: Task 19 (T038).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The fixture every graph test uses

### Task 1: Fixture `brain` and repository hygiene

**Model tier**: cheap (transcription of fixed content).

**Files:**
- Create: `tests/fixtures/brain/**` (every file listed in plan.md § "Fixture: brain")
- Modify: `.gitignore`

**Read first:** plan.md § "Fixture: brain". The ids, words and links there are exact: later tests depend on them.

- [X] T001 Create the fixture project in `tests/fixtures/brain/`, exactly as plan.md § "Fixture: brain" describes, in Spec Kit template shape:
  - `specs/001-photo-albums/{spec.md,plan.md,tasks.md}` and `specs/002-sharing/{spec.md,tasks.md}`;
  - `.specify/memory/constitution.md`, 2 decisions, 2 notes, `.specify/memory/relations/project.md` (in the ledger format of plan.md § "Ledger format"), and `docs/adr/0001-storage.md`.

  Check that decision 0001 contains neither "album" nor "sorting" (US8-AS2 depends on it).
- [X] T002 Add `.specify/memory/relations/.lock/` to `.gitignore`. Then add a smoke test `tests/integration/graph-fixture.test.ts` › `it('fixture: brain lists 2 valid features without issues')`: `copyFixture('brain')`, then `list_features`, and expect the ids `['001-photo-albums', '002-sharing']`, both `valid: true`, and no `issues`.
- Verify: `npx vitest run tests/integration/graph-fixture.test.ts` passes. `npm test` is green.
- Commit: `test(graph): add the brain fixture project` + `Refs: SW-10`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Config, storage helpers and the graph core (types, parsing, ledgers, build, cache, communities) that every story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Task 2: `graph` configuration

**Model tier**: cheap.

**Files:**
- Modify: `src/config.ts`, `tests/unit/config.test.ts`, `tests/helpers.ts`

**Interfaces:**
- Produces: `interface GraphConfig { include: string[]; cache: 'disk' | 'memory' | 'off'; vaultDir: string }`, `Config.graph: GraphConfig`, `export const DEFAULT_GRAPH_CONFIG: GraphConfig`, and `export const GRAPH_CACHE_MODES = ['disk', 'memory', 'off'] as const`.
- Consumes: `isSafeRelativeDir` from Task 3. Implement Task 3 first if you prefer; otherwise inline the check here and switch to the shared helper in Task 3.

**Read first:** plan.md § "Configuration".

- [X] T003 [P] Write failing tests in `tests/unit/config.test.ts`:
  - `FR-021: graph defaults to { include: [], cache: "disk", vaultDir: ".specify/graph/vault" } when absent`;
  - `FR-021: graph.include accepts "docs" and "notes/vault/" (normalized to "notes/vault")`;
  - `FR-021: graph.include rejects "../x", "/abs", "C:/x", ".obsidian", "specs", ".specify/x", "a/node_modules", "a/.git"` (each throws `Invalid …specwright.json`);
  - `FR-007: graph.cache accepts disk|memory|off and rejects "redis"`;
  - `FR-021: graph.vaultDir accepts ".specify/graph/vault" and "brain", and rejects "specs/x", "../x" and ".obsidian"`.
- [X] T004 Implement `Config.graph` parsing and validation in `src/config.ts`, keeping the existing `maxResponseChars` behavior and error style. Update `connect()` in `tests/helpers.ts` so the default config includes `graph: DEFAULT_GRAPH_CONFIG`. Also update every other place that builds a `Config` literal (grep `maxResponseChars:` in `tests/`).
- Verify: `npx vitest run tests/unit/config.test.ts`, then `npm run typecheck`.
- Commit: `feat(server): add the graph section to the config` + `Refs: SW-10`

### Task 3: Storage helpers for the graph

**Model tier**: standard (the path guard is security-sensitive).

**Files:**
- Modify: `src/storage/paths.ts`, `src/storage/files.ts`, `src/storage/text.ts`, `src/context/files.ts`
- Create: `src/storage/hash.ts`
- Test: `tests/unit/paths.test.ts`, `tests/unit/files.test.ts`, `tests/unit/text.test.ts`, `tests/unit/hash.test.ts` (new)

**Interfaces (produces):**
- `resolveWithin(root: string, rel: string, prefixes: readonly string[]): Promise<string>`. `resolveInside(root, rel)` becomes `resolveWithin(root, rel, ALLOWED_TOP_LEVEL)` with identical behavior.
- `isSafeRelativeDir(rel: string): boolean`
- `statIfExists(path: string): Promise<{ size: number; mtimeMs: number } | undefined>`
- `listMarkdownTree(dir: string): Promise<string[]>`: `.md` files under `dir`, recursively. Paths are relative to `dir`, joined with `/` and sorted. It skips names starting with `.`, `node_modules`, and symlinked directories, and returns `[]` when `dir` is missing.
- `writeAtomicIfChanged(path: string, text: string): Promise<boolean>` returns `false` and does not write when the existing content is identical.
- `contentHash(text: string): string`: the first 16 hex characters of the SHA-256 of `text` with CRLF/CR normalized to LF and the BOM removed.
- `citedPaths(text: string): string[]`: every path cited in backticks or bare (the regexes move here from `context/files.ts`), unique, in order of first appearance. `extractPaths` in `context/files.ts` keeps its exact behavior by using it.

- [X] T005 [P] Write failing tests:
  - `paths.test.ts`:
    - `FR-021: resolveWithin allows a path under an extra prefix ("docs/a.md" with ["docs"])`;
    - `FR-021: resolveWithin refuses "docs/../src/x.ts", "/etc/x", "..\\x" and a symlink docs/link → ../outside with PATH_OUTSIDE_ROOT`;
    - `FR-021: isSafeRelativeDir` table test.
  - `files.test.ts`: `listMarkdownTree` (nested folders, skips `.hidden/`, `node_modules/`, non-`.md` files and a symlinked dir; missing dir → `[]`); `writeAtomicIfChanged` (second identical write returns `false`, mtime unchanged); `statIfExists` (missing → `undefined`).
  - `hash.test.ts`: `contentHash("a\r\nb") === contentHash("a\nb")`, a length of 16, and a BOM that is ignored.
  - `text.test.ts`: `citedPaths` finds `` `src/a.ts` `` and bare `src/b/c.py`, ignores URLs, and dedupes.
- [X] T006 Implement the helpers. Refactor `context/files.ts` to use `citedPaths`, and keep `tests/unit/context.test.ts` green unchanged.
- Verify: `npx vitest run tests/unit` is green.
- Commit: `feat(storage): add resolveWithin, Markdown tree listing and content hashing` + `Refs: SW-10`

### Task 4: Error codes and reusable parsers

**Model tier**: cheap.

**Files:**
- Modify: `src/errors.ts`, `src/features/spec-parser.ts`, `src/decisions/repository.ts`, `src/memory/repository.ts`
- Test: `tests/unit/decision-parse.test.ts` (new), `tests/unit/memory-parse.test.ts` (new)

**Interfaces (produces):**
- `ErrorCode` gains `'NODE_NOT_FOUND' | 'NODE_AMBIGUOUS'`.
- `export const STORY_LINE` and `export const ITEM_LINE` (the existing `STORY` and `ITEM` regexes, renamed and exported).
- `export const DECISION_FILE = /^(\d{4})-.+\.md$/` and `export function parseDecision(name: string, raw: string): Decision | undefined`.
- `export function parseMemory(name: string, raw: string): Memory | undefined`.

`readDecisions` and `readMemories` use these with identical results.

- [X] T007 [P] Write failing unit tests for `parseDecision` (frontmatter fields, legacy `spec_id`, no frontmatter → `undefined`) and `parseMemory` (tags, missing title → `undefined`).
- [X] T008 Implement the exports and refactor the two repositories to use them. All existing decision and memory integration tests must stay green, unchanged.
- Verify: `npm test` is green.
- Commit: `refactor: export pure decision, note and spec-line parsers` + `Refs: SW-10`

### Task 5: Graph types and ids

**Model tier**: cheap.

**Files:**
- Create: `src/graph/types.ts`, `src/graph/ids.ts`
- Test: `tests/unit/graph-ids.test.ts`

**Interfaces (produces):**
- Everything in plan.md § "Data model", verbatim.
- `nodeId.feature(f)`, `.artifact(f, name)`, `.constitution()`, `.requirement(f, id)`, `.criterion(f, id)`, `.story(f, us)`, `.task(f, t)`, `.principle(key)`, `.decision(n)`, `.note(slug)`, `.doc(path)`, `.file(path)`, `.concept(slug)`.
- `parseNodeId(id: string): { kind: NodeKind; key: string } | undefined`
- `scopeOfNode(node: Pick<GraphNode, 'feature'>): string`
- `CONCEPT_ID = /^concept:[a-z0-9][a-z0-9-]{0,63}$/`
- `conceptIdFor(label: string): string` (`concept:` + `slugify(label, 64)`, or `concept:concept` when the slug is empty).

**Read first:** plan.md § "Data model" and § "Node ids and sources".

- [X] T009 [P] Write failing tests in `tests/unit/graph-ids.test.ts`:
  - `FR-002: builds and parses every id kind`, round-tripping `requirement:006-memory/FR-003` and `artifact:001-x/contract/api`;
  - `FR-002: parseNodeId rejects unknown kinds and empty keys`;
  - `FR-015: scopeOfNode is the feature, or "project"`;
  - `FR-014: conceptIdFor("Decisão de cache 🚀") === "concept:decisao-de-cache"` (Review Focus 2).
- [X] T010 Implement `types.ts` (verbatim from the plan) and `ids.ts`.
- Verify: `npx vitest run tests/unit/graph-ids.test.ts`.
- Commit: `feat(graph): add graph entities and typed node ids` + `Refs: SW-10`

### Task 6: Mentions and links in a line

**Model tier**: standard (regex edge cases).

**Files:**
- Create: `src/graph/mentions.ts`, `src/graph/links.ts`
- Test: `tests/unit/graph-mentions.test.ts`, `tests/unit/graph-links.test.ts`

**Interfaces (produces):**
- `type Mention = { type: 'item' | 'story' | 'task'; id: string; feature?: string } | { type: 'feature'; id: string } | { type: 'decision'; id: string }` and `findMentions(line: string): Mention[]`, in order of appearance.
- `interface LinkHit { form: 'wiki' | 'markdown'; target: string; embed: boolean; relation?: (typeof SEMANTIC_RELATIONS)[number] }` and `parseLinks(line: string): LinkHit[]`.

**Read first:** plan.md § "Edge derivation" (the regexes) and § "Link resolution" (the parsing rules).

- [X] T011 [P] Write failing tests:
  - mentions:
    - `FR-003: finds FR-003, SC-001, US2, T012 and qualified 006-memory/FR-003 (feature set)`;
    - `FR-003: "decision 0007" and "decisions 0009 and 0010" give 3 decision mentions`;
    - `FR-003: feature-id tokens such as 002-sharing are returned (validated later), and dates are returned as feature candidates too`;
    - `FR-003: T0010 is not T001`.
  - links:
    - `FR-004: [[Note|alias]], [[Note#H]], [[Note#^b]], ![[Note]] give target "Note"`;
    - `FR-004: [text](../a%20b.md#x) gives "../a b.md"`;
    - `FR-004: http(s), mailto, #anchor-only and ![img](x.png) are ignored`;
    - `FR-004: links inside inline code are ignored`;
    - `FR-003: "- depends_on [[X]]" carries relation depends_on, and "- foo [[X]]" carries none`.
- [X] T012 Implement both files.
- Verify: `npx vitest run tests/unit/graph-mentions.test.ts tests/unit/graph-links.test.ts`.
- Commit: `feat(graph): parse id mentions, wikilinks and Markdown links` + `Refs: SW-10`

### Task 7: Extraction units

**Model tier**: cheap.

**Files:**
- Create: `src/graph/units.ts`, `src/graph/budget.ts` (only `tokensOf(text)` and `estimateTokens(value)` for now)
- Test: `tests/unit/graph-units.test.ts`

**Interfaces (produces):**
- `unitsOf(input: { path: string; raw: string; node: string; scope: string; title: string }): Unit[]`. There is one unit per `##` section (from `parseDocument(stripComments(normalized raw))`). Unit id: `<path>#<key>`; a repeated key gets `-2`, `-3`… The unit `title` is `<title> — <heading>`. A file with no `##` section gives one unit, with id `<path>`. Empty sections are skipped. `hash = contentHash(content)`, `tokens = tokensOf(content)`.
- `unitContent(raw: string, unit: Pick<Unit, 'id' | 'path' | 'section'>): string | undefined` returns the same text that was hashed.
- `tokensOf(text: string): number` is `Math.ceil(text.length / 4)`. `estimateTokens(value: unknown): number` is `tokensOf(JSON.stringify(value))`.

- [X] T013 [P] Write failing tests:
  - `FR-013: one unit per ## section with stable ids and hashes`;
  - `FR-013: duplicate headings get -2`;
  - `FR-013: a file without sections is one unit`;
  - `FR-013: HTML comments do not change the hash`;
  - `SC-002: editing one section changes only that unit's hash`.
- [X] T014 Implement.
- Verify: `npx vitest run tests/unit/graph-units.test.ts`.
- Commit: `feat(graph): split sources into hashed extraction units` + `Refs: SW-10`

### Task 8: Facts of feature artifacts

**Model tier**: standard.

**Files:**
- Create: `src/graph/facts-feature.ts`
- Test: `tests/unit/graph-facts-feature.test.ts`

**Interfaces:**
- Consumes: `parseSpecification`, `parseTasks`/`scanTasks`, `STORY_LINE`, `ITEM_LINE`, `scanLines`, `parseDocument`, `stripComments`, `normalizeKey`, `citedPaths`, `findMentions`, `parseLinks`, `unitsOf`, `nodeId`.
- Produces: `featureFacts(input: { path: string; kind: 'spec' | 'plan' | 'tasks' | 'research' | 'data-model' | 'quickstart' | 'contract'; feature: string; raw: string }): FileFacts`.
  - It emits the nodes of plan.md § "Node ids and sources" (feature node only from `spec`), with `path`, `line`, `section` and `heading`.
  - It emits the edges it can resolve inside the file (`contains`, and `implements` without checking that the story exists: the build validates).
  - It emits `links`, `mentions` (with the owner as `from` and the file's feature as the default `feature`) and `paths`, all with owners per § "Edge derivation".
  - It emits units for every kind except `tasks`.

**Read first:** plan.md § "Node ids and sources" and § "Edge derivation".

- [X] T015 [P] Write failing tests (raw strings built inline, or read from the brain fixture):
  - `FR-002: spec.md yields feature, artifact, requirement, criterion and story nodes with lines and sections`;
  - `FR-003: tasks.md T005 [US2] yields task node done=false, contains + implements edges, mention FR-002 owned by the task, path src/albums/sort.ts owned by the task`;
  - `FR-003: lines in fences and comments yield nothing`;
  - `FR-003: the owner of an FR item line is the requirement; of other lines, the artifact`;
  - `FR-013: tasks.md has no units; spec.md has one per section`.
- [X] T016 Implement.
- Verify: `npx vitest run tests/unit/graph-facts-feature.test.ts`.
- Commit: `feat(graph): derive nodes and raw edges from feature artifacts` + `Refs: SW-10`

### Task 9: Facts of the constitution, decisions, notes and docs

**Model tier**: standard.

**Files:**
- Create: `src/graph/facts-memory.ts`
- Test: `tests/unit/graph-facts-memory.test.ts`

**Interfaces (produces):**
- `constitutionFacts(path, raw)`, `decisionFacts(path, raw)`, `noteFacts(path, raw)`, `docFacts(path, raw)`, each `(path: string, raw: string) => FileFacts`.
- They use `parseConstitution`, `parseDecision`, `parseMemory` and `parseDocument`.
- A decision emits a `belongs_to` intent as a mention-like raw edge: emit a `GraphEdge` to `feature:<f>` and let the build drop it when the feature does not exist. Its mention scope is its `feature`.
- Notes and docs have no scope, so only qualified mentions count.
- A doc's label is its first `# ` heading, or the file name without `.md`.
- Units come from `unitsOf`.

- [X] T017 [P] Write failing tests:
  - `FR-002: principles get ids principle:<key> with heading lines`;
  - `FR-003: decision 0002 yields belongs_to feature:002-sharing, a "decision 0001" mention, a wikilink keep-ids-stable and a relation-line link depends_on`;
  - `FR-003: an unqualified FR-002 in a note is not a scoped mention, but 001-photo-albums/FR-002 is`;
  - `FR-002: doc label from # heading, else file name`;
  - `Review Focus 2: a note titled "Decisão de cache" keeps its label`.
- [X] T018 Implement.
- Verify: `npx vitest run tests/unit/graph-facts-memory.test.ts`.
- Commit: `feat(graph): derive nodes and raw edges from project memory` + `Refs: SW-10`

### Task 10: Relation ledgers (parse and byte-minimal update)

**Model tier**: standard.

**Files:**
- Create: `src/graph/ledger.ts`
- Test: `tests/unit/graph-ledger.test.ts`

**Interfaces (produces):**
- `ledgerPath(scope: string): string`
- `escapeCell(s: string): string`, `unescapeCell(s: string): string`, `formatScore(n: number): string`
- `parseLedger(path: string, raw: string): LedgerFacts`
- `type LedgerChanges = { concepts?: Array<Omit<ConceptRow, 'line'>>; relations?: Array<Omit<RelationRow, 'line'>>; coverage?: Array<Omit<CoverageRow, 'line'>> }`
- `applyLedgerChanges(raw: string | undefined, scope: string, changes: LedgerChanges): { text: string; stats: Record<'concepts' | 'relations' | 'coverage', { added: number; updated: number; unchanged: number }> }`

**Read first:** plan.md § "Ledger format".

- [X] T019 [P] Write failing tests:
  - `FR-015: a new ledger renders frontmatter, title and three tables with sorted rows`;
  - `SC-006: adding one relation to an existing ledger adds exactly one line at its sorted position`;
  - `FR-015: re-saving an identical row changes nothing (unchanged=1, text identical)`;
  - `FR-015: changing a score replaces only that line`;
  - `FR-015: CRLF files stay CRLF`;
  - `FR-015: cells with | and newlines round-trip through escape/unescape`;
  - `FR-019: invalid rows (wrong cell count, bad confidence, NaN score) are reported in invalid[] with line numbers and skipped`;
  - `Review Focus 1: padded, hand-aligned cells parse trimmed, and an unchanged padded row is not rewritten`.
- [X] T020 Implement.
- Verify: `npx vitest run tests/unit/graph-ledger.test.ts`.
- Commit: `feat(graph): read and update Markdown relation ledgers` + `Refs: SW-10`

### Task 11: Link index and facts dispatcher

**Model tier**: standard.

**Files:**
- Create: `src/graph/link-index.ts`, `src/graph/facts.ts`
- Test: `tests/unit/graph-link-index.test.ts`, `tests/unit/graph-facts.test.ts`

**Interfaces (produces):**
- `type LinkResolution = { node: string } | { file: string } | { missing: true } | { ambiguous: string[] } | { ignore: true }`
- `buildLinkIndex(entries: Array<{ path: string; node: string }>): LinkIndex`
- `resolveWiki(index: LinkIndex, target: string): LinkResolution`
- `resolveMarkdown(index: LinkIndex, fromPath: string, href: string): LinkResolution`
- `factsOf(source: SourceFile, raw: string): FileFacts`, which dispatches on `source.kind`. Ledgers give `{ ledger: parseLedger(...), nodes: concept nodes }`.

**Read first:** plan.md § "Link resolution".

- [X] T021 [P] Write failing tests:
  - `FR-004: wikilink resolves by exact path, then unique suffix, then unique basename, case-insensitive with .md optional`;
  - `FR-004: two notes named x.md in different folders → ambiguous with both paths`;
  - `FR-004: a relative Markdown link resolves from the linking file's folder`;
  - `FR-004: ../outside-root → ignore; unknown .md → missing; ../src/a.ts → file`;
  - `FR-001: factsOf dispatches each SourceKind and ledger concept rows become concept nodes`.
- [X] T022 Implement.
- Verify: `npx vitest run tests/unit/graph-link-index.test.ts tests/unit/graph-facts.test.ts`.
- Commit: `feat(graph): resolve links and dispatch per-file facts` + `Refs: SW-10`

### Task 12: Build the graph

**Model tier**: most capable (central integration of every rule).

**Files:**
- Create: `src/graph/build.ts`, `src/graph/graph.ts`
- Test: `tests/unit/graph-build.test.ts`

**Interfaces:**
- Produces: `buildGraph(facts: FileFacts[], version?: number): Graph` (pure; sorts its input by path).
- Produces (`graph.ts`):
  - `incident(graph, id, opts?: { includeAmbiguous?: boolean }): Array<{ index: number; edge: GraphEdge; other: string; direction: 'out' | 'in' }>`, in adjacency order;
  - `degree(graph, id, opts?: { ignore?: readonly Relation[] }): number`;
  - `isUsable(edge: GraphEdge, includeAmbiguous: boolean): boolean`;
  - `type EdgeTuple = [string, string, string] | [string, string, string, Confidence, number]` and `edgeTuple(edge): EdgeTuple`.
- Build steps:
  1. Merge nodes (first wins, by path order) and sort them by id.
  2. Create a feature node for features without `spec.md`.
  3. Resolve mentions (scoped, existing nodes only, else an `unknown_mention` diagnostic when scoped), links (via the link index: `links_to`, a relation-line relation, `touches` for `{ file }`, `broken_link` and `ambiguous_link` diagnostics) and paths (a source → `links_to`, else a `file:` node plus `touches`).
  4. Drop `belongs_to` and `implements` edges whose target is missing (an `unknown_mention` diagnostic for `implements`).
  5. Add ledger relations (INFERRED or AMBIGUOUS as edges with origin `ledger`, endpoints that must exist or a `dangling_relation` diagnostic; REJECTED keys go to `graph.rejected` and suppress the same non-EXTRACTED triple from any ledger), invalid rows (`invalid_row`) and coverage.
  6. Dedupe triples: EXTRACTED > INFERRED > AMBIGUOUS, then higher score, then the first (path, line).
  7. Drop self-edges.
  8. Sort edges and build `out` and `in`.
  9. Collect units from all facts into `graph.units`.

**Read first:** plan.md § "Data model", § "Edge derivation", § "Link resolution" and § "Ledger format".

- [X] T023 Write failing tests in `tests/unit/graph-build.test.ts`, building from `factsOf` over the brain fixture's files read with `fs` in the test:
  - `FR-003: task T005 → implements US2, references FR-002, touches file:src/albums/sort.ts`;
  - `FR-003: decision 0002 → belongs_to feature:002-sharing, references decision:0001, links_to note:keep-ids-stable, depends_on decision:0001 (EXTRACTED, origin relation-line)`;
  - `FR-003: 002-sharing FR-001 references requirement:001-photo-albums/FR-003 (qualified mention)`;
  - `FR-005: every edge has relation, confidence, score, path and line when known`;
  - `FR-015: the ledger relation note:sorting-pitfall → FR-002 is INFERRED 0.8 with origin ledger`;
  - `FR-014: a REJECTED row removes the same INFERRED triple`;
  - `FR-019: a missing wikilink gives broken_link; a ledger row with a missing target gives dangling_relation and no edge`;
  - `FR-026: building twice from shuffled facts gives identical JSON`.
- [X] T024 Implement.
- Verify: `npx vitest run tests/unit/graph-build.test.ts`, then `npm run typecheck`.
- Commit: `feat(graph): build the project graph from per-file facts` + `Refs: SW-10`

### Task 13: Repository and incremental cache

**Model tier**: most capable (cache correctness).

**Files:**
- Create: `src/graph/repository.ts`, `src/graph/service.ts`
- Test: `tests/unit/graph-repository.test.ts`, `tests/integration/graph-cache.test.ts`

**Interfaces (produces):**
- `discoverSources(root: string, include: readonly string[]): Promise<SourceFile[]>`
- `readSource(root: string, path: string, include: readonly string[]): Promise<string>`
- `readSnapshot(root: string): Promise<Snapshot | undefined>`
- `writeSnapshot(root: string, snapshot: Snapshot): Promise<void>`
- `ensureGraphDir(root: string): Promise<void>`
- `type Snapshot = { schema: number; extractor: number; files: Record<string, { size: number; mtimeMs: number; facts: FileFacts }> }`
- `loadGraph(config: Config): Promise<Graph>`
- `resetGraphCache(): void`
- `cacheStats(root: string): { parsed: number; reused: number }`: counts from the last refresh, for tests only.

Include discovery is implemented in Task 27. Here, `discoverSources` ignores `include`.

**Read first:** plan.md § "Cache and refresh".

- [X] T025 Write failing tests:
  - `FR-006 / US5-AS1: after editing one note, adding one decision and deleting one note, the next loadGraph parses exactly 2 files (cacheStats) and its nodes/edges/diagnostics JSON equals a cache:"off" build`;
  - `FR-007 / US5-AS2: a second process, simulated by resetGraphCache with the snapshot on disk, reuses every unchanged file (parsed 0)`;
  - `FR-007: a corrupt cache.json or schema 0 is ignored and rewritten`;
  - `US5-AS3: cache "off" never reads or writes .specify/graph/cache.json`;
  - `FR-008: the first snapshot write creates .specify/graph/.gitignore containing "*", and an existing .gitignore is never overwritten`;
  - `FR-006: 20 concurrent loadGraph calls share one refresh`.
- [X] T026 Implement `repository.ts` (discovery order and filters per the plan; every read goes through `resolveWithin`).
- [X] T027 Implement `service.ts` (per-root state, in-flight sharing, snapshot handling, stderr logging once per process on snapshot write failure).
- Verify: `npx vitest run tests/unit/graph-repository.test.ts tests/integration/graph-cache.test.ts`.
- Commit: `feat(graph): load the graph incrementally with a disk snapshot` + `Refs: SW-10`

### Task 14: Deterministic communities

**Model tier**: most capable (algorithm).

**Files:**
- Create: `src/graph/community.ts`
- Modify: `src/graph/service.ts` (adds `communitiesOf`)
- Test: `tests/unit/graph-community.test.ts`

**Interfaces (produces):**
- `type Community = { id: number; label: string; members: string[] }`
- `type Communities = { byNode: Map<string, number>; list: Community[] }`
- `detectCommunities(graph: Graph): Communities`
- `communitiesOf(graph: Graph): Communities`, memoized by `graph.version`.

**Read first:** plan.md § "Community detection and analysis" and research.md § 5.

- [X] T028 [P] Write failing tests:
  - `FR-018: two cliques joined by one edge give two communities`;
  - `FR-018: ids are ordered by size desc, then smallest member id`;
  - `FR-018: a disconnected community is split into its components`;
  - `FR-018: labels prefer the top-degree non-file member, prefixed with the feature title when one feature owns more than half the members`;
  - `FR-026: the same graph built from shuffled facts gives identical communities`;
  - `FR-018: the brain fixture gives at least 2 communities and every node gets one`.
- [X] T029 Implement the deterministic Louvain, the split, ids and labels, and `communitiesOf`.
- Verify: `npx vitest run tests/unit/graph-community.test.ts`.
- Commit: `feat(graph): detect communities with deterministic Louvain` + `Refs: SW-10`

**Checkpoint**: The graph core passes T003–T029. User story work can begin.

---

## Phase 3: User Story 1 - Ask the project graph instead of reading files (Priority: P1) 🎯 MVP

**Goal**: `query_graph`, `get_node` and `find_path` answer from the explicit graph within a budget.

**Independent Test**: on `copyFixture('brain')`, call the three tools and check ids, edges and budgets (US1-AS1–AS5).

### Task 15: Node references and search

**Model tier**: standard.

**Files:**
- Create: `src/graph/node-ref.ts`, `src/graph/search.ts`
- Test: `tests/unit/graph-node-ref.test.ts`, `tests/unit/graph-search.test.ts`

**Interfaces (produces):**
- `resolveNodeRef(graph: Graph, ref: string, feature: string | undefined, options: { allowLabel: boolean }): GraphNode`. It throws `NODE_NOT_FOUND` (hint `Closest: …`) or `NODE_AMBIGUOUS` (hint `Candidates: …`).
- `scoreNodes(graph: Graph, question: string, feature?: string): Array<{ id: string; score: number }>`, sorted with an inverted index memoized per `graph.version`.
- `pickSeeds(graph: Graph, scored: Array<{ id: string; score: number }>): string[]`

**Read first:** plan.md § "Tool contracts" (the node-reference paragraph) and § "Query algorithm" (search).

- [X] T030 [P] [US1] Write failing tests:
  - `FR-012: resolves exact ids, 001-photo-albums/FR-002, FR-002 with feature, 0002, keep-ids-stable, specs/001-photo-albums/spec.md and an exact label`;
  - `US1-AS5: a label shared by two nodes → NODE_AMBIGUOUS listing both ids; an unknown label → NODE_NOT_FOUND with suggestions`;
  - `FR-009: "album sorting" scores FR-002 and T005 highest`;
  - `FR-009: an id in the question scores 1000`;
  - `FR-009: with feature, seeds come from that feature`;
  - `FR-009: the second seed must score at least half the first`.
- [X] T031 [US1] Implement both files.
- Verify: `npx vitest run tests/unit/graph-node-ref.test.ts tests/unit/graph-search.test.ts`.
- Commit: `feat(graph): resolve node references and score nodes for a question` + `Refs: SW-10`

### Task 16: Traversal, budget and the query

**Model tier**: standard.

**Files:**
- Create: `src/graph/traverse.ts`, `src/graph/query.ts`
- Modify: `src/graph/budget.ts`
- Test: `tests/unit/graph-traverse.test.ts`, `tests/unit/graph-budget.test.ts`, `tests/unit/graph-query.test.ts`

**Interfaces (produces):**
- `traverse(graph, seeds: string[], opts: { mode: 'bfs' | 'dfs'; depth: number; includeAmbiguous: boolean }): { dist: Map<string, number>; tree: Map<string, number>; edges: number[] }`
- `fitToBudget(input: { envelope: Record<string, unknown>; nodes: Array<{ id: string; value: unknown }>; edges: Array<{ endpoints: [string, string]; value: unknown }>; pinned: number; budgetTokens: number }): { nodes: unknown[]; edges: unknown[]; usedTokens: number; omitted: { nodes: number; edges: number }; neededTokens: number }`
- `type QueryInput = { question: string; feature?: string; mode: 'bfs' | 'dfs'; depth: number; budgetTokens: number; includeAmbiguous: boolean }`
- `queryGraph(graph: Graph, input: QueryInput): Record<string, unknown>`, in the exact output shape of plan.md § "Tool contracts" › `query_graph`.

**Read first:** plan.md § "Query algorithm" and § "Tool contracts" › `query_graph`.

- [X] T032 [P] [US1] Write failing tests:
  - `FR-009: BFS distances and tree edges; the hub guard stops expansion through a node of degree ≥ max(50, p99) unless it is a seed`;
  - `FR-009: AMBIGUOUS edges are skipped unless includeAmbiguous`;
  - `FR-009: DFS respects depth`;
  - `US1-AS4: a 200-token budget keeps every seed, reports omitted counts and needed_budget_tokens, and used_tokens ≤ budget`;
  - `FR-027: estimate = ceil(JSON chars / 4)`;
  - `US1-AS1 (unit): on the brain graph, "album sorting" with feature 001-photo-albums returns T005, US2, FR-002, file:src/albums/sort.ts and the implements/references/touches tuples`.
- [X] T033 [US1] Implement.
- Verify: `npx vitest run tests/unit/graph-traverse.test.ts tests/unit/graph-budget.test.ts tests/unit/graph-query.test.ts`.
- Commit: `feat(graph): traverse from seeds and fit answers to a token budget` + `Refs: SW-10`

### Task 17: Shortest path

**Model tier**: cheap.

**Files:**
- Create: `src/graph/path.ts`
- Test: `tests/unit/graph-path.test.ts`

**Interfaces (produces):** `shortestPath(graph: Graph, from: string, to: string, opts: { maxHops: number; includeAmbiguous: boolean }): { nodes: string[]; edges: number[] } | undefined`

- [X] T034 [P] [US1] Write failing tests:
  - `FR-011: note:keep-ids-stable → requirement:001-photo-albums/FR-001 returns the shortest path and the same path on every call`;
  - `FR-011: between two parallel edges the higher score wins`;
  - `FR-011: no path within maxHops → undefined`;
  - `FR-011: from === to → a 0-hop path`.
- [X] T035 [US1] Implement.
- Verify: `npx vitest run tests/unit/graph-path.test.ts`.
- Commit: `feat(graph): find shortest paths between nodes` + `Refs: SW-10`

### Task 18: Tools `query_graph`, `get_node`, `find_path`

**Model tier**: standard.

**Files:**
- Create: `src/graph/schemas.ts`, `src/graph/index.ts`, `src/graph/tools/query-graph.ts`, `src/graph/tools/get-node.ts`, `src/graph/tools/find-path.ts`
- Modify: `src/server.ts` (register the graph module), `tests/contract/server.test.ts` (add the 3 names; replace the 12,000 assertion with ≤ 16,000 in total and ≤ 1,200 per tool, keeping ≤ 2 sentences)
- Test: `tests/integration/graph-query.test.ts`, `tests/integration/graph-node.test.ts`, `tests/integration/graph-path.test.ts`

**Interfaces (produces):**
- `runQueryGraph(config: Config, deps: Deps, args)`, `runGetNode(...)` and `runFindPath(...)`, each returning `Promise<Record<string, unknown>>`.
- `register(server, config, deps)` in `graph/index.ts`.
- Descriptions, inputs, outputs and annotations exactly as plan.md § "Tool contracts".

**Read first:** plan.md § "Tool contracts" (`query_graph`, `get_node`, `find_path`, conventions).

- [X] T036 [US1] Write failing integration tests on `copyFixture('brain')` (call `resetGraphCache()` in `afterEach`):
  - `US1-AS1: query_graph "album sorting" (feature 001-photo-albums) includes task:001-photo-albums/T005, story:001-photo-albums/US2, requirement:001-photo-albums/FR-002, file:src/albums/sort.ts with implements/references/touches edges; used_tokens ≤ budget_tokens`;
  - `US1-AS2: get_node "0002" has out belongs_to/references/links_to/depends_on and in links_to from note:keep-ids-stable…`, asserting each exact tuple per the fixture;
  - `US1-AS3: find_path note:keep-ids-stable → requirement:001-photo-albums/FR-001 is identical on two calls`;
  - `US1-AS4: budget_tokens 200 keeps the seeds and reports omitted`;
  - `US1-AS5: NODE_AMBIGUOUS and NODE_NOT_FOUND are isError with code and hint`;
  - `FR-010: get_node read = { artifact: "spec", feature, section: <heading> } for FR-002`;
  - `FR-026: each tool returns byte-identical text on two calls in two server instances`.
- [X] T037 [US1] Implement the schemas, the three tools, `graph/index.ts` and the `server.ts` registration, and update the contract test as described under Files.
- Verify: `npm test` is green (this includes the stdio contract).
- Commit: `feat(graph): add query_graph, get_node and find_path` + `Refs: SW-10`

**Checkpoint**: The MVP works. An agent can query the explicit graph with no extraction and no Obsidian.

---

## Phase 4: User Story 2 - The user's own agent builds the semantic layer (Priority: P1)

**Goal**: `extraction_batch` and `save_relations` let any client agent add INFERRED/AMBIGUOUS relations and concepts, never analyzing the same content twice.

**Independent Test**: plan → fetch → save for every batch with scripted relations, then plan again (0 pending), then edit one section (1 pending).

### Task 19: Extraction planning and instructions

**Model tier**: standard.

**Files:**
- Create: `src/graph/extraction.ts`, `src/graph/instructions.ts`
- Test: `tests/unit/graph-extraction.test.ts`

**Interfaces (produces):**
- `pendingUnits(graph: Graph, feature?: string): Unit[]`: units without a coverage row whose hash equals the unit's hash and whose version is `EXTRACTOR_VERSION`. Sorted by scope (`project` last), then path, then order in the file.
- `type Batch = { batch: number; scope: string; tokens: number; units: string[] }` and `planBatches(units: Unit[], budget: number, limit: number): Batch[]`
- `candidatesFor(graph: Graph, units: Unit[], max = 60): Array<[string, string]>`
- `EXTRACTION_INSTRUCTIONS` and `SERVER_INSTRUCTIONS`, verbatim from plan.md § "Extraction instructions" and § "Server instructions".

- [X] T038 [P] [US2] Write failing tests:
  - `US2-AS1: with no coverage every unit is pending, batches stay within budget, sorted by scope then path, and the scope changes start a new batch`;
  - `Review Focus 5: a unit larger than the budget gets its own batch`;
  - `SC-002: a coverage row with the current hash and version makes a unit not pending; an older version makes it pending`;
  - `FR-013: candidatesFor lists same-scope nodes in kind order, then concepts, then principles, capped at 60 with labels ≤ 60 chars`;
  - `FR-023: SERVER_INSTRUCTIONS ≤ 1,200 chars and EXTRACTION_INSTRUCTIONS ≤ 1,600 chars`.
- [X] T039 [US2] Implement.
- Verify: `npx vitest run tests/unit/graph-extraction.test.ts`.
- Commit: `feat(graph): plan extraction batches from uncovered units` + `Refs: SW-10`

### Task 20: Validating and writing saved relations

**Model tier**: most capable (validation rules plus a cross-process write).

**Files:**
- Create: `src/graph/relations.ts`
- Modify: `src/graph/repository.ts` (add `writeLedgerChanges`)
- Test: `tests/unit/graph-relations.test.ts`, `tests/unit/graph-repository.test.ts`

**Interfaces (produces):**
- `type SaveInput = { relations?: Array<{ source: string; relation: string; target: string; confidence: 'INFERRED' | 'AMBIGUOUS' | 'REJECTED'; score: number; evidence?: string }>; concepts?: Array<{ id: string; label: string; summary?: string }>; covered?: Array<{ unit: string; hash: string }> }`
- `type Rejection = { field: 'relations' | 'concepts' | 'covered'; index: number; reason: 'bad_concept_id' | 'unknown_source' | 'unknown_target' | 'self_relation' | 'unknown_relation' | 'score_out_of_range' | 'previously_rejected' | 'unknown_unit' | 'stale' }`
- `prepareSave(graph: Graph, input: SaveInput, today: string): { changes: Map<string, LedgerChanges>; rejected: Rejection[] }`, where the map key is the scope.
- `writeLedgerChanges(root: string, scope: string, changes: LedgerChanges): Promise<{ path: string; written: boolean; stats: ReturnType<typeof applyLedgerChanges>['stats'] }>`. It uses an in-process queue plus `withLock(<root>/.specify/memory/relations/.lock)`, re-reads inside the lock, and writes with `writeAtomic` only when the text changed.

**Read first:** plan.md § "Tool contracts" › `save_relations` and § "Ledger format".

- [ ] T040 [P] [US2] Write failing tests:
  - `FR-014: each rejection reason is produced by one crafted item, and valid items in the same input still produce changes`;
  - `FR-014: concepts defined in the same input are valid endpoints`;
  - `FR-015: relations go to the scope of their source (concept source → project), coverage to the unit's scope`;
  - `FR-016: a covered hash that differs from the unit's → stale`;
  - `US2-AS6: an INFERRED save of a triple REJECTED in the ledgers → previously_rejected`;
  - `FR-015: writeLedgerChanges creates the file, then a second identical call reports written=false`.
- [ ] T041 [US2] Implement.
- Verify: `npx vitest run tests/unit/graph-relations.test.ts tests/unit/graph-repository.test.ts`.
- Commit: `feat(graph): validate and store extracted relations, concepts and coverage` + `Refs: SW-10`

### Task 21: Tools `extraction_batch` and `save_relations`

**Model tier**: standard.

**Files:**
- Create: `src/graph/tools/extraction-batch.ts`, `src/graph/tools/save-relations.ts`
- Modify: `src/graph/index.ts`, `tests/contract/server.test.ts` (add 2 names)
- Test: `tests/integration/graph-extraction.test.ts`

**Interfaces (produces):** `runExtractionBatch` and `runSaveRelations`, with the descriptions and contracts of plan.md § "Tool contracts". `save_relations` uses `deps.now()` with `localDate`.

- [ ] T042 [US2] Write failing integration tests on the brain fixture:
  - `US2-AS1`: plan mode returns every unit once, and batches are within budget;
  - `US2-AS2`: fetch mode returns content, hash, instructions and candidates (including `concept:album-ordering`);
  - `US2-AS3`: save 2 relations, 1 concept and the batch's covered hashes, then `query_graph` shows the new INFERRED tuples with score, and the plan no longer lists those units;
  - `US2-AS4`: a mixed valid and invalid save writes the valid items and returns `rejected` with index and reason;
  - `US2-AS6`: re-saving with a new score changes one row; saving REJECTED removes the edge and blocks a later INFERRED save;
  - `SC-002`: after covering every unit, plan shows `pending: 0`; editing one `##` section of one file makes `pending: 1`;
  - `SC-006`: one new relation into an existing ledger is a one-line diff;
  - `Review Focus 3`: a unit deleted between plan and fetch is returned in `deferred`, and a unit edited between fetch and save is rejected as `stale`;
  - `Review Focus 5`: with `maxResponseChars: 3000`, fetching a huge unit plus a small one defers the huge one and returns the small one whole.
- [ ] T043 [US2] Implement the two tools and register them.
- Verify: `npm test` is green.
- Commit: `feat(graph): add extraction_batch and save_relations` + `Refs: SW-10`

### Task 22: Concurrent ledger writes across processes

**Model tier**: standard.

**Files:**
- Create: `tests/load/graph.load.test.ts`
- Read: `tests/load/stdio-client.ts` (reuse `startServer(root)`)

- [ ] T044 [US2] Write `US2-AS5: two stdio server processes each save 50 distinct relations into the same project ledger concurrently; afterwards the ledger parses with 0 invalid rows and has all 100 relations` (plus the fixture's own). It should pass against the implementation of Task 20. If it fails, fix `writeLedgerChanges` (Task 20's code) in this task, with the failing evidence recorded.
- Verify: `npm run test:load` is green.
- Commit: `test(graph): cover concurrent ledger writes across processes` + `Refs: SW-10`

**Checkpoint**: US1 and US2 work. This is the full P1 scope.

---

## Phase 5: User Story 3 - See the shape of the project (Priority: P2)

**Goal**: `graph_report` gives stats, god nodes, communities, surprising connections, questions and a community drill-down.

**Independent Test**: the report is identical across two processes, and a community id lists its members.

### Task 23: Analysis heuristics

**Model tier**: standard.

**Files:**
- Create: `src/graph/analyze.ts`
- Test: `tests/unit/graph-analyze.test.ts`

**Interfaces (produces):**
- `godNodes(graph, top: number): Array<{ id; kind; label; degree }>`
- `surprisingConnections(graph, communities: Communities, top: number): Array<{ edge: EdgeTuple; score: number; why: string }>`
- `suggestQuestions(graph, communities: Communities): Array<{ type: 'ambiguous_edge' | 'bridge' | 'verify_inferred' | 'isolated' | 'low_cohesion'; question: string; nodes: string[] }>`
- `cohesion(graph, members: string[]): number`
- `bridges(graph, communities: Communities, id: number): Array<{ id; label; communities: number[] }>`

**Read first:** plan.md § "Community detection and analysis".

- [ ] T045 [P] [US3] Write failing tests:
  - `FR-017: godNodes ignores contains/belongs_to and file/artifact/feature nodes`;
  - `FR-018: surprisingConnections scores per the table, keeps one edge per community pair, and every result has a why`;
  - `FR-018: suggestQuestions interleaves generator types, at most 7`;
  - `FR-018: cohesion of a triangle is 1`;
  - `FR-017: bridges lists members linked to other communities, most connected first`.
- [ ] T046 [US3] Implement.
- Verify: `npx vitest run tests/unit/graph-analyze.test.ts`.
- Commit: `feat(graph): find god nodes, surprising links and questions` + `Refs: SW-10`

### Task 24: Tool `graph_report`

**Model tier**: cheap.

**Files:**
- Create: `src/graph/tools/graph-report.ts`
- Modify: `src/graph/index.ts`, `tests/contract/server.test.ts`
- Test: `tests/integration/graph-report.test.ts`

- [ ] T047 [US3] Write failing tests:
  - `US3-AS1: counts by kind, relation and confidence, god nodes, communities, surprising and questions are present on the brain fixture`, plus `stats.extraction` = units, pending and covered;
  - `US3-AS2: the report is byte-identical in a new server instance (resetGraphCache between)`;
  - `US3-AS3: with community 0 it returns members (paged) and bridges, and an unknown id → INVALID_INPUT with hint`.
- [ ] T048 [US3] Implement `graph_report` per plan.md § "Tool contracts" › `graph_report` and register it.
- Verify: `npm test` is green.
- Commit: `feat(graph): add graph_report` + `Refs: SW-10`

---

## Phase 6: User Story 4 - Keep the brain healthy (Priority: P2)

**Goal**: `lint_memory` lists broken and ambiguous links, dangling relations, invalid rows, contradictions and orphans.

**Independent Test**: seed one problem of each kind into the fixture and see each one reported once.

### Task 25: Lint and the `lint_memory` tool

**Model tier**: standard.

**Files:**
- Create: `src/graph/lint.ts`, `src/graph/tools/lint-memory.ts`
- Modify: `src/graph/index.ts`, `tests/contract/server.test.ts`
- Test: `tests/unit/graph-lint.test.ts`, `tests/integration/graph-lint.test.ts`

**Interfaces (produces):**
- `type Issue = { kind: LintKind; severity: 'error' | 'warning' | 'info'; path: string; line?: number; node?: string; message: string; fix: string }`
- `lintGraph(graph: Graph, feature?: string): Issue[]`, which combines `graph.diagnostics` with graph-level checks (orphans, duplicate labels, contradictions, AMBIGUOUS rows, stale coverage per scope).
- `runLintMemory`

- [ ] T049 [P] [US4] Write failing unit tests: severity mapping per FR-019; sort order; orphan rules; duplicate labels are case-insensitive; one `stale_coverage` issue per scope with a count.
- [ ] T050 [US4] Write failing integration tests:
  - `US4-AS1`: `[[missing-note]]` in a note and `[text](../notes/gone.md)` in a decision → 2 `broken_link` errors with path and line;
  - `US4-AS2`: a ledger row targeting `task:001-photo-albums/T999` → `dangling_relation`, and the edge is absent from `get_node`;
  - `US4-AS3`: an AMBIGUOUS row and a `contradicts` row are listed, and `feature: "002-sharing"` keeps only that feature's issues;
  - `FR-019`: an ambiguous wikilink → `ambiguous_link` with both candidate paths in the message.
- [ ] T051 [US4] Implement `lint.ts` and the tool, and register it.
- Verify: `npm test` is green.
- Commit: `feat(graph): add lint_memory` + `Refs: SW-10`

---

## Phase 7: User Story 5 - Fast on large projects (Priority: P2)

**Goal**: Prove SC-003 on the perf datasets. The cache itself was built in Task 13.

**Independent Test**: `npm run test:load` reports the graph timings within budget.

### Task 26: Graph performance and scale

**Model tier**: standard (most capable if a budget fails and profiling is needed).

**Files:**
- Modify: `tests/perf/dataset.ts` (optional `{ links: true }`)
- Create: `tests/perf/graph.perf.test.ts`
- Modify: `tests/load/graph.load.test.ts`

- [ ] T052 [US5] Extend `speckitDataset(features, notes, decisions, opts?)` with `opts.links`. When it is set:
  - each decision body mentions `FR-001` and links `[[m-<i>]]` to a note;
  - each note mentions `<feature id>/FR-002`;
  - each tasks.md has one `[US1]` task citing `FR-003`.

  Write `tests/perf/graph.perf.test.ts`, which logs `[perf] …` lines like the existing perf suites:
  - `SC-003: cold build (cache off) of 500 features + 1,000 notes < 1.5 s`;
  - `SC-003: warm query_graph, get_node, find_path < 200 ms each (median of 5)`;
  - `SC-003: first query_graph of a new instance with a snapshot < 600 ms`;
  - `SC-003: first graph_report < 1.5 s, repeated < 300 ms`.

  All of these use `factor` for CI.
- [ ] T053 [US5] In `tests/load/graph.load.test.ts`, add `SC-003: 2,000 features + 5,000 notes cold build < 6 s without errors`.
- [ ] T054 [US5] Run `npm run test:load`. If any budget fails, profile with `--cpu-prof`, fix the hot function (likely the inverted index, the link index or Louvain aggregation) without changing outputs, and re-run. Copy the measured numbers into the scratch notes for `docs/tdd/phase-5.md`.
- Verify: `npm run test:load` is green.
- Commit: `test(graph): add performance and scale budgets for the graph` + `Refs: SW-10` (and `perf(graph): …` for any optimization)

---

## Phase 8: User Story 6 - Bring existing Markdown notes into the brain (Priority: P2)

**Goal**: The `graph.include` folders become read-only `doc` nodes.

**Independent Test**: With `include: ["docs"]` the ADR is a `doc` node linked to decision 0001. Without it, nothing in `docs/` is read.

### Task 27: Included Markdown folders

**Model tier**: standard (security-sensitive reads).

**Files:**
- Modify: `src/graph/repository.ts` (`discoverSources` lists `listMarkdownTree(<root>/<dir>)` for each include, as kind `doc`, reading through `resolveWithin(root, path, [...ALLOWED_TOP_LEVEL, ...include])`)
- Test: `tests/integration/graph-include.test.ts`

- [ ] T055 [US6] Write failing tests:
  - `US6-AS1: with include ["docs"], get_node "docs/adr/0001-storage.md" is a doc node with links_to decision:0001`;
  - `US6-AS2: an included folder containing a symlink to a folder outside the root, a .git/ and node_modules/ reads none of them`; spy on `readSource` paths, or put a sentinel file whose content would create a node;
  - `US6-AS3: without include, no node has a path outside specs/ and .specify/`;
  - `Review Focus 4: include pointing at a symlink that leaves the root → PATH_OUTSIDE_ROOT on the first graph call, no node created`.
- [ ] T056 [US6] Implement include discovery and reads.
- Verify: `npm test` is green.
- Commit: `feat(graph): read Markdown folders listed in graph.include` + `Refs: SW-10`

---

## Phase 9: User Story 7 - Use it without MCP or Obsidian, or with Obsidian (Priority: P3)

**Goal**: JSON, a Markdown report with Mermaid, an Obsidian vault, and a CLI with the same JSON as the tools.

**Independent Test**: CLI output equals tool output. A second export writes nothing. User notes in the vault are never overwritten.

### Task 28: Export renderers

**Model tier**: standard.

**Files:**
- Create: `src/graph/mermaid.ts`, `src/graph/export-json.ts`, `src/graph/export-report.ts`, `src/graph/export-obsidian.ts`
- Test: `tests/unit/graph-mermaid.test.ts`, `tests/unit/graph-export.test.ts`

**Interfaces (produces):**
- `type ExportFile = { path: string; content: string }`
- `mermaidFlowchart(nodes: GraphNode[], edges: GraphEdge[]): string`
- `renderGraphJson(graph: Graph, communities: Communities, generator: string): ExportFile`
- `renderReport(graph: Graph, communities: Communities, issues: Issue[]): ExportFile`
- `renderVault(graph: Graph, communities: Communities, vaultDir: string): ExportFile[]`

**Read first:** plan.md § "Exports".

- [ ] T057 [P] [US7] Write failing tests:
  - `FR-020: mermaid caps at 40 nodes and 100 edges, quotes labels with #quot;, and uses --> for EXTRACTED and -.-> for INFERRED`;
  - `FR-020: graph.json has schema, generator, nodes, links and communities, with no timestamp, identical on two renders`;
  - `US7-AS4: the report has the section headings of plan.md § Exports and one mermaid block per top community`;
  - `FR-020: the vault has one note per non-file node at <kind>/<slug>.md with frontmatter id/kind/community, Links lines as wikilinks with aliases, and _community-<n>.md notes`;
  - `Review Focus 2: an accented label yields an ASCII slug path and keeps the label in the title`;
  - `FR-020: "#tag" in an excerpt is escaped`.
- [ ] T058 [US7] Implement the renderers.
- Verify: `npx vitest run tests/unit/graph-mermaid.test.ts tests/unit/graph-export.test.ts`.
- Commit: `feat(graph): render graph.json, a Markdown report and an Obsidian vault` + `Refs: SW-10`

### Task 29: Tool `export_graph`

**Model tier**: standard.

**Files:**
- Create: `src/graph/tools/export-graph.ts`
- Modify: `src/graph/repository.ts` (add `writeExport(root: string, target: { kind: 'file'; path: string } | { kind: 'vault'; dir: string }, files: ExportFile[]): Promise<{ written: number; unchanged: number; removed: number; skipped: string[] }>`, which has manifest handling for the vault and writes through `resolveWithin` with `[GRAPH_DIR]` or `[vaultDir]`), `src/graph/index.ts`, `tests/contract/server.test.ts`
- Test: `tests/integration/graph-export.test.ts`

- [ ] T059 [US7] Write failing tests:
  - `US7-AS3: obsidian export twice → the second run reports written 0; a user note placed in the vault (not in the manifest) is reported in skipped and unchanged; .obsidian/ is never created; owned notes for deleted nodes are removed`;
  - `US7-AS4: report export writes .specify/graph/GRAPH_REPORT.md`;
  - `FR-020: json export writes .specify/graph/graph.json`;
  - `FR-021: vaultDir "brain" exports to brain/ and no other path outside .specify/ is written`.
- [ ] T060 [US7] Implement `writeExport` and the tool, and register it.
- Verify: `npm test` is green.
- Commit: `feat(graph): add export_graph` + `Refs: SW-10`

### Task 30: The `graph` CLI subcommand

**Model tier**: standard.

**Files:**
- Create: `src/cli/args.ts`, `src/cli/graph.ts`
- Modify: `src/index.ts`
- Test: `tests/unit/cli-args.test.ts`, `tests/contract/graph-cli.test.ts`

**Interfaces (produces):**
- `parseGraphArgs(argv: string[]): { tool: string; args: Record<string, unknown> } | { usage: string }`
- `runGraphCli(argv: string[], env: Record<string, string | undefined>, cwd: string, write: (text: string) => void): Promise<number>`

**Read first:** plan.md § "CLI".

- [ ] T061 [P] [US7] Write failing tests:
  - unit `FR-022: parses every command and option of the CLI table; an unknown option or a missing argument → usage`;
  - contract (spawn `node dist/index.js graph …` with `execFile`, `cwd` = the fixture copy):
    - `US7-AS1: graph query "album sorting" --feature 001-photo-albums prints the same JSON text as query_graph and exits 0; an ambiguous node exits 3; an unknown one exits 4`;
    - `US7-AS2: graph lint exits 1 with a broken link and 0 without`;
    - `FR-022: no subcommand still serves MCP over stdio` (the existing contract tests cover it; assert that `graph` with no command exits 2).
- [ ] T062 [US7] Implement `args.ts`, `graph.ts` and the dispatch in `src/index.ts` (`process.argv[2] === 'graph'`; exit with the returned code).
- Verify: `npm test` is green.
- Commit: `feat(cli): add the graph subcommand` + `Refs: SW-10`

---

## Phase 10: User Story 8 - Agents use the brain by default (Priority: P3)

**Goal**: Server instructions, annotations that avoid approval prompts, and a graph boost for `pack_context`.

**Independent Test**: the `initialize` result carries the instructions, every tool has `openWorldHint: false`, and `pack_context` with `graph: true` includes the linked decision.

### Task 31: Instructions, annotations and the final tool budget

**Model tier**: cheap.

**Files:**
- Modify: `src/server.ts` (`new McpServer({ name, version }, { instructions: SERVER_INSTRUCTIONS })`), every existing `src/*/tools/*.ts` annotation (plan.md § "Tool contracts" › "Changes to existing tools"), `tests/contract/server.test.ts`

- [ ] T063 [US8] Write failing contract tests:
  - `US8-AS1 / FR-023: the initialize result's instructions are ≤ 1,200 chars and name query_graph, get_node and extraction_batch` (via `client.getInstructions()`, or the SDK's equivalent accessor);
  - `FR-029: every tool has annotations.openWorldHint === false`, read tools have `readOnlyHint: true`, and `save_relations`, `export_graph` and `set_task_status` have `destructiveHint: false`;
  - `FR-025 / SC-005: exactly the 18 tools of FR-025, ≤ 1,200 chars each, ≤ 16,000 in total, ≤ 2 sentences each`.
- [ ] T064 [US8] Implement: pass the instructions and update the annotations.
- Verify: `npm test` is green.
- Commit: `feat(server): send agent instructions and mark tools as closed-world` + `Refs: SW-10`

### Task 32: `pack_context` follows the graph

**Model tier**: standard.

**Files:**
- Create: `src/context/graph-boost.ts`
- Modify: `src/context/tools/pack-context.ts`
- Test: `tests/unit/context-graph-boost.test.ts`, `tests/integration/context-pack.test.ts`

**Interfaces (produces):** `boostByGraph(pinned: ContextItem[], ranked: ContextItem[], graph: Graph): ContextItem[]`. It returns the new ranked list, re-sorted with the existing comparator.

**Read first:** plan.md § "Tool contracts" › "Changes to existing tools".

- [ ] T065 [P] [US8] Write failing tests:
  - unit `FR-024: an item linked to a top-3 item gets max(score, 0.5 × seed score); boosts do not stack; pinned items are not seeds`;
  - integration `US8-AS2: on the brain fixture, pack_context { task: "album sorting", feature: "001-photo-albums", graph: true } includes decision 0001 (ref "0001"); without graph the response equals the response before this change` (snapshot the JSON in the test).
- [ ] T066 [US8] Implement `graph-boost.ts` and the `graph` flag. The description stays ≤ 2 sentences.
- Verify: `npm test` is green.
- Commit: `feat(context): boost pack_context items linked in the graph` + `Refs: SW-10`

---

## Phase 11: Polish & Cross-Cutting Concerns

### Task 33: End-to-end over stdio, determinism and dogfood

**Model tier**: standard.

**Files:**
- Create: `tests/contract/graph-workflow.test.ts`
- Modify: `tests/integration/repository-dogfood.test.ts`

- [ ] T067 Write `tests/contract/graph-workflow.test.ts`:
  - `SC-004: over stdio on the brain fixture: query_graph → extraction_batch plan → fetch batch 1 → save_relations → query_graph shows the INFERRED edge → a second server process shows it too → graph_report and lint_memory succeed`;
  - `FR-026: query_graph, get_node, find_path, graph_report and lint_memory give byte-identical text in two processes`.

  In the dogfood test, add `SC-007: lint_memory on the repository copy reports 0 broken_link` and keep the 10-feature list. Also add `SC-001: five relation questions on the repository copy`:
  - pick 5 questions whose answers live in the stable, implemented content (decisions 0001–0013, specs 001–009), for example "token estimate budget" (decision 0007 with its context-pack requirement and task);
  - write down each question's expected node ids;
  - assert that each `query_graph` (`budget_tokens: 1500`) returns them, and that `used_tokens × 3 ≤ Σ ceil(chars/4)` of the distinct files that hold those nodes.
- [ ] T068 Fix whatever T067 reveals, in the module that owns it. Any change needs a failing test first.
- Verify: `npm test` and `npm run test:load` are green.
- Commit: `test(graph): add the stdio second-brain workflow and dogfood lint` + `Refs: SW-10`

### Task 34: Documentation and governance

**Model tier**: standard.

**Files:**
- Modify: `.specify/memory/constitution.md`, `docs/01-prd.md`, `docs/02-trd.md`, `docs/03-roadmap.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `CHANGELOG.md`, `package.json`
- Create: `AGENTS.md`

**Read first:** plan.md § "Governance updates", § "Server instructions" and § "CLI".

- [ ] T069 [P] Amend `.specify/memory/constitution.md` to v2.0.0, with the exact text of plan.md § "Governance updates", and set the footer date to the commit date.
- [ ] T070 [P] Update `docs/01-prd.md` as listed in plan.md § "Governance updates": N4, NFR-2, NFR-3, NFR-6, NFR-7, new FR-12 to FR-19, §7, §8 and §12.
- [ ] T071 [P] Update `docs/02-trd.md` (§1, §2, §3, §5, §7, §8, §10, §13) and `docs/03-roadmap.md` (Phase 5 row; remove the "cache for very large projects" item from "Next").
- [ ] T072 [P] Update `README.md`:
  - the tools table (18);
  - a "Second brain" section: MCP usage, CLI, report on GitHub, Obsidian vault, `graph.include`, `graph.vaultDir`, and how to check that Obsidian shows a vault at a hidden path;
  - an "Agent instructions" snippet for `AGENTS.md`/`CLAUDE.md` (the SERVER_INSTRUCTIONS text under `## Specwright`);
  - a Codex `config.toml` example:

    ```toml
    [mcp_servers.specwright]
    command = "npx"
    args = ["-y", "specwright-mcp"]
    ```

    Or `node` with the built path when installed from source; match the README's existing install method.

  Also update `CONTRIBUTING.md` (remove the 10-tool limit and add the budgets) and `CLAUDE.md` ("18 tools", "four roadmap phases plus the second brain", the structure list with `src/graph/` and `src/cli/`). Create `AGENTS.md` with the same working rules as `CLAUDE.md` plus the snippet, kept under 4 KB.
- [ ] T073 [P] Add a `CHANGELOG.md` 0.3.0 entry (Added: the 8 tools, CLI, exports, config; Changed: annotations, pack_context `graph`, constitution 2.0.0). Bump `package.json` to `0.3.0` and mention the knowledge graph in its description.
- Verify: `npm test` is green (the contract test reads the version from package.json); every relative link in the edited docs resolves (`lint_memory` with `graph.include: ["docs"]` on a copy reports 0 `broken_link`).
- Commit: `docs: document the second brain and amend the constitution to 2.0.0` + `Refs: SW-10`

### Task 35: TDD record, verification and close

**Model tier**: cheap.

**Files:**
- Create: `docs/tdd/phase-5.md`
- Modify: `specs/010-second-brain/spec.md` (status), `specs/010-second-brain/tasks.md` (checkboxes)

- [ ] T074 Write `docs/tdd/phase-5.md` in the format of `docs/tdd/phase-4.md`: a RED → GREEN table per task group, a requirement and scenario → tests map (every FR-001…FR-030, SC-001…SC-007, USn-ASm), and the perf and load results from T054.
- [ ] T075 Run `npm run typecheck`, `npm test` and `npm run test:load`, and paste the summary lines into the TDD record. Run `check_against_spec` for `010-second-brain` with the branch diff (`git diff main...HEAD`), and confirm every FR, SC and scenario is covered.
  - Known issue, outside this feature: with this spec's size, `respond()` trims the first array field (`requirements`) to zero and sets `truncated: true`.
  - Work around it by reading the requirements with `get_artifact` (`artifact: "spec"`, `section: "Requirements"`), or by running the check on a copy whose `.specify/specwright.json` sets `maxResponseChars: 80000`.
  - Do not change `respond()` in this feature.
- [ ] T076 Record the non-obvious decisions with `log_decision` (feature `010-second-brain`), one each:
  - R2 (Markdown ledgers as source of truth);
  - R5 + R6 (client-side extraction with coverage hashes in Git);
  - R7 (fingerprint-validated cache, no Redis);
  - R11 (reject, never delete);
  - R13 (deterministic Louvain plus component split);
  - R17 (tool surface and budgets after removing the cap).

  Set `**Status**: Implemented` in `spec.md`, and make sure every task here is `[X]`.
- Verify: `list_features` shows `010-second-brain` valid with every task done. CI is green.
- Commit: `docs: record the second-brain TDD evidence and close SW-10` + `Refs: SW-10`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup and blocks every story. Inside it the order is Task 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14. Tasks 6–10 depend only on Task 5 (and 3, 4), so they can be reordered.
- **US1 (Phase 3)**: Tasks 15 → 16 → 17 → 18.
- **US2 (Phase 4)**: needs Task 18 (tool registration pattern, `graph/index.ts`). Tasks 19 → 20 → 21 → 22.
- **US3 (Phase 5)**: needs Task 14. Tasks 23 → 24.
- **US4 (Phase 6)**: needs Task 12 (diagnostics). Task 25.
- **US5 (Phase 7)**: needs Tasks 18, 21 and 24 (it times their tools).
- **US6 (Phase 8)**: needs Task 13.
- **US7 (Phase 9)**: Task 28 needs 23 and 25 (report content). Task 29 needs 28. Task 30 needs every tool it wraps (18, 24, 25, 29).
- **US8 (Phase 10)**: Task 31 needs every tool to exist (it asserts all 18). Task 32 needs Task 13.
- **Polish (Phase 11)**: after all stories. Task 34 can start once Task 31 has fixed the tool list.

### Within each task

- The test task (`T`, odd-numbered in most groups) runs first and must fail for the expected reason. The implementation follows, then the Verify command, then one commit.
- Never mark a `T###` done before its task review is clean.

### Parallel Opportunities

- `[P]` marks test tasks and independent files. Under subagent-driven development implementers run one at a time, so `[P]` matters only for manual or team execution.
- After Phase 2, US3 (Tasks 23–24), US4 (Task 25) and US6 (Task 27) touch disjoint files and can be reordered freely.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 and Phase 2 (Tasks 1–14).
2. Phase 3 (Tasks 15–18).
3. **Stop and validate:** an agent can call `query_graph`, `get_node` and `find_path` on the brain fixture and on this repository.

### Incremental Delivery

1. US1, the explicit graph (MVP).
2. US2, the semantic layer and the token cache.
3. US3 and US4: report and lint.
4. US5 and US6: scale and included folders.
5. US7 and US8: views, CLI and agent guidance.
6. Polish: end-to-end, docs, governance and close.

Each stage keeps `npm test` green and is a valid stopping point.
