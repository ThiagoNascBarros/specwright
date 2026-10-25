# Feature Specification: Second brain (project knowledge graph)

**Feature Branch**: `feature/SW-10-second-brain`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Build a second brain inside the Specwright MCP server, in the spirit of Graphify: the specs, decisions and notes become a knowledge graph that agents can query, and the docs can also be opened in Obsidian, where they reference each other. Add a cache so the model spends fewer tokens. It must work the same for someone who does not use Obsidian. The model the user already runs (Codex, Claude Code) builds the semantic part of the graph. Remove the 10-tool limit and add the tools this needs. Research Graphify and other second-brain projects, decide CLI or not, and hand over a report, a spec, a plan and tasks that another agent can implement with subagents."

## Clarifications

### Session 2026-10-24

- Q: Must the second brain depend on Obsidian? → A: No. Agents query it through MCP tools, and people and CI can use a CLI and a Markdown report. An Obsidian vault is only one optional export.
- Q: Who extracts the semantic relations (concepts, "why", "depends on")? → A: The agent the user already runs (Codex, Claude Code, or their subagents). The server hands out work batches and stores the results. It never calls a model.
- Q: Is the 10-tool limit kept? → A: No. The fixed count is removed. Each tool must still earn its place, and the tool listing gets a size budget per tool and in total.
- Q: Should the cache use Redis or another service? → A: No external service. The graph is held in memory and refreshed per changed file, with an optional snapshot on disk. The extraction coverage, which is the cache that saves model tokens, is kept in Git next to the relations.
- Q: Does the graph read source code? → A: No. It covers specs, project memory and, if configured, extra Markdown folders. Code paths cited in those files become `file` nodes and are never read.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask the project graph instead of reading files (Priority: P1)

An agent is about to change something and wants to know what is connected to it: which requirements, tasks, decisions, notes and files. It asks the graph a question, looks up one node with its backlinks, or asks for the path between two things. It gets a small, ranked subgraph within a token budget. No extraction step, no Obsidian and no other service is needed, because the explicit links already in the files (ids, Markdown links, wikilinks, task labels, cited paths, decision features) form the graph.

**Why this priority**: This is the MVP. It replaces broad reads with one small, structured answer, and every other story builds on the same graph.

**Independent Test**: Copy the `tests/fixtures/brain/` project into a temporary folder. Call `query_graph`, `get_node` and `find_path` and check the node ids, edges and budgets in the responses.

**Acceptance Scenarios**:

1. **Given** a feature whose task `T005 [US2]` cites `FR-002` and `src/albums/sort.ts`, **When** the agent calls `query_graph` with "album sorting" and the feature id, **Then** the response includes the task, `US2`, `FR-002` and `file:src/albums/sort.ts` with the `implements`, `references` and `touches` edges between them, and its estimated size is within `budget_tokens`.
2. **Given** a decision whose frontmatter names the feature and whose body says "see decision 0001" and links `[[keep-ids-stable]]`, **When** the agent calls `get_node` for `0002`, **Then** it gets the decision with outgoing `belongs_to`, `references` and `links_to` edges, and the incoming edges (backlinks) from every file that links to it.
3. **Given** a note linked to a decision that belongs to a feature that contains a requirement, **When** the agent calls `find_path` from the note to the requirement, **Then** it gets the shortest path with every hop and edge, and the same answer on every call.
4. **Given** a budget too small for the whole answer, **When** the agent calls `query_graph`, **Then** the seed nodes are always kept, lower-ranked nodes are dropped, and the response says how many were omitted and which budget would return them all.
5. **Given** a label that matches two nodes, **When** the agent calls `get_node` with it, **Then** it gets `NODE_AMBIGUOUS` with both candidate ids, and with an unknown label it gets `NODE_NOT_FOUND` with the closest suggestions.

---

### User Story 2 - The user's own agent builds the semantic layer (Priority: P1)

