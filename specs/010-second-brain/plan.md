# Implementation Plan: Second brain (project knowledge graph)

**Branch**: `feature/SW-10-second-brain` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-second-brain/spec.md`. Research and decisions R1–R18: [research.md](research.md). Tasks: [tasks.md](tasks.md).

This plan also holds the data model and the tool contracts (normally `data-model.md` and `contracts/`), so that the feature has four documents. Every `##` section can be read on its own with `get_artifact` (`artifact: "plan"`, `feature: "010-second-brain"`, `section: "<heading>"`).

## Summary

Add a `src/graph/` module that turns the files Specwright already reads (Spec Kit features, the constitution, decisions, notes) into a typed knowledge graph, plus optional extra Markdown folders.

- **Explicit layer:** `EXTRACTED` edges are derived from ids, task labels, frontmatter, Markdown links, wikilinks and cited paths, with no model.
- **Semantic layer:** `INFERRED` and `AMBIGUOUS` edges and concepts are produced by the user's own agent through `extraction_batch` (plan or fetch) and `save_relations`. They are stored in Markdown ledgers in `.specify/memory/relations/` together with per-section coverage hashes, so no content is ever analyzed twice.
- **Speed cache:** the graph is cached in memory and refreshed per changed file (by size and mtime), with a disk snapshot in `.specify/graph/cache.json`.
- **Tools:** agents query it through 8 new MCP tools. People and CI use a `graph` CLI subcommand, a Markdown report with Mermaid diagrams, `graph.json`, or an optional Obsidian vault.
- **Small changes elsewhere:**
  - `pack_context` gains an opt-in graph boost;
  - every tool gets `openWorldHint: false`;
  - the server sends `instructions`;
  - the constitution moves to v2.0.0 (principles III, IV and VI).

## Technical Context

**Language/Version**: TypeScript (strict, ESM) on Node.js ≥ 22.12

**Primary Dependencies**: `@modelcontextprotocol/server` v2 (2.3.x: `new McpServer(info, { instructions })`), `zod` v4 and `yaml` v2. **No new runtime dependency.** Louvain, hashing (`node:crypto`), Markdown table I/O and Mermaid rendering are written in plain TypeScript.

**Storage**: Markdown in the target repository.
- Read: `specs/**`, `.specify/memory/**` and `graph.include` folders.
- Written:
  - `.specify/memory/relations/*.md` (Git-versioned ledgers);
  - `.specify/graph/**` (derived and git-ignored: `cache.json`, `graph.json`, `GRAPH_REPORT.md`, `vault/`);
  - the configured `graph.vaultDir`.

**Testing**: Vitest.
- Unit tests for every pure file.
- Integration tests through the in-process client on `tests/fixtures/brain/`.
- Stdio contract tests (tool budgets, instructions, CLI).
- Perf and load suites in `npm run test:load`.

**Target Platform**: a local MCP stdio server and CLI on Linux, macOS and Windows.

**Project Type**: CLI-launched MCP server (single project).

**Performance Goals** (SC-003), with 500 features and 1,000 notes:

| Operation | Budget |
|---|---|
| Cold build | < 1.5 s |
| Warm `query_graph`, `get_node`, `find_path` | < 200 ms |
| First query of a new process with a snapshot | < 600 ms |
| First `graph_report` | < 1.5 s |
| Repeated `graph_report` | < 300 ms |
| Cold build, 2,000 features and 5,000 notes | < 6 s |

**Constraints**:
- no network, no `child_process`, no LLM;
- nothing written to stdout in server mode;
- deterministic outputs;
- `tools/list` ≤ 16,000 characters, ≤ 1,200 characters per tool, ≤ 2 sentences per description;
- tool input schemas well under Codex's 5,000-byte compaction threshold.

**Scale/Scope**: up to 2,000 features, 5,000 notes and ~75k nodes / ~150k edges.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate (constitution v1.0.0) | Status |
|---|---|
| I. Specs live in the repository | ✅ Ledgers are Markdown tables in `.specify/memory/relations/`. Derived files are rebuildable. |
| II. No LLM in the server | ✅ The client agent extracts. The server plans, validates and stores. |
| III. Few, well-described tools (≤ 10) | ❌ 18 tools. **The owner removed the cap** (spec Clarifications). The principle is amended (see Governance updates). |
| IV. No database, no cache | ❌ In-memory and disk caches. Amended to "files are the source of truth": derived, rebuildable, fingerprint-validated caches only. |
| V. Test-first (NON-NEGOTIABLE) | ✅ Every task group in tasks.md starts with failing tests named after FR or scenario ids. |
| VI. Safe file access | ❌ New read area (`graph.include`) and new write areas (`.specify/graph/**`, `graph.vaultDir`). Amended with the same guard guarantees. |

Post-design re-check: ✅ against the amended constitution v2.0.0 (text in "Governance updates"). The amendment ships in this feature (FR-030, tasks T069–T073), and Complexity Tracking justifies it.

## Project Structure

### Documentation (this feature)

```text
specs/010-second-brain/
├── spec.md       # what and why (FR-001…FR-030, SC-001…SC-007)
├── research.md   # deep research report and decisions R1–R18
├── plan.md       # this file: design, data model, contracts
└── tasks.md      # Spec Kit tasks, grouped as Superpowers "Task N" units
```

### Source Code (repository root)

```text
src/
├── index.ts                    # MODIFY: `graph` subcommand → CLI, otherwise stdio server
├── server.ts                   # MODIFY: instructions + graph.register
├── config.ts                   # MODIFY: Config.graph { include, cache, vaultDir } + validation
├── errors.ts                   # MODIFY: NODE_NOT_FOUND, NODE_AMBIGUOUS
├── storage/
│   ├── paths.ts                # MODIFY: resolveWithin(root, rel, prefixes), isSafeRelativeDir(rel)
│   ├── files.ts                # MODIFY: statIfExists, listMarkdownTree, writeAtomicIfChanged
│   ├── hash.ts                 # NEW: contentHash(text)
│   └── text.ts                 # MODIFY: citedPaths(text) (moved from context/files.ts)
├── features/spec-parser.ts     # MODIFY: export STORY_LINE, ITEM_LINE
├── decisions/repository.ts     # MODIFY: export parseDecision(name, raw), DECISION_FILE
├── memory/repository.ts        # MODIFY: export parseMemory(name, raw)
├── context/
│   ├── files.ts                # MODIFY: use storage/text citedPaths (same behavior)
│   ├── graph-boost.ts          # NEW: boostByGraph(pinned, ranked, graph)
│   └── tools/pack-context.ts   # MODIFY: graph?: boolean
├── graph/                      # NEW module
│   ├── types.ts                # entities and constants
│   ├── ids.ts                  # node id builders, parseNodeId, scopeOfNode
│   ├── schemas.ts              # zod input schemas shared by graph tools
│   ├── mentions.ts             # findMentions(line)
│   ├── links.ts                # parseLinks(line) → wikilinks, Markdown links, relation lines
│   ├── units.ts                # unitsOf(...), unitContent(...)
│   ├── facts-feature.ts        # facts of spec/plan/tasks/research/data-model/quickstart/contracts
│   ├── facts-memory.ts         # facts of constitution, decisions, notes, docs
│   ├── ledger.ts               # parseLedger, applyLedgerChanges, escapeCell
│   ├── facts.ts                # factsOf(source, raw) dispatcher (+ ledger facts)
│   ├── link-index.ts           # buildLinkIndex, resolveWiki, resolveMarkdown
│   ├── build.ts                # buildGraph(facts[]) → Graph
│   ├── graph.ts                # neighbors(), degree(), edgeTuple()
│   ├── node-ref.ts             # resolveNodeRef(graph, ref, feature?, options)
│   ├── search.ts               # scoreNodes(graph, question)
│   ├── traverse.ts             # traverse(graph, seeds, options)
│   ├── budget.ts               # fitToBudget(...)
│   ├── query.ts                # queryGraph(graph, input)
│   ├── path.ts                 # shortestPath(graph, from, to, options)
│   ├── community.ts            # detectCommunities(graph)
│   ├── analyze.ts              # godNodes, surprisingConnections, suggestQuestions, bridges, cohesion
│   ├── extraction.ts           # pendingUnits, planBatches, candidatesFor
│   ├── relations.ts            # prepareSave(graph, input, today): ledger changes + rejections
│   ├── instructions.ts         # EXTRACTION_INSTRUCTIONS, SERVER_INSTRUCTIONS
│   ├── lint.ts                 # lintGraph(graph, feature?)
│   ├── mermaid.ts              # mermaidFlowchart(nodes, edges)
│   ├── export-json.ts          # renderGraphJson(graph, communities, version)
│   ├── export-report.ts        # renderReport(graph, communities, analysis)
│   ├── export-obsidian.ts      # renderVault(graph, communities)
│   ├── repository.ts           # the only disk access of the module
│   ├── service.ts              # loadGraph(config), communitiesOf(graph), resetGraphCache()
│   ├── index.ts                # register(server, config, deps)
│   └── tools/
│       ├── query-graph.ts  get-node.ts  find-path.ts  graph-report.ts
│       └── extraction-batch.ts  save-relations.ts  lint-memory.ts  export-graph.ts
└── cli/
    ├── args.ts                 # parseGraphArgs(argv) (pure)
    └── graph.ts                # runGraphCli(argv, env, cwd, write) → exit code

tests/
├── fixtures/brain/             # NEW fixture (see "Fixture: brain")
├── helpers.ts                  # MODIFY: Config.graph default in connect()
├── unit/graph-*.test.ts        # one file per graph source file
├── integration/graph-*.test.ts # per tool / per story
├── contract/server.test.ts     # MODIFY: 18 tools, budgets, annotations, instructions
├── contract/graph-workflow.test.ts  # NEW: stdio end-to-end + CLI parity
├── perf/graph.perf.test.ts     # NEW
└── load/graph.load.test.ts     # NEW: 2,000 features, cross-process ledger writes
```