The agent (Codex, Claude Code, or several of their subagents in parallel) asks the server for an extraction plan: the sections of specs, plans, decisions and notes that were never analyzed or changed since. It splits the plan into disjoint batches, reads each batch's content with the extraction instructions and the ids it may link to, and saves the relations and concepts it found, with a confidence and the evidence. The server checks and stores them as Markdown tables in `.specify/memory/relations/`, versioned in Git. Sections already analyzed are never sent again, so the model spends no tokens twice for the same content, on any machine that has the repository.

**Why this priority**: It turns explicit links into a real second brain (why, depends on, contradicts, shared concepts) without breaking the rule that the server never calls a model.

**Independent Test**: On the fixture, run plan → fetch → save for every batch with scripted relations, then plan again. Nothing is pending. Edit one section of one file: exactly that unit is pending again.

**Acceptance Scenarios**:

1. **Given** a project with no extraction coverage, **When** the agent calls `extraction_batch` without `units`, **Then** it gets every extraction unit once, grouped into batches whose token estimates are within `budget_tokens` (a larger unit gets a batch of its own), sorted by feature and path.
2. **Given** a plan, **When** the agent calls `extraction_batch` with the `units` of one batch, **Then** it gets each unit's content, its hash, the extraction instructions and the candidate node ids, including existing concepts.
3. **Given** a batch the agent analyzed, **When** it calls `save_relations` with two relations, one new concept and the batch's coverage records, **Then** they are written to the ledger of each source node's scope, the next `query_graph` returns the new edges as `INFERRED` with their score, and the units are no longer pending.
4. **Given** a relation whose target id does not exist, a relation type outside the vocabulary and a coverage record with an outdated hash, **When** the agent saves them with valid items, **Then** the valid items are written and each invalid one is reported with its index and reason.
5. **Given** two server processes, **When** both save relations into the same ledger at the same time, **Then** both sets of rows are present and the file is well formed.
6. **Given** a relation that already exists with the same source, relation and target, **When** the agent saves it again with a new score, **Then** only that row changes. When it is saved with confidence `REJECTED`, the row is kept as rejected: the edge leaves the graph, and later `INFERRED` or `AMBIGUOUS` saves of the same triple are refused as `previously_rejected`.

---

### User Story 3 - See the shape of the project (Priority: P2)

A person or an agent new to the project asks for an overview: how big the graph is, which nodes everything flows through ("god nodes"), which groups of related things exist (communities), which links cross unrelated groups (surprising connections), and which questions are worth asking next. It can then drill into one community.

**Why this priority**: It gives an orientation that no single file holds, but it needs the graph of Story 1 first.

**Independent Test**: Call `graph_report` on the fixture twice and compare: same communities, same order, same labels. Call it with a `community` id and check the members.

**Acceptance Scenarios**:

1. **Given** the fixture with two features that share a note, **When** the agent calls `graph_report`, **Then** it gets node and edge counts by kind, relation and confidence, the top nodes by degree (ignoring `contains` and `belongs_to` edges), the communities with label and size, the surprising connections and the suggested questions.
2. **Given** the same files, **When** `graph_report` is called again in a new process, **Then** the response is byte-identical.
3. **Given** a community id from the report, **When** the agent calls `graph_report` with `community`, **Then** it gets that community's nodes and the nodes that bridge it to other communities.

---

### User Story 4 - Keep the brain healthy (Priority: P2)

Links break when files are renamed, wikilinks become ambiguous, relations point at tasks that were renumbered, and some notes are linked to nothing. The agent (or CI) runs a lint that lists these problems with the file, line and a fix hint.

**Why this priority**: A second brain that silently rots gives wrong answers. This is Karpathy's "lint" operation.

**Independent Test**: Add a broken link, an ambiguous wikilink, a ledger row with a missing target and an orphan note to the fixture. `lint_memory` reports each one once, with the expected kind and severity.

**Acceptance Scenarios**:

1. **Given** a note that links `[[missing-note]]` and a decision that links `[text](../notes/gone.md)`, **When** the agent calls `lint_memory`, **Then** both are reported as `broken_link` errors with path and line.
2. **Given** a ledger row whose target task no longer exists, **When** the agent calls `lint_memory`, **Then** it is reported as `dangling_relation`, and that row is ignored by the graph.
3. **Given** `AMBIGUOUS` relations and a `contradicts` relation, **When** the agent calls `lint_memory`, **Then** they are listed for human review, and with `feature` set only that feature's issues are returned.

---

### User Story 5 - Fast on large projects (Priority: P2)

On a project with hundreds of features and thousands of notes, the first graph call of a session is quick because a snapshot on disk lets the server skip unchanged files, and later calls only re-parse the files that changed. The answers are always the same as a full rebuild, so the cache never serves stale data.

**Why this priority**: This is the cache the owner asked for, done without an external service. The graph must stay within the performance budgets that the other tools already meet.

**Independent Test**: The perf suite measures cold build, warm calls and a new process with a snapshot on the 500-feature dataset. A unit test edits, adds and deletes files between calls and compares the cached graph with a full rebuild.

**Acceptance Scenarios**:

1. **Given** a built graph, **When** one note is edited, one decision added and one note deleted, **Then** the next call re-parses only those files, and its graph equals a full rebuild.
2. **Given** a snapshot written by another process, **When** a new server process answers its first graph call, **Then** it reuses the snapshot for unchanged files. A corrupt or outdated snapshot is ignored and rewritten, never reported as an error.
3. **Given** `"graph": { "cache": "off" }` in `.specify/specwright.json`, **When** graph tools are called, **Then** no snapshot is read or written.

---

### User Story 6 - Bring existing Markdown notes into the brain (Priority: P2)

The project already has Markdown outside Spec Kit: `docs/` with a PRD and ADRs, or a folder that someone opens in Obsidian. The owner lists those folders in `.specify/specwright.json`. Their files join the graph as `doc` nodes, with their links, wikilinks and mentions, and are never written.

**Why this priority**: A second brain that cannot see the product docs or an existing vault is half a brain. It is opt-in, so the default read scope stays the same.

**Independent Test**: In the fixture, set `"graph": { "include": ["docs"] }`. The ADR in `docs/` becomes a node linked to the decision that cites it. Without the setting, nothing in `docs/` is read.

**Acceptance Scenarios**:

1. **Given** `"include": ["docs"]` and `docs/adr/0001-storage.md` that links `[[0001-keep-photo-data-as-plain-files]]`, **When** the agent calls `get_node` for the ADR, **Then** it is a `doc` node with a `links_to` edge to that decision.
2. **Given** an included folder with a symlink pointing outside the project, `.git` or `node_modules` entries, **When** the graph is built, **Then** none of them is read.
3. **Given** no `include` setting, **When** the graph is built, **Then** no file outside `specs/` and `.specify/` is read.

---

### User Story 7 - Use it without MCP or Obsidian, or with Obsidian (Priority: P3)

People and CI use the same graph from the command line (`specwright-mcp graph query "…"`, `graph lint`). A Markdown report with Mermaid diagrams renders on GitHub and in VS Code. A `graph.json` file feeds other tools. People who do use Obsidian export a vault, one note per node with wikilinks and one note per community, and open it in Obsidian's graph view.

**Why this priority**: These are views on top of Stories 1 to 4. Agents get everything through MCP already.

**Independent Test**: Run each CLI command against the fixture and compare its JSON with the matching tool's. Export the three formats twice: the second export writes nothing new, and a user note placed in the vault is never overwritten.

**Acceptance Scenarios**:

1. **Given** the fixture, **When** `specwright-mcp graph query "album sorting" --feature 001-photo-albums` runs, **Then** it prints the same JSON as `query_graph` and exits 0. An unknown node exits 4 and an ambiguous one exits 3.
2. **Given** `graph lint` on a project with a broken link, **When** it runs, **Then** it exits 1, which lets CI fail. Without errors it exits 0.
3. **Given** `export_graph` with `format: "obsidian"`, **When** it runs twice, **Then** the second run reports zero files written. A note that the user created in the vault is reported as skipped and left unchanged.
4. **Given** `export_graph` with `format: "report"`, **When** it runs, **Then** `.specify/graph/GRAPH_REPORT.md` has the overview of Story 3 and one Mermaid diagram per top community, each within GitHub's limits.