**Structure Decision**: one new domain module, `graph/`, following the existing pattern (types, repository, pure logic per file, `tools/<tool>.ts`). Dependency rules:
- `graph` may import the pure parsers and constants of `features`, `constitution`, `decisions` and `memory`, plus `storage`;
- `context` may import `graph` (`service`, `types`);
- `graph` never imports `context` (cited-path detection moves to `storage/text.ts`);
- `cli` imports the tool `run*` functions and `errors.respond`;
- only `server.ts` knows every module.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| III: 18 tools instead of ≤ 10 | The owner removed the cap. Each new tool answers a distinct question (R17). | One `graph` tool with a `command` argument gives a schema over Codex's compaction threshold and vague descriptions for tool search. |
| IV: in-memory cache and disk snapshot | SC-003 performance, and a fast first call per Codex subagent process (R7) | Re-reading and re-parsing every file per call: about 400 ms per call at 500 features, and more with communities. |
| VI: `graph.include` reads, `.specify/graph/**` and `graph.vaultDir` writes | Product docs and existing vaults belong in the brain (R15). Views need a place to live (R14). | Fixed read and write areas cannot reach `docs/`, and Obsidian hides `.specify/`. |

## Data model

All types live in `src/graph/types.ts`. Paths are root-relative with `/` separators. Lines are 1-based in the raw file.

```ts
export const NODE_KINDS = ['feature', 'artifact', 'requirement', 'criterion', 'story', 'task', 'principle', 'decision', 'note', 'doc', 'file', 'concept'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const DERIVED_RELATIONS = ['contains', 'implements', 'references', 'touches', 'links_to', 'belongs_to'] as const;
export const SEMANTIC_RELATIONS = ['depends_on', 'implements', 'rationale_for', 'supersedes', 'contradicts', 'refines', 'part_of', 'tests', 'uses', 'example_of', 'similar_to', 'related_to'] as const;
export type Relation = (typeof DERIVED_RELATIONS)[number] | (typeof SEMANTIC_RELATIONS)[number];

export const CONFIDENCES = ['EXTRACTED', 'INFERRED', 'AMBIGUOUS'] as const;
export type Confidence = (typeof CONFIDENCES)[number];
export type LedgerConfidence = 'INFERRED' | 'AMBIGUOUS' | 'REJECTED';

export const EXTRACTOR_VERSION = 1;  // bump when EXTRACTION_INSTRUCTIONS change meaning
export const SNAPSHOT_SCHEMA = 1;    // bump when FileFacts change shape
export const GRAPH_DIR = '.specify/graph';
export const RELATIONS_DIR = '.specify/memory/relations';

export interface GraphNode {
  id: string; kind: NodeKind; label: string;
  feature?: string;          // feature-scoped kinds and decisions with a feature
  path?: string; line?: number;
  section?: string;          // normalizeKey of the enclosing `##` heading
  heading?: string;          // that heading's text (for get_artifact's `section`)
  tags?: string[]; type?: string; done?: boolean;
  text: string;              // ≤ 2,000 chars used for scoring and excerpts
}

export interface GraphEdge {
  source: string; target: string; relation: Relation;
  confidence: Confidence; score: number;
  origin: 'derived' | 'relation-line' | 'ledger';
  path: string; line?: number; evidence?: string;
}

export type SourceKind = 'spec' | 'plan' | 'tasks' | 'research' | 'data-model' | 'quickstart' | 'contract' | 'constitution' | 'decision' | 'note' | 'doc' | 'ledger';
export interface SourceFile { path: string; kind: SourceKind; feature?: string; size: number; mtimeMs: number }

export interface Unit { id: string; node: string; path: string; section?: string; title: string; hash: string; tokens: number; scope: string }

export interface RawLink { from: string; line: number; form: 'wiki' | 'markdown'; target: string; relation?: Relation }
export type RawMention =
  | { from: string; line: number; type: 'item' | 'story' | 'task'; id: string; feature?: string }  // feature = qualifier or file scope
  | { from: string; line: number; type: 'feature'; id: string }
  | { from: string; line: number; type: 'decision'; id: string };   // 4 digits
export interface RawPath { from: string; line: number; path: string }

export interface ConceptRow { id: string; label: string; summary: string; line: number }
export interface RelationRow { source: string; relation: string; target: string; confidence: string; score: number; evidence: string; date: string; line: number }
export interface CoverageRow { unit: string; hash: string; version: number; date: string; line: number }
export interface LedgerFacts { scope: string; concepts: ConceptRow[]; relations: RelationRow[]; coverage: CoverageRow[]; invalid: Array<{ line: number; reason: string }> }

export interface FileFacts {
  path: string; kind: SourceKind; feature?: string;
  nodes: GraphNode[]; edges: GraphEdge[];          // edges fully resolved inside the file
  links: RawLink[]; mentions: RawMention[]; paths: RawPath[];
  units: Unit[]; ledger?: LedgerFacts;
  issues: Array<{ line?: number; message: string }>;
}

export type LintKind = 'broken_link' | 'dangling_relation' | 'invalid_row' | 'ambiguous_link' | 'unknown_mention' | 'duplicate_label' | 'contradiction' | 'ambiguous_relation' | 'orphan' | 'stale_coverage';
export interface Diagnostic { kind: LintKind; path: string; line?: number; node?: string; message: string; fix: string }

export interface Graph {
  version: number;                         // increments on every rebuild in this process
  nodes: Map<string, GraphNode>;           // insertion order = sorted by id
  edges: GraphEdge[];                      // sorted by source, relation, target
  out: Map<string, number[]>; in: Map<string, number[]>;  // edge indexes, sorted by (other id, relation)
  units: Map<string, Unit>;                // extraction units by id
  coverage: Map<string, CoverageRow>;      // by unit id (from ledgers)
  rejected: Set<string>;                   // "source|relation|target" keys of REJECTED rows
  diagnostics: Diagnostic[];
}
```

## Node ids and sources

| Kind | Id | Created from | Label | `path` / `line` |
|---|---|---|---|---|
| feature | `feature:<f>` | `spec.md`, or any artifact when `spec.md` is missing | spec title, or `<f>` | `spec.md`, line 1 |
| artifact | `artifact:<f>/<spec\|plan\|tasks\|research\|data-model\|quickstart>`, `artifact:<f>/contract/<stem>`, `artifact:constitution` | each file | `<feature title> — <file>`; `Constitution` | file, 1 |
| requirement | `requirement:<f>/FR-###` | `- **FR-###**: text` (spec.md) | `FR-### <text ≤ 80>` | item line |
| criterion | `criterion:<f>/SC-###` | `- **SC-###**: text` | `SC-### <text ≤ 80>` | item line |
| story | `story:<f>/US<n>` | `### User Story n - Title (Priority: Pn)` | `US<n> <title>` | heading line |
| task | `task:<f>/T###` | `tasks.md` task lines | `T### <text ≤ 80>`, `done` | task line |
| principle | `principle:<key>` | constitution `###` principles | principle name | heading line |
| decision | `decision:<NNNN>` | `.specify/memory/decisions/NNNN-*.md` | title | file, 1 |
| note | `note:<slug>` | `.specify/memory/notes/<slug>.md` | title, `type`, `tags` | file, 1 |
| doc | `doc:<path>` | `graph.include` `.md` files | first `# ` heading, else the file name | file, 1 |
| file | `file:<path>` | cited paths that are not sources | the path | none (never read) |
| concept | `concept:<slug>` | `## Concepts` rows of ledgers | label | ledger row line |

Rules:
- **Duplicate ids** (an invalid feature): the first occurrence wins, and the file gets an issue.
- **`text`:**
  - requirement, criterion and task: the item text;
  - story: the title plus its scenarios;
  - decision, note and doc: the body with comments stripped, cut to 2,000 characters;
  - artifact: its `##` headings joined by ` · `;
  - feature: title + `**Input**`;
  - principle: its content;
  - concept: label + summary;
  - file: the path.
- **Scope** of a node (`scopeOfNode`): its `feature` when set, otherwise `project`.

## Edge derivation

All edges in this section are `EXTRACTED`, with score 1.0 and origin `derived` (relation lines use origin `relation-line`).

**Owners.** Every content line has an owner node:
- in `spec.md`, a `**FR**`/`**SC**` item line belongs to that item; lines under a `### User Story` heading belong to the story until the next heading; anything else belongs to `artifact:<f>/spec`;
- in `tasks.md`, a task line and its more-indented continuation lines belong to the task; anything else belongs to `artifact:<f>/tasks`;
- in other files, the file's node owns every line.

Lines inside fences or HTML comments are skipped (use `scanLines`).

| Relation | From → to | Rule |
|---|---|---|
| `contains` | feature → each artifact, requirement, criterion, story, task | structural |
| `implements` | task → `story:<f>/US<n>` | `[USn]` label, when the story exists (otherwise an `unknown_mention` diagnostic) |
| `references` | owner → requirement, criterion, story or task | `FR-###`, `SC-###`, `US<n>`, `T###` resolved in the file's feature scope (a decision's scope is its `feature`); `<f>/FR-###` resolves anywhere; notes and docs only resolve qualified mentions |
| `references` | owner → `feature:<id>` | a token matching `FEATURE_ID_PATTERN` that is an existing feature, other than the owner's own feature |
| `references` | owner → `decision:<NNNN>` | `/\bdecisions?\s+(\d{4}(?:\s*(?:,|and|e|&|\/)\s*\d{4})*)/gi` (case-insensitive), each existing number |
| `touches` | owner → `file:<path>` | `citedPaths(line)` entries that are not known source paths. A cited path that *is* a source becomes `links_to` that source's node. |
| `links_to` | owner → node | wikilink or Markdown link resolved per "Link resolution" |
| `belongs_to` | decision → `feature:<f>` | frontmatter `feature` (or legacy `spec_id`), when the feature exists |
| `<relation>` (origin `relation-line`) | owner → node | `^\s*[-*]\s+(<relation>)\s+(<one link>)\s*$`, where `<relation>` ∈ `SEMANTIC_RELATIONS` |

Additional rules:
- **Self-edges** (owner = target) are dropped.
- **Duplicates** of a triple keep the first by (path, line).
- A mention that resolves to nothing becomes an `unknown_mention` diagnostic, only when it was scoped (feature file, decision, or qualified).

## Link resolution

`links.ts` → `parseLinks(line)` returns hits in order. Inline code spans (`` `…` ``) are blanked before matching.

- **Wikilink:** `/(!?)\[\[([^\[\]\n]+?)\]\]/g`. Inside: cut at the first `|` (alias), then at the first `#` (heading or `^block`), then trim. An empty target (a same-note heading link) is ignored. Embeds `![[…]]` count as links unless the target has an image or PDF extension.
- **Markdown link:** `/(!?)\[([^\]\n]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g`. The following are ignored:
  - `!` image links;
  - hrefs with a scheme (`/^[a-z][a-z0-9+.-]*:/i`, e.g. `http:` or `mailto:`);
  - hrefs starting with `#`.

  `#anchor` and `?query` are stripped, and the href is `decodeURIComponent`-ed (on failure, kept raw).

`link-index.ts` → `buildLinkIndex(entries: Array<{ path: string; node: string }>)` covers every source file except ledgers. Resolution:

1. **Markdown links:** `posix.normalize(join(dirname(fromPath), href))`.
   - Outside the root → `ignore`.
   - A known source path → `{ node }`.
   - Ends in `.md` but unknown → `{ missing }`.
   - Any other existing-looking relative path → `{ file: path }`, which becomes a `touches` edge to `file:<path>` (never read).
2. **Wikilinks** (case-insensitive, `.md` optional):
   1. an exact root-relative path;
   2. otherwise a unique path suffix on a `/` boundary;
   3. otherwise a unique file name without extension.

   Zero matches → `{ missing }` (diagnostic `broken_link`). Two or more → `{ ambiguous: paths }` (diagnostic `ambiguous_link`).
3. A `{ missing }` Markdown link whose href has no `.md` and no extension is ignored (it is probably a folder).

## Ledger format

One file per scope: `.specify/memory/relations/<scope>.md`, where `<scope>` is a feature id or `project`. An example of the exact shape written by `applyLedgerChanges`:

```markdown
---
scope: 001-photo-albums
---
# Relations: 001-photo-albums

Written by Specwright `save_relations`; rows may be edited by hand. Kept sorted.

## Concepts

| id | label | summary |
|---|---|---|

## Relations

| source | relation | target | confidence | score | evidence | date |
|---|---|---|---|---|---|---|
| decision:0001 | rationale_for | requirement:001-photo-albums/FR-001 | INFERRED | 0.85 | "plain files keep albums diffable" | 2026-10-24 |

## Coverage

| unit | hash | version | date |
|---|---|---|---|
| specs/001-photo-albums/spec.md#requirements | 3fa2c1d94b0e7a21 | 1 | 2026-10-24 |
```

**Cells.**
- `escapeCell`: replace `\` with `\\`, then `|` with `\|`, then CR and LF with a space, then trim.
- `unescapeCell` reverses it.
- The score is written with up to 2 decimals and no trailing zeros (`0.85`, `0.5`, `1`).

**Keys and order.** Rows are sorted by key, comparing JavaScript strings with `<` (never `localeCompare`):
- Concepts: `id`;
- Relations: `source + "\u0000" + relation + "\u0000" + target`;
- Coverage: `unit`.

**`parseLedger(path, raw)`:**
- Find the three `##` sections by key (`concepts`, `relations`, `coverage`).
- In each, read lines that start with `|`, skipping the header and the `|---` separator.
- Split on unescaped `|`.
- A row with the wrong cell count, an unknown confidence, a non-numeric score or a missing id goes to `invalid` with its line, and is skipped.
- The scope comes from the frontmatter, falling back to the file name.