---

### User Story 8 - Agents use the brain by default (Priority: P3)

When Codex or Claude Code connects, the server's instructions tell the agent to ask the graph before broad reads and to save relations after extraction. The README gives the same snippet for `AGENTS.md` and `CLAUDE.md`. `pack_context` can pull in items connected in the graph to its best matches.

**Why this priority**: Graphify's experience shows that agents ignore a graph unless an always-on instruction points them to it. It needs everything else first.

**Independent Test**: Read the `initialize` result over stdio and check the instructions. Call `pack_context` with `graph: true` on the fixture and check that a decision linked to the top requirement is included even though it shares no words with the task.

**Acceptance Scenarios**:

1. **Given** a client connecting over stdio, **When** it initializes, **Then** the result carries `instructions` of at most 1,200 characters that name `query_graph`, `get_node` and `extraction_batch`.
2. **Given** a decision linked to a requirement but sharing no words with the task, **When** `pack_context` runs with `graph: true`, **Then** the decision is among the items. With `graph` absent the response is the same as before this feature.

---

### Edge Cases

- What if a wikilink matches two files with the same name in different folders? No edge is created. Lint reports `ambiguous_link` with both candidates.
- What about wikilink forms `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]` and embeds `![[Note]]`? The target is `Note`. The alias, heading and block are ignored for resolution.
- What about links inside code fences, inline code or HTML comments? They are not links.
- What about external URLs, `mailto:` and links to images? They are ignored.
- What about a mention such as `FR-003` in a note that belongs to no feature? It is ignored unless it is qualified (`006-memory/FR-003`), because a guess is not an edge.
- What about a date such as `2026-10-21`, which looks like a feature id? A feature-id mention counts only when that feature exists.
- What about an invalid feature (duplicate ids)? Its nodes are still built, without the duplicated ids, and lint reports it.
- What if the ledger was edited by hand into an invalid table row? The row is skipped and reported by lint as `invalid_row`. The rest of the file is used.
- What about Codex subagents that each start their own Specwright process? Each process keeps its own in-memory graph, the snapshot on disk makes their first call fast, and the ledger lock serializes their writes.
- What about two parallel subagents that fetch the same unit? Both may save relations. Rows are de-duplicated by source, relation and target, and the coverage record is idempotent.
- What if a file changes between `extraction_batch` and `save_relations`? The coverage record's hash no longer matches, so it is rejected and the unit stays pending. The relations themselves are still saved if their nodes exist.
- What about CRLF, a BOM and non-ASCII names (accents, emoji) in titles and slugs? They are handled the same way as by the existing parsers, and concept ids are ASCII slugs.
- What if `.specify/graph/` cannot be written (read-only checkout)? Graph tools still work from memory. The snapshot write failure goes to stderr once, and `export_graph` returns an error.
- What happens with an empty project (no `specs/`, no memory)? The graph is empty, queries return no seeds with a hint, and nothing fails.

## Requirements *(mandatory)*

### Functional Requirements

#### Graph model

- **FR-001**: System MUST build a project knowledge graph, with no model call and no external service, from the sources it already reads:
  - each feature's `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md` and `contracts/*`;
  - `.specify/memory/constitution.md`, decisions and notes;
  - the relation ledgers in `.specify/memory/relations/`;
  - the folders listed in `graph.include` (FR-021).

  It MUST NOT read any other file. Paths that these files cite become `file` nodes and are never opened.