**`applyLedgerChanges(raw | undefined, scope, changes)`** returns `{ text, stats }`, where `stats` has `{ added, updated, unchanged }` per table:
- With `raw` undefined, render the full file above, with empty tables plus the new rows.
- Otherwise, keep every line that is not touched:
  - replace the line of a row whose key exists and whose rendered text differs;
  - insert a new row at its sorted position inside its table (after the separator when the table is empty);
  - append a missing table section at the end of the file.
- Keep the file's line ending (CRLF when the first line ends in CRLF).
- **SC-006:** saving one new relation into an existing ledger produces exactly one added line.

**Writes** (`repository.writeLedgerChanges(root, scope, changes)` → `{ path, written, stats }`):
- an in-process promise queue plus `withLock('.specify/memory/relations/.lock')`, the same pattern as `decisions/repository.ts`;
- re-read the raw file inside the lock, apply the changes, and `writeAtomic` only when the text changed;
- add `.specify/memory/relations/.lock/` to the repository's `.gitignore`.

## Cache and refresh

`service.ts` keeps `Map<root, CacheState>`, where `CacheState = { facts: Map<path, { size, mtimeMs, facts }>, graph?: Graph, inflight?: Promise<Graph>, communities?: { version, value } }`.

`loadGraph(config)`:

1. If a refresh is in flight for this root, await it. Concurrent calls share one refresh.
2. `repository.discoverSources(root, include)` lists the source files with `stat`, in this order: feature artifacts, constitution, decisions, notes, ledgers, included docs. Feature folders must match `FEATURE_ID_PATTERN`. Only `.md` files are listed. Dot-names and `node_modules` are skipped, and symlinked directories are not followed.
3. On the first call, with `graph.cache = "disk"`, load `.specify/graph/cache.json` through `repository.readSnapshot`. A snapshot is ignored when it is missing, fails to parse, or has a different `schema` or `extractor`.
4. For each source: reuse the cached facts when `size` and `mtimeMs` are equal. Otherwise read it (through `resolveWithin`) and compute `factsOf(source, raw)`. Drop the facts of sources that disappeared.
5. If nothing changed and a graph exists, return it. Otherwise `buildGraph(allFacts sorted by path)`, increment `version`, and drop the memoized communities.
6. If anything changed and `cache = "disk"`, write the snapshot: `{ schema, extractor, files: { [path]: { size, mtimeMs, facts } } }`.
   - Write it with `writeAtomic` after `ensureGraphDir`, which creates `.specify/graph/` and a `.gitignore` containing `*\n` with `createExclusive`, ignoring `EEXIST`.
   - Snapshot write errors are logged once per process to stderr and otherwise ignored.
7. With `cache = "off"`, skip steps 3, 4 (reuse) and 6, and rebuild every call.

**Equality guarantee** (US5-AS1): a unit test builds incrementally across edit, add and delete, and compares `JSON.stringify` of nodes, edges and diagnostics with a fresh `cache: "off"` build.

`communitiesOf(graph)` memoizes `detectCommunities(graph)` by `graph.version`. `resetGraphCache()` clears the map, and `cacheStats(root)` returns `{ parsed, reused }` for the last refresh; both exist for tests only.

## Configuration

`.specify/specwright.json`, validated at startup (`loadConfig`). Errors use the same `Invalid <file>: …` message style as today:

```json
{ "maxResponseChars": 20000, "graph": { "include": ["docs"], "cache": "disk", "vaultDir": ".specify/graph/vault" } }
```

- `graph` is optional. The defaults are `DEFAULT_GRAPH_CONFIG = { include: [], cache: "disk", vaultDir: ".specify/graph/vault" }`.
- `include`: an array of ≤ 20 strings. Each must pass `isSafeRelativeDir`:
  - relative;
  - no drive letter;
  - no `..`;
  - no segment starting with `.`;
  - no `node_modules`;
  - no `.git`;
  - its first segment is not `specs` or `.specify`.

  It is normalized to `/` without a trailing slash.
- `cache`: `"disk" | "memory" | "off"`.
- `vaultDir`: either equal to or under `.specify/graph/`, or a path passing `isSafeRelativeDir` that is not under `specs/`.

**Path guard** (`storage/paths.ts`):
- `resolveWithin(root, rel, prefixes)` generalizes `resolveInside`: the same absolute, drive-letter, backslash and realpath checks, but the resolved path must be under one of `prefixes`.
- `resolveInside(root, rel)` becomes `resolveWithin(root, rel, ALLOWED_TOP_LEVEL)`, with no behavior change.
- Graph reads use `[...ALLOWED_TOP_LEVEL, ...include]`. Vault writes use `[vaultDir]`.

## Query algorithm

**`search.ts` → `scoreNodes(graph, question, feature?)`**

1. **Id hits.** Find exact node ids and short forms in the question (the same patterns as `resolveNodeRef`, without labels). Each hit scores 1000.
2. **Terms.** `tokenize(question)` (the existing function). With no terms and no id hits, return an empty list.
3. **Inverted index.** Built lazily per `graph.version`: `term → Array<[nodeId, weight]>`, where weight = 3 × occurrences in the label + 2 × in tags + min(3, occurrences in `text`). The score is the sum over unique terms.
4. **Feature scope.** With `feature`, only nodes whose `feature` equals it are seed candidates. If none scores > 0, fall back to all nodes.
5. **Seeds.** Up to 3, sorted by score desc, degree desc, id asc. A second or third seed must score ≥ half of the first.

**`traverse.ts` → `traverse(graph, seeds, { mode, depth, includeAmbiguous })`**
- **Usable edges:** EXTRACTED and INFERRED, plus AMBIGUOUS when `includeAmbiguous`. REJECTED rows are never edges.
- **Hub guard:** with `hub = max(50, degree at index floor(0.99·n) of the sorted degrees)`, a node with degree ≥ hub is not expanded unless it is a seed.
- **BFS:** level by level. A node's distance is its first-visit level. Record the edge index that discovered each node (the tree edge). Neighbors are taken in adjacency order (sorted by other id, then relation).
- **DFS:** an explicit stack, starting with the seeds in reverse seed order. Push neighbors in reverse of (score desc, id asc), so the best is popped first. A node's distance is its depth at first visit. Do not go beyond `depth`.
- **Output:** `dist: Map<id, number>` and `tree: Map<id, edgeIndex>`, plus the induced edges between visited nodes (all usable edges whose endpoints are both visited).

**`query.ts` → `queryGraph(graph, input)`**

1. **Rank nodes:**
   1. seeds in seed order;
   2. then distance asc;
   3. then the score of the node's tree edge, desc;
   4. then the node's term score, desc;
   5. then id asc.
2. **Rank edges:**
   1. tree edges first, ordered by their child node's rank;
   2. then the other induced edges by max endpoint rank, score desc, then `[source, relation, target]`.
3. **Fit.** `budget.ts` → `fitToBudget(envelope, nodes, edges, budgetTokens, pinned = seeds.length)` measures `estimate = ceil(JSON.stringify(response).length / 4)` incrementally, as `respond()` does:
   - add pinned nodes unconditionally;
   - then add nodes in rank order while they fit;
   - then add edges (only those whose endpoints are both included) while they fit.
4. **Report** `omitted: { nodes, edges }` and, when anything was omitted, `needed_budget_tokens` = the estimate of the full response.

**Edge tuple** (`graph.ts` → `edgeTuple(e)`): `[source, relation, target]` when EXTRACTED, else `[source, relation, target, confidence, score]`.

## Community detection and analysis

`community.ts` → `detectCommunities(graph): { byNode: Map<string, number>; list: Array<{ id: number; label: string; members: string[] }> }`

1. **Input graph:** undirected and weighted, using edges that are EXTRACTED or INFERRED. Weight = `score`, summed over parallel edges and both directions. Self-loops are ignored. Every node is included, even isolated ones.
2. **Louvain, deterministic** (research §5):
   - nodes indexed by sorted id;
   - gain `ΔQ = k_i,in/m − Σ_tot·k_i/(2m²)`, γ = 1;
   - visit nodes in index order;
   - candidate communities are those of the neighbors, in ascending community index, plus the node's own;
   - move only when the gain exceeds the current one by more than `1e-10`; ties keep the current community, otherwise the lowest index wins;
   - repeat the local phase until no move happens (at most 50 sweeps), then aggregate;
   - stop when a level changes nothing, or after 10 levels.
3. **Split** each final community into connected components (BFS over the input graph restricted to its members).
4. **Ids:** order communities by size desc, then smallest member id. Ids are 0…n−1. Members are sorted by id.
5. **Label:**
   - the label of the member with the highest degree (ignoring `contains` and `belongs_to` edges), excluding `file` nodes, with ties by id;
   - when one feature owns more than half of the members (by the `feature` field), prefix it: `"<feature title>: <label>"`;
   - cut to 80 characters.

`analyze.ts`:
- **`godNodes(graph, top)`:**
  - degree counts unique incident edges, ignoring `contains`, `belongs_to` and REJECTED;
  - skip `file`, `artifact` and `feature` nodes;
  - sort by degree desc, then id;
  - return `{ id, kind, label, degree }`.
- **`surprisingConnections(graph, communities, top)`:**
  - **Candidates:** usable edges whose endpoints are in different communities, excluding `contains`, `belongs_to` and edges that touch a `file` node.
  - **Score:**

    | Signal | Points |
    |---|---|
    | AMBIGUOUS | +3 |
    | INFERRED | +2 |
    | EXTRACTED | +1 |
    | different node kinds | +2 |
    | different features (both set) | +2 |
    | cross-community | +1 |
    | `similar_to` or `contradicts` | ×1.5 |
    | one endpoint has degree ≤ 2 and the other ≥ 5 | +1 |

  - Keep the best edge per unordered community pair. Sort by score desc, then the tuple.
  - Each result is `{ edge: edgeTuple, score, why }`, where `why` names the signals, for example `"INFERRED, crosses 001-photo-albums → 002-sharing, peripheral note → hub requirement"`.
- **`suggestQuestions(graph, communities)`:** up to 7 questions, interleaved round-robin across these generators, in this order:
  1. **AMBIGUOUS edges:** `Is <a> really <relation> <b>?`
  2. **Bridges:** the top 3 nodes by approximate betweenness, computed from BFS out of the 100 lowest-id non-file nodes. `Why does <x> connect <community A> and <community B>?`
  3. **Unverified hubs:** god nodes with ≥ 2 INFERRED edges. `Are the inferred links of <x> correct?`
  4. **Isolated:** decisions, notes and concepts with degree ≤ 1. `What does <x> relate to?`
  5. **Low cohesion:** communities with ≥ 5 members and cohesion < 0.15, where cohesion = intra edges / (n(n−1)/2). `Should <community> be split?`

  Each result is `{ type, question, nodes }`.
- **`bridges(graph, communities, communityId)`:** members with edges to other communities, sorted by the number of distinct other communities desc, then id. Each is `{ id, label, communities: number[] }`.

## Tool contracts

Conventions (unchanged): zod validation; compact JSON in one text block; errors as `{ code, message, hint? }` with `isError: true`; responses capped by `maxResponseChars` (arrays trimmed with `truncated: true`).

Every graph tool:
- calls `loadGraph(config)` first;
- has `annotations: { openWorldHint: false, readOnlyHint: true }`, except `save_relations` and `export_graph`, which have `{ openWorldHint: false, readOnlyHint: false, destructiveHint: false, idempotentHint: true }`;
- has an input schema whose JSON stays under 1,200 characters per tool entry.

Each tool file exports `run<Name>(config, deps, args)`, which returns the data object, and `register<Name>(server, config, deps)`, which wraps it with `tool()`. The CLI reuses `run<Name>`.

Node references (`ref`, `from`, `to`) are resolved by `resolveNodeRef(graph, ref, feature?, { allowLabel: true })` (FR-012):
1. an exact id;
2. a short form:
   - `^(<feature>)/(FR|SC)-\d{3,}$`, `^(<feature>)/US\d+$` and `^(<feature>)/T\d{3,}$`;
   - `FR-###`, `SC-###`, `US<n>` and `T###` when `feature` is given;
   - `^\d{4}$` → `decision:<n>`;
   - `^[a-z0-9-]+$` → `note:<x>`, then `feature:<x>`;
   - a source path → its node;
3. labels (only when `allowLabel`): a case-insensitive exact match;
4. otherwise:
   - several matches at one level → `NODE_AMBIGUOUS`, hint `Candidates: <up to 10 ids>`;
   - none → `NODE_NOT_FOUND`, hint `Closest: <up to 5 ids by term score>` or `Call query_graph to search.`.

### `query_graph`
- **Description**: "Answer a question about the project from its knowledge graph of specs, tasks, decisions, notes and cited files, returning a small ranked subgraph within a token budget. Call it before reading whole files or searching, and read only the files it points to."
- **In**: `{ question: string(1..500), feature?: featureId, mode?: "bfs"|"dfs" = "bfs", depth?: int 1..4 = 2, budget_tokens?: int 200..20000 = 1500, include_ambiguous?: boolean = false }`. The budget is capped at `floor((maxResponseChars − 500) / 4)`.
- **Out**: `{ question, seeds: string[], nodes: [{ id, kind, label, d, path?, line? }], edges: Array<[s, r, t] | [s, r, t, confidence, score]>, budget_tokens, used_tokens, omitted: { nodes, edges }, needed_budget_tokens?, hint? }`.
- With no seeds, the result has empty arrays and `hint: "No node matches; try different words, get_node with an id, or search_memory."`.
- **Errors**: `INVALID_INPUT` (`question` without searchable terms and without ids), `FEATURE_NOT_FOUND`.

### `get_node`
- **Description**: "Show one graph node (requirement, task, decision, note, file, concept…) with its excerpt, outgoing links and backlinks. Use it when you know what you are looking for, by id, short id such as FR-003 with a feature, or exact title."
- **In**: `{ ref: string(1..300), feature?: featureId, relation?: Relation, limit?: int 1..200 = 30 }`.
- **Out**: `{ node: { id, kind, label, feature?, path?, line?, tags?, type?, done?, excerpt, read? }, degree, community, out: Array<[relation, target, targetLabel] | [relation, target, targetLabel, confidence, score]>, in: Array<[relation, source, sourceLabel] | [..., confidence, score]>, omitted: { out, in } }`.
  - `excerpt` is ≤ 500 characters from `text`.
  - `read` is `{ artifact, feature, section }` for nodes in feature artifacts, where `section` is the `heading` field.
  - `community` comes from `communitiesOf`.
  - `out` and `in` are sorted by relation, then other id, and REJECTED is excluded.
- **Errors**: `NODE_NOT_FOUND`, `NODE_AMBIGUOUS`, `FEATURE_NOT_FOUND`.

### `find_path`
- **Description**: "Find the shortest chain of links between two graph nodes, such as a note and a requirement, with every hop. Use it to explain how two things in the project are related."
- **In**: `{ from: string, to: string, feature?: featureId, max_hops?: int 1..8 = 6, include_ambiguous?: boolean = false }`.
- **Out**: `{ from, to, hops: number | null, nodes: [{ id, kind, label }], edges: [edgeTuple], reason? }`.
  - Undirected BFS, with neighbors in adjacency order. The first path found wins.
  - Between consecutive nodes, use the edge with the highest score, then the lowest `[relation, source]`.
  - With no path: `hops: null` and `reason: "No path within <n> hops."`.
- **Errors**: as `get_node`.