- **FR-002**: Every node MUST have a stable, typed id: `feature:<feature>`, `artifact:<feature>/<name>`, `artifact:constitution`, `requirement:<feature>/FR-###`, `criterion:<feature>/SC-###`, `story:<feature>/US<n>`, `task:<feature>/T###`, `principle:<key>`, `decision:<NNNN>`, `note:<slug>`, `doc:<path>`, `file:<path>` and `concept:<slug>`. It MUST also have a kind, a label, and, when it comes from a file, the source path and 1-based line.
- **FR-003**: System MUST derive `EXTRACTED` edges with score 1.0 from explicit structure:
  - `contains`: feature → its artifacts, requirements, criteria, stories and tasks;
  - `implements`: task → the story in its `[USn]` label;
  - `references`: mentions of `FR-###`, `SC-###`, `US<n>` and `T###`, resolved within the feature of the mentioning file; qualified mentions `<feature>/<ID>` anywhere; existing feature ids; and decision numbers written as "decision 0007" or "decisions 0009 and 0010";
  - `touches`: a cited path that is not a known source file → its `file` node;
  - `links_to`: Markdown links and wikilinks to known sources;
  - `belongs_to`: decision → the feature in its frontmatter;
  - relation lines `- <relation> [[Target]]` or `- <relation> [Text](path)`, where `<relation>` is in the vocabulary of FR-014, give an edge of that relation.
- **FR-004**: System MUST resolve links as follows:
  - Markdown links relative to the linking file, ignoring `#anchors` and URL-encoded spaces;
  - wikilinks by exact relative path, then unique path suffix, then unique file name, case-insensitively and with `.md` optional;
  - `|alias`, `#heading`, `#^block` and the `!` of embeds are ignored for resolution;
  - external URLs, images and links inside code or comments are not links;
  - a target that matches no source, or more than one, creates no edge.
- **FR-005**: Every edge MUST carry its relation, its confidence (`EXTRACTED`, `INFERRED` or `AMBIGUOUS`), a score in [0, 1], and the path (plus the line, when known) where it was asserted.
- **FR-006**: System MUST keep the graph in memory per project root and refresh it on every graph call. It compares each source file's size and modification time with the cached ones, and re-parses only the files that changed, appeared or disappeared. The result MUST equal a full rebuild.
- **FR-007**: Unless `graph.cache` is `memory` or `off`, System MUST persist a snapshot of the per-file parse results in `.specify/graph/cache.json`, and a new process MUST reuse it for unchanged files. A missing, corrupt or older-schema snapshot MUST be ignored and rewritten, never surfaced as an error. With `off`, every call rebuilds from the files.
- **FR-008**: System MUST write derived files only under `.specify/graph/`. Before its first write there, it MUST create `.specify/graph/.gitignore` containing `*`, and MUST never overwrite an existing one.

#### Querying

- **FR-009**: `query_graph` MUST take `question`, an optional `feature`, `mode` (`bfs` or `dfs`, default `bfs`), `depth` (1–4, default 2), `budget_tokens` and `include_ambiguous` (default false). It MUST:
  - pick up to 3 seed nodes by term score (id match > label > tags > text);
  - traverse from the seeds without expanding through hub nodes other than the seeds;
  - return nodes ranked by distance, then edge score, then term score;
  - keep the response within the budget, as estimated by FR-027, without ever dropping a seed;
  - report the number of omitted nodes and edges, and the budget that would return them all.
- **FR-010**: `get_node` MUST return a node with:
  - an excerpt of at most 500 characters;
  - its outgoing edges, and its incoming edges (backlinks), optionally filtered by relation and limited in number;
  - its degree, its community id, and where to read it (path, line, and `get_artifact` section when it applies).
- **FR-011**: `find_path` MUST return the shortest undirected path between two nodes, up to `max_hops` (1–8, default 6), with each node and edge. Ties MUST be broken deterministically. When there is no path, it MUST return an empty path and the reason.
- **FR-012**: Every tool that takes a node reference MUST resolve it, in this order:
  - an exact id;
  - a short form: `<feature>/FR-003`; `FR-003`, `SC-001`, `US1` or `T012` together with `feature`; `0007` for a decision; a note slug; the path of a source file;
  - a case-insensitive exact label;
  - otherwise `NODE_AMBIGUOUS` (with up to 10 candidate ids) or `NODE_NOT_FOUND` (with up to 5 suggestions).