### `graph_report`
- **Description**: "Summarize the project graph: size, the most connected nodes, communities of related items, surprising cross-links, pending extraction work and suggested questions. Use it to orient yourself in an unfamiliar project, or with a community id to list its members."
- **In**: `{ top?: int 1..50 = 10, community?: int ≥ 0, offset?: int ≥ 0 = 0, limit?: int 1..500 = 50 }`.
- **Out** without `community`:

  ```json
  { "stats": { "nodes": 0, "edges": 0, "by_kind": {}, "by_relation": {}, "by_confidence": {}, "communities": 0,
      "extraction": { "units": 0, "pending": 0, "covered": 0 } },
    "god_nodes": [{ "id": "", "kind": "", "label": "", "degree": 0 }],
    "communities": [{ "id": 0, "label": "", "size": 0, "top": ["id"] }],
    "surprising": [{ "edge": [], "score": 0, "why": "" }],
    "questions": [{ "type": "", "question": "", "nodes": [] }] }
  ```

  - `by_*` keys are sorted.
  - `communities` lists the first 20 by id, and `stats.communities` holds the total.
- **Out** with `community`: `{ community: { id, label, size, cohesion, members: [{ id, kind, label, degree }], bridges: [{ id, label, communities }] }, offset, limit }`. `members` is paged with `offset` and `limit`.
- **Errors**: `INVALID_INPUT` (unknown community id; hint: `Communities: 0..<n−1>`).

### `extraction_batch`
- **Description**: "Plan or fetch semantic extraction work for you, the agent: without units it lists pending sections grouped into batches, and with units it returns their content, instructions and the ids you may link. Save what you find with save_relations, including the covered hashes, so the same content is never analyzed twice."
- **In**: `{ units?: string[] (1..30), feature?: featureId, budget_tokens?: int 500..8000 = 2500, limit?: int 1..200 = 50 }`.
  - The effective budget is `min(budget_tokens, floor((maxResponseChars − 9000) / 4))`, with a floor of 500.
- **Plan mode** (no `units`):
  - **Out**: `{ version: EXTRACTOR_VERSION, units: <total>, pending: <n>, batches: [{ batch: 1, scope, tokens, units: [unitIds] }] }`.
  - Pending units are sorted by scope (`project` last), then path, then the unit's order in the file.
  - Greedy packing in that order: start a new batch when adding the unit would exceed the budget or the scope changes. A unit larger than the budget gets its own batch.
  - Only the first `limit` batches are returned. With `feature`, only units in that scope.
- **Fetch mode**:
  - **Out**: `{ version, instructions: EXTRACTION_INSTRUCTIONS, items: [{ unit, node, title, hash, content }], candidates: Array<[id, label]>, deferred?: string[] }`.
  - **Items:** the content comes from re-reading the source and is the unit's text with comments stripped. The `hash` is recomputed now.
  - **Candidates**, deduplicated, at most 60, with labels cut to 60 characters:
    1. the nodes of the units' scopes, in kind order feature, story, requirement, criterion, task, decision, artifact;
    2. then concepts, by label;
    3. then principles.
  - **Fitting:** if the response would exceed `maxResponseChars`, drop candidates from the end first, then move whole items to `deferred`.
  - Unknown unit ids are listed in `deferred` with no content.
- **Errors**: `FEATURE_NOT_FOUND`.

### `save_relations`
- **Description**: "Store the relations and concepts you extracted (confidence INFERRED or AMBIGUOUS, or REJECTED to retire a wrong one) and mark analyzed units as covered, in Markdown ledgers under .specify/memory/relations/. Invalid items are reported one by one and the valid ones are still saved."
- **In**: `{ relations?: [{ source, relation, target, confidence: "INFERRED"|"AMBIGUOUS"|"REJECTED", score: number 0..1, evidence?: string(≤200) }] (≤200), concepts?: [{ id, label: string(1..120), summary?: string(≤300) }] (≤50), covered?: [{ unit, hash }] (≤100) }`. At least one array must be non-empty (otherwise `INVALID_INPUT`).
- **Validation** (each item on its own; rejected reasons are stable strings):
  - **concepts:**
    - `id` must match `^concept:[a-z0-9][a-z0-9-]{0,63}$` (`bad_concept_id`).
    - An existing concept with a different label or summary is updated.
  - **relations:**
    - `source` and `target` must resolve with `allowLabel: false`, or be concepts in this call (`unknown_source` or `unknown_target`).
    - `source ≠ target` (`self_relation`).
    - `relation` must be in `SEMANTIC_RELATIONS` (`unknown_relation`).
    - Score bands: INFERRED 0.5–0.99, AMBIGUOUS 0.1–0.49, REJECTED exactly 0 (`score_out_of_range`).
    - A non-REJECTED save of a triple that is REJECTED in the ledgers → `previously_rejected`.
  - **covered:**
    - The unit must exist (`unknown_unit`).
    - The hash must equal the current one (`stale`).
- **Storage:**
  - Each relation goes to `scopeOfNode(source)`; for a concept source, `project`.
  - Concepts go to `project`.
  - Each coverage row goes to the unit's scope, with `version = EXTRACTOR_VERSION` and `date = localDate(deps.now())`.
  - An existing row whose rendered text is identical is `unchanged`.
- **Out**: `{ added: { relations, concepts, covered }, updated: { relations, concepts, covered }, unchanged: n, rejected: [{ field: "relations"|"concepts"|"covered", index, reason }], files: [paths written] }`.

### `lint_memory`
- **Description**: "Check the project memory and graph for broken or ambiguous links, relations that point at missing nodes, invalid ledger rows, contradictions and orphans, each with the file, line and a fix. Run it after renaming, moving or deleting files, and before closing a feature."
- **In**: `{ feature?: featureId, limit?: int 1..1000 = 100 }`.
- **Out**: `{ counts: { error, warning, info }, issues: [{ kind, severity, path, line?, node?, message, fix }] }`.
  - Sorted by severity (error, warning, info), then path, then line, then kind.
  - With `feature`, keep issues whose node or path belongs to that feature.
  - Severity by kind is in FR-019.
  - `orphan` applies to decisions, notes, docs and concepts whose only edges are `belongs_to`, or which have none.
  - `stale_coverage` is one issue per scope, with a count.
  - `duplicate_label` applies to notes, concepts and docs with the same case-insensitive label.
  - `contradiction` is any `contradicts` edge.
  - `ambiguous_relation` is any AMBIGUOUS ledger row.

### `export_graph`
- **Description**: "Write a view of the project graph for people and other tools: graph.json, a Markdown report with Mermaid diagrams that renders on GitHub, or an Obsidian vault. Use it when someone wants to browse the graph outside the agent."
- **In**: `{ format: "json"|"report"|"obsidian" }`.
- **Out**: `{ format, path, written: n, unchanged: n, removed: n, skipped: [paths] }`. The `path` is the file or folder, root-relative.
- **Errors**: `INTERNAL` for write failures (details on stderr).

### Changes to existing tools
- **`pack_context`** gains `graph?: boolean`. When it is true, it calls `loadGraph` and then `boostByGraph(pinned, ranked, graph)` (it returns the new ranked list) before `pack()`:
  1. **Item → nodes:**
     - `task` → `task:<f>/<T>`;
     - `decision` → `decision:<id>`;
     - `memory` → `note:<id>`;
     - `constitution` → `principle:<key>`;
     - `spec-section` and `plan-section` → every node whose `path` is that file and whose `section` is that key, plus the artifact node.
  2. **Seeds:** the top 3 items by score after the existing ranking, pinned items excluded.
  3. **Boost:** for each other candidate item that has a node linked by a usable edge to a seed's node, set `score = max(score, 0.5 × seedScore)`. The highest seed wins, and boosts never stack.
  4. Re-sort with the existing comparator, apply the existing `score > 0` filter after boosting, and pack.

  The description must mention the new flag and stay within 2 sentences.
- **All 10 existing tools** get `openWorldHint: false`:
  - reads keep `readOnlyHint: true`;
  - `set_task_status` gets `destructiveHint: false, idempotentHint: true`;
  - `log_decision` and `save_memory` keep `destructiveHint: false` (they are not idempotent).

## Extraction instructions

`EXTRACTION_INSTRUCTIONS` in `graph/instructions.ts` (version 1). Keep this text exactly. The contract test checks that it is ≤ 1,600 characters.

```text
Read each item and record relations its text supports that are not already explicit links or ids. Use only ids from candidates, or concepts you define in the same save_relations call (concept:<slug>, lowercase ASCII). Relations: depends_on, implements, rationale_for (explains why the target exists), supersedes, contradicts, refines, part_of, tests, uses, example_of, similar_to, related_to (last resort). Use INFERRED with score 0.5-0.99 when the text clearly supports the relation, and AMBIGUOUS with 0.1-0.49 when it is plausible but uncertain; never EXTRACTED. Give evidence: a quote of at most 200 characters from the item. Create a concept only for a named idea that is central to an item or shared by two or more items, and reuse existing concepts. Prefer 3-10 strong relations per item over many weak ones. In the same call, list covered: [{unit, hash}] for every item you fully analyzed, even when you found nothing. Never mark an item covered if you did not read all of it.
```

## Server instructions

`SERVER_INSTRUCTIONS` in `graph/instructions.ts`. Keep this text exactly; it is ≤ 1,200 characters (FR-023). The README snippet for `AGENTS.md`/`CLAUDE.md` repeats it under a `## Specwright` heading.

```text
Specwright keeps this project's specs, tasks, decisions and notes as a knowledge graph. Before reading whole files or searching for a spec or design question, call query_graph (get_node for one id, find_path for how two things relate) and read only what it points to. Start a task with pack_context and close it with check_against_spec, set_task_status and log_decision. To grow the graph, call extraction_batch for a plan of pending units, give each batch to one worker that calls extraction_batch with those units and then save_relations with the relations, concepts and covered hashes; parallel workers must take different batches. Run lint_memory after renaming or deleting files. Files under .specify/graph/ are derived; never edit them.
```

## CLI

`specwright-mcp graph <command> [args] [options]`. Without a `graph` subcommand, `src/index.ts` starts the stdio server exactly as before.

| Command | Tool | Arguments and options |
|---|---|---|
| `graph query <words…>` | `query_graph` | `--feature F`, `--mode bfs\|dfs`, `--depth N`, `--budget N`, `--include-ambiguous` |
| `graph node <ref>` | `get_node` | `--feature F`, `--relation R`, `--limit N` |
| `graph path <from> <to>` | `find_path` | `--feature F`, `--max-hops N`, `--include-ambiguous` |
| `graph report` | `graph_report` | `--top N`, `--community N`, `--offset N`, `--limit N` |
| `graph lint` | `lint_memory` | `--feature F`, `--limit N` |
| `graph export <json\|report\|obsidian>` | `export_graph` | none |

- **`args.ts` → `parseGraphArgs(argv)`:** returns `{ tool, args }` or `{ usage: string }`. Numbers are parsed with `Number` and validated by the tool's zod schema. Unknown options are a usage error.
- **`graph.ts` → `runGraphCli(argv, env, cwd, write)`:**
  - `loadConfig(env, cwd)`, then the tool's zod schema (`safeParse`; on failure, exit 2 with usage), then `run<Tool>`, then `respond(data, config.maxResponseChars)`, then `write(text + "\n")`.
  - **Exit codes:** 0 on success; 1 on errors other than the two below (the error JSON is printed); 2 on usage errors (usage to stderr); 3 on `NODE_AMBIGUOUS`; 4 on `NODE_NOT_FOUND`.
  - `lint` exits 1 when `counts.error > 0`.
- **stdout** is used only in CLI mode. The server path never writes to it.

## Exports

All renderers are pure and return `ExportFile = { path: string; content: string }` values. `repository.writeExport(root, target, files)` writes them with `writeAtomicIfChanged` through `resolveWithin` (`target` is `{ kind: 'file', path }` under `GRAPH_DIR` or `{ kind: 'vault', dir }`), and returns `{ written, unchanged, removed, skipped }`.

- **`json`** → `.specify/graph/graph.json`, `JSON.stringify(value, null, 2) + "\n"`:

  ```json
  { "schema": 1, "generator": "specwright <package version>", "directed": true,
    "nodes": [{ "id": "", "kind": "", "label": "", "feature": "", "path": "", "line": 0, "community": 0 }],
    "links": [{ "source": "", "target": "", "relation": "", "confidence": "", "score": 1 }],
    "communities": [{ "id": 0, "label": "", "members": [] }] }
  ```

  There is no timestamp. Optional keys are omitted when absent.
- **`report`** → `.specify/graph/GRAPH_REPORT.md`, in this order:
  1. `# Project graph`, then a stats table;
  2. `## Most connected`;
  3. `## Communities`: one `### <id>. <label> (<size>)` per community for the top 10, each with a `mermaid` `flowchart LR` block (`mermaid.ts`) and a `<details>` plain edge list;
  4. `## Surprising connections`;
  5. `## Suggested questions`;
  6. `## Health`: lint counts by kind;
  7. `## Extraction`: pending and covered.

  `mermaidFlowchart(nodes, edges)` details:
  - keep at most 40 nodes (by degree within the community) and 100 edges;
  - node ids `n0…`;
  - labels in double quotes, with `"` replaced by `#quot;` and cut to 40 characters;
  - EXTRACTED edges `-->|relation|`, INFERRED `-.->|relation|`, AMBIGUOUS `-.->|relation?|`.
- **`obsidian`** → `graph.vaultDir`:
  - **Notes:** one note per node (all kinds except `file`) at `<kind>/<slug>.md`.
    - The slug is `slugify(id after "kind:", 80)`; on collision add `-2`, `-3`… in id order.
    - Frontmatter: `{ id, kind, feature?, community, source?, line?, tags? }`.
    - Body:
      1. `# <label>`;
      2. the excerpt, where `#` followed by a non-space becomes `\#`;
      3. `## Links`, with one line per outgoing edge, `- <relation> [[<kind>/<slug>|<label ≤ 60, without | ] [>]]`, plus ` (INFERRED 0.85)` when the edge is not EXTRACTED;
      4. `Source: \`<path>\`` when the node has a path.
  - **Community notes:** `_community-<id>.md`, listing the members as wikilinks.
  - **Manifest:** `.specwright-manifest.json` with `{ "files": [sorted owned paths] }`.
    - A path that exists and is not in the manifest is skipped (`skipped`).
    - Owned files no longer produced are deleted (`removed`).
    - Never create or touch `.obsidian/`.

## Errors

Add `NODE_NOT_FOUND` and `NODE_AMBIGUOUS` to `ErrorCode`. Every other case uses the existing codes:
- `INVALID_INPUT`: bad semantics, an empty `save_relations` call, an unknown community;
- `FEATURE_NOT_FOUND`;
- `PATH_OUTSIDE_ROOT`;
- `NOT_INITIALIZED`;
- `INTERNAL`.

Messages never contain absolute paths.

## Fixture: brain

`tests/fixtures/brain/` is a small Spec Kit project, written in template shape like `tests/fixtures/speckit/`. The ids, words and links below are fixed, because the tests depend on them.

- **`specs/001-photo-albums/spec.md`**
  - Title "Photo albums", `**Status**: Draft`.
  - US1 "Create albums" (P1), with 2 scenarios.
  - US2 "Sort albums" (P2), with 1 scenario.
  - FR-001 "System MUST let users create an album from selected photos".
  - FR-002 "System MUST support album sorting by date" (this one contains "album" and "sorting").
  - FR-003 "System MUST let users share an album (see SC-001)".
  - SC-001 "A shared album opens in under 2 seconds".
- **`specs/001-photo-albums/plan.md`:** `## Summary`, which mentions "decision 0001" and cites `src/albums/model.ts`.
- **`specs/001-photo-albums/tasks.md`:**
  - `## Phase 1: Setup`: `- [X] T001 Create album model in src/albums/model.ts`.
  - `## Phase 3: User Story 1 - Create albums (Priority: P1)`: `- [ ] T003 [US1] Implement FR-001 album creation in src/albums/create.ts`.
  - `## Phase 4: User Story 2 - Sort albums (Priority: P2)`: `- [ ] T005 [US2] Implement album sorting by date for FR-002 in src/albums/sort.ts`.