#### Semantic layer (extraction by the client agent)

- **FR-013**: `extraction_batch` MUST support two modes:
  - **Plan** (no `units`): list every pending extraction unit, grouped into batches of at most `budget_tokens` (default 3,000), sorted by scope and path; a unit larger than the budget gets its own batch. A unit is one `##` section of a source file, or the whole file when it has no `##` section. It is pending when it has no coverage record with its current content hash and the current extractor version.
  - **Fetch** (with up to 30 `units`): return each unit's id, node id, title, hash and content, the extraction instructions (relation vocabulary and confidence rules), and up to 200 candidate node ids from the same scope, plus existing concepts.
- **FR-014**: `save_relations` MUST accept:
  - up to 200 `relations` `{ source, relation, target, confidence, score, evidence? }`, where `relation` is one of `depends_on`, `implements`, `rationale_for`, `supersedes`, `contradicts`, `refines`, `part_of`, `tests`, `uses`, `example_of`, `similar_to` or `related_to`; `confidence` is `INFERRED` (score 0.5–0.99), `AMBIGUOUS` (score 0.1–0.49) or `REJECTED` (score 0); and `evidence` is a quote of at most 200 characters;
  - up to 50 new `concepts` `{ id: "concept:<slug>", label, summary? }`;
  - up to 100 `covered` records `{ unit, hash }`.

  It MUST validate each item on its own, write the valid ones, and return counts plus `rejected: [{ field, index, reason }]`. It MUST never write `EXTRACTED` relations and never delete a row:
  - a `REJECTED` row stays in the ledger and is not an edge;
  - a later `INFERRED` or `AMBIGUOUS` save of the same triple is refused as `previously_rejected`;
  - people remove rows by editing the file.
- **FR-015**: Relations, concepts and coverage MUST be stored in Markdown ledgers, `.specify/memory/relations/<scope>.md`. The scope is the source node's feature, or `project` for nodes without a feature and for concepts. Each ledger has the `## Concepts`, `## Relations` and `## Coverage` tables. Rows MUST be kept sorted, and a save MUST change only the rows it adds, updates or removes. The key of a relation is source + relation + target. Writes MUST be atomic and serialized across processes by a lock.
- **FR-016**: A coverage record whose hash does not match the unit's current content MUST be rejected as `stale`, so the unit stays pending.

#### Overview and health

- **FR-017**: `graph_report` MUST return:
  - counts of nodes by kind and of edges by relation and by confidence;
  - the number of communities, and of pending and covered extraction units;
  - the top `top` nodes by degree (default 10), ignoring `contains` and `belongs_to` edges and `file` nodes;
  - the communities, with id, label, size and their 5 highest-degree members;
  - up to `top` surprising connections and up to 7 suggested questions.

  With `community`, it MUST return that community's members (paginated by `limit`) and its bridge nodes.
- **FR-018**: Communities MUST come from a deterministic Louvain run on the undirected graph, with edge weights equal to their score. Ids MUST be numbered by size (descending), then by the smallest member id. Labels, surprising-connection scores and suggested questions MUST be computed from the graph alone, with no model.
- **FR-019**: `lint_memory` MUST report issues `{ kind, severity, path, line?, node?, message, fix }`, sorted by severity, then path, then line, optionally only for one `feature`. The kinds are:
  - errors: `broken_link`, `dangling_relation`, `invalid_row`;
  - warnings: `ambiguous_link`, `unknown_mention`, `duplicate_label`, `contradiction`;
  - info: `ambiguous_relation`, `orphan`, `stale_coverage`.

#### Views, sources and integration

- **FR-020**: `export_graph` MUST write one of these formats:
  - `json` (`.specify/graph/graph.json`, with nodes, links and communities);
  - `report` (`.specify/graph/GRAPH_REPORT.md`, with the FR-017 overview, one Mermaid diagram of at most 40 nodes and 100 edges per top community, and a plain edge list as fallback);
  - `obsidian` (a vault in `graph.vaultDir`, default `.specify/graph/vault`, with one note per node holding frontmatter and wikilinks, one `_community-<n>.md` note per community, and a manifest of owned files). It MUST never create or write `.obsidian/`.

  It MUST:
  - skip files whose content is unchanged;
  - never overwrite a file it does not own;
  - delete owned files that are no longer produced;
  - report what it wrote, left unchanged, removed and skipped.
- **FR-021**: When `.specify/specwright.json` sets `"graph": { "include": [<folder>, …] }`, System MUST read the `.md` files under those folders (recursively, read-only) as `doc` nodes:
  - Each folder MUST be relative and inside the root, MUST NOT be `specs` or `.specify`, and MUST NOT contain `..`.
  - The path guard MUST refuse symlink escapes, `.git`, `node_modules` and dot-folders.
  - `graph.vaultDir` follows the same rules, except that it may be under `.specify/graph/`. It is the only path outside `.specify/` that may be written, and only by `export_graph`.
  - An invalid setting MUST stop the server at startup, like other config errors.
- **FR-022**: The `specwright-mcp` binary MUST accept `graph report|query|node|path|lint|export` subcommands:
  - each prints the same JSON as the matching tool to stdout;
  - exit codes: 0 on success, 1 on error (or, for `lint`, when an error-severity issue exists), 2 on bad usage, 3 for `NODE_AMBIGUOUS`, 4 for `NODE_NOT_FOUND`;
  - with no subcommand, the binary MUST start the MCP stdio server as before.
- **FR-023**: The server MUST send `instructions` (at most 1,200 characters) in its `initialize` result, telling agents to query the graph before broad reads, how to run extraction with `extraction_batch` and `save_relations`, and to lint after large edits. The README MUST give the same text as a snippet for `AGENTS.md` (Codex) and `CLAUDE.md` (Claude Code).
- **FR-024**: `pack_context` MUST accept `graph` (boolean, default false). When it is true, items whose nodes are directly linked to the 3 best-ranked items MUST get a score boost of half the linking item's score, before packing. When it is false, responses MUST be unchanged.

#### Cross-cutting

- **FR-025**: The server MUST expose these 18 tools:
  - the existing 10: `list_features`, `get_artifact`, `list_open_tasks`, `set_task_status`, `check_against_spec`, `log_decision`, `list_decisions`, `save_memory`, `search_memory`, `pack_context`;
  - 8 new ones: `query_graph`, `get_node`, `find_path`, `graph_report`, `extraction_batch`, `save_relations`, `lint_memory`, `export_graph`.

  Every description MUST have at most 2 sentences. Every tool entry in `tools/list` MUST be at most 1,200 characters, and the whole listing at most 16,000 characters.
- **FR-026**: For the same files and the same arguments, every graph tool MUST return byte-identical responses, and no response may depend on time, process or file-system order.
- **FR-027**: Graph responses MUST estimate tokens as `ceil(chars / 4)` of their JSON, cap `budget_tokens` so the response fits `maxResponseChars`, and trim arrays (never strings mid-way) with `truncated: true`.
- **FR-028**: Errors MUST use the existing structure, plus the codes `NODE_NOT_FOUND` and `NODE_AMBIGUOUS`.
- **FR-029**: Every tool, old and new, MUST declare `openWorldHint: false`. Tools that only read MUST declare `readOnlyHint: true`. Tools that write MUST declare `destructiveHint: false`, and `idempotentHint: true` when repeating the call changes nothing. This is so that Codex in auto mode runs them without an approval prompt and Claude Code runs reads in parallel.
- **FR-030**: The project documents MUST match the new rules:
  - the constitution, amended to v2.0.0 (principles III, IV and VI);
  - PRD (G4, N4, NFR-2, NFR-3, NFR-6, NFR-7, new FRs, Phase 5), TRD (§1–§3, §5, §7, §8, §10, §13) and the roadmap;
  - the README, CONTRIBUTING, CHANGELOG, `CLAUDE.md` and a new `AGENTS.md`.