- **`specs/002-sharing/spec.md`:** title "Sharing". US1 "Share a link" (P1). FR-001 "System MUST create expiring share links for `001-photo-albums/FR-003`".
- **`specs/002-sharing/tasks.md`:** `- [ ] T001 [US1] Create share link service in src/sharing/link.ts`.
- **`.specify/memory/constitution.md`:** `## Core Principles` with `### I. Files First` and `### II. Test-First (NON-NEGOTIABLE)`, plus a version line.
- **`.specify/memory/decisions/0001-keep-photo-data-as-plain-files.md`:**
  - frontmatter `feature: 001-photo-albums`, title "Keep photo data as plain files";
  - the body mentions FR-001 and links `[[keep-ids-stable]]`;
  - it must not contain the tokens "album" or "sorting".
- **`.specify/memory/decisions/0002-share-links-expire.md`:**
  - feature `002-sharing`;
  - the body says "see decision 0001" and links `[[keep-ids-stable]]`;
  - it contains the line `- depends_on [[0001-keep-photo-data-as-plain-files]]`.
- **`.specify/memory/notes/keep-ids-stable.md`:** type `convention`, tags `[ids]`. It links `[the files decision](../decisions/0001-keep-photo-data-as-plain-files.md)`.
- **`.specify/memory/notes/sorting-pitfall.md`:** type `pitfall`. The body mentions `001-photo-albums/FR-002`.
- **`.specify/memory/relations/project.md`:**
  - concept `concept:album-ordering` ("Album ordering");
  - relation `note:sorting-pitfall | rationale_for | requirement:001-photo-albums/FR-002 | INFERRED | 0.8`;
  - no coverage rows.
- **`docs/adr/0001-storage.md`:** title `# ADR 0001: Storage`. It links `[[0001-keep-photo-data-as-plain-files]]`. It is read only when a test sets `graph.include: ["docs"]`.

`tests/helpers.ts`: `connect()` must default `graph` to `DEFAULT_GRAPH_CONFIG`, and tests override it with `connect(root, { graph: { ...DEFAULT_GRAPH_CONFIG, include: ['docs'] } })`. Graph integration tests call `resetGraphCache()` in `afterEach`.

## Testing strategy

- **Names:** every test starts with its id (`FR-0xx:`, `USn-ASm:`, `SC-00x:`), as the constitution requires, and is seen failing first. Record the RED and GREEN evidence in `docs/tdd/phase-5.md` (the same table format as `phase-4.md`).
- **Unit** (`tests/unit/graph-<file>.test.ts`), one file per pure source file:
  - ids, mentions, links, link-index, units, facts-feature, facts-memory, ledger, build, node-ref, search, traverse, budget, query, path, community, analyze, extraction, lint, mermaid, exports;
  - plus `config`, `paths`, `files`, `hash`, `text` additions and `cli-args`.
- **Integration** (`tests/integration/graph-*.test.ts`), on a `copyFixture('brain')`: one file per tool, plus `graph-cache.test.ts` (US5) and `graph-include.test.ts` (US6). `context-pack.test.ts` gains the US8-AS2 case.
- **Contract:**
  - `server.test.ts` checks:
    - the exact 18 names;
    - ≤ 16,000 characters in total and ≤ 1,200 per tool;
    - ≤ 2 sentences per description;
    - `openWorldHint === false` on every tool;
    - the `initialize` instructions ≤ 1,200 characters, naming `query_graph`, `get_node` and `extraction_batch`.
  - `graph-workflow.test.ts` runs over stdio:
    1. query;
    2. plan, fetch and save one batch;
    3. query again and see the INFERRED edge;
    4. a second process sees it;
    5. the CLI `graph query`, run with `node dist/index.js graph query …` through `execFile` in the test (the test may spawn; the server may not), prints the same JSON.
- **Determinism (FR-026):** a test calls each read tool twice in two server instances and compares the texts.
- **Perf** (`tests/perf/graph.perf.test.ts`): extend `speckitDataset` with an optional `{ links: true }` argument that adds a decision mention of `FR-001`, a note wikilink to a decision, and a qualified mention per feature. Measure SC-003 using `median()` and `factor`.
- **Load** (`tests/load/graph.load.test.ts`):
  - 2,000 features and 5,000 notes, cold build < 6 s;
  - two stdio server processes each save 50 distinct relations into the same ledger concurrently, and all 100 rows are present with a well-formed file.
- **Dogfood:** `repository-dogfood.test.ts` lists features 001–010. Add SC-007 (`lint_memory` on the repository copy reports 0 `broken_link`) and SC-001 (5 relation questions on the repository copy, each answered within 1,500 tokens and at least 3 times cheaper than reading the files that hold the expected nodes).

## Governance updates

The new constitution text (v2.0.0, MAJOR because principles were redefined) replaces principles III, IV and VI and one constraint line. Every other line stays.

```markdown
### III. Well-Described, Non-Overlapping Tools
Every tool answers a distinct question an agent asks, and a new tool must not overlap an existing one. Each description is at most 2 sentences and says when to use the tool; each tool entry in `tools/list` stays within 1,200 characters and the whole listing within 16,000 characters. Every tool declares `openWorldHint: false` and its read-only or non-destructive hints.

### IV. Files Are the Source of Truth
State lives in the project's Markdown files. A cache or index is allowed only when it is derived from those files, can be deleted and rebuilt without loss, is checked against the files on every call so it never serves stale data, and lives in git-ignored `.specify/graph/`. No database server, vector index or external service.

### VI. Safe File Access
Only `specs/`, `.specify/` and the Markdown folders listed in `graph.include` are read, and included folders are never written. Only `tasks.md` checkboxes, `.specify/memory/**`, derived files in `.specify/graph/**` and the configured Obsidian export folder are written. Writes are atomic and byte-minimal, new files never overwrite existing ones, and symlinks cannot escape.
```

- Constraint line: "No network access, no `child_process`, and nothing written to stdout except JSON-RPC (the `graph` CLI subcommand prints its result to stdout and never starts the server)."
- Footer: `**Version**: 2.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: <implementation date>`.

Other documents (FR-030):
- **PRD:**
  - N4 becomes "no database server nor vector index; derived, rebuildable caches are allowed";
  - NFR-2 becomes "No overlapping tools";
  - NFR-3 gets the new budgets;
  - NFR-6 gets the new read and write areas;
  - NFR-7 adds the graph budgets;
  - add FR-12 to FR-19 for the graph (query, node, path, report, extraction, relations, lint, export, CLI);
  - §7 gets a Phase 5 success signal (SC-001), §8 a Phase 5 scope, and §12 a v0.3.0 entry.
- **TRD:**
  - §1: the diagram gains `graph/` and `cli/`;
  - §2: constraints (18 tools, budgets, write areas);
  - §3: the `graph/` and `cli/` tree;
  - §5: `.specify/graph/` and `relations/`, plus the config keys;
  - §7: the 8 tools;
  - §8: the 2 error codes;
  - §10: the new suites;
  - §13: traceability rows.
- **Roadmap:** "Phase 5: second brain" with `010-second-brain`. Remove "a cache for very large projects" from "Next" (now done).
- **README:**
  - the tools table;
  - "Second brain" usage with and without Obsidian: MCP, CLI, report, vault and `graph.vaultDir`, plus how to check that Obsidian opens a vault at a hidden path;
  - the agent snippet;
  - Codex config (`[mcp_servers.specwright]`).
- **CONTRIBUTING:** remove "hard limit of 10 tools" and describe the budgets.
- **CLAUDE.md:** "10 tools", "three roadmap phases" and the structure list. **AGENTS.md** (new, for Codex users of this repository): the same working rules as `CLAUDE.md`, plus the snippet.
- **CHANGELOG:** 0.3.0. **`package.json`:** version 0.3.0, and the description mentions the knowledge graph.
- **`.gitignore`:** `.specify/memory/relations/.lock/`.
- **Spec status:** `**Status**: Implemented` at the end.