### Key Entities *(include if feature involves data)*

- **Node**: a typed thing in the project, such as a feature, artifact, requirement, criterion, story, task, principle, decision, note, doc, cited file or concept. It has an id, kind, label, optional feature, path, line, tags and a short text used for scoring and excerpts.
- **Edge**: a directed relation between two nodes, with a confidence, a score, an origin (`derived`, `relation-line` or `ledger`), and the path and line that asserted it.
- **Extraction unit**: one `##` section of a source file, or a whole file without sections. It has an id (`<path>#<section-key>` or `<path>`), the node it belongs to, a content hash and a scope.
- **Relation ledger**: `.specify/memory/relations/<scope>.md`, Markdown tables of concepts, relations and coverage records. It is written by `save_relations` and editable by hand.
- **Concept**: a named idea found by the client agent (`concept:<slug>`), with a label and an optional summary, stored in the `project` ledger.
- **Coverage record**: unit id + content hash + extractor version + date. It means the unit was analyzed and must not be sent again until it changes.
- **Graph cache**: per-file parse results with fingerprints, held in memory and in `.specify/graph/cache.json`. It is derived, rebuildable and git-ignored.
- **Community**: a group of nodes from Louvain, with a numeric id, a label, its members and its bridge nodes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On this repository's own specs and memory, 5 relation questions are each answered by one `query_graph` call with a 1,500-token budget. Each answer spans a decision, a requirement and a task (for example, which requirements and tasks decision 0007 affects), returns every expected node id, and uses at least 3 times fewer estimated tokens than reading the files that hold those nodes.
- **SC-002**: After a full extraction pass, a second plan on unchanged files has 0 pending units. Editing one `##` section of one file makes exactly 1 unit pending.
- **SC-003**: With 500 features and 1,000 notes:
  - a cold graph build (no snapshot) takes under 1.5 s;
  - `query_graph`, `get_node` and `find_path` on a warm graph take under 200 ms each;
  - the first `query_graph` of a new process with a valid snapshot takes under 600 ms;
  - the first `graph_report` takes under 1.5 s, and a repeated one under 300 ms.

  With 2,000 features and 5,000 notes, a cold build completes without errors in under 6 s.
- **SC-004**: Every graph capability (query, node, path, report, lint, extraction) works with no Obsidian installed, through MCP and through the CLI. The exported report renders on GitHub with its Mermaid diagrams.
- **SC-005**: `tools/list` has 18 tools, each entry is at most 1,200 characters, the whole listing is at most 16,000 characters, and each description has at most 2 sentences.
- **SC-006**: Saving one new relation into an existing ledger changes exactly one line of one file (a new row in sorted position).
- **SC-007**: This repository lists 10 valid features, and the graph built from it has no `broken_link` errors.

## Assumptions

- Agents reach Specwright over MCP. Both Codex and Claude Code support stdio MCP servers, tool annotations and server instructions. Neither is relied on for MCP prompts, because Codex has no prompts client. Claude Code subagents share the parent's connection. Codex subagents may start their own server process.
- The semantic layer is optional. Every graph tool works with only the `EXTRACTED` edges, and quality improves as the agent saves relations.
- Token savings grow with project size. On very small projects the main gain is correct, connected answers, not fewer tokens. This is what Graphify's own benchmarks show.
- The token estimate stays `ceil(chars / 4)` (decision 0007), and no tokenizer is added.
- Out of scope for this feature:
  - parsing source code (tree-sitter, as in Graphify);
  - embeddings or vector search;
  - reading PDFs, images or URLs;
  - an HTML graph viewer;
  - git hooks;
  - writing outside `.specify/`;
  - any network access.
