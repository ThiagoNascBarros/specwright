# Research: Second brain (project knowledge graph)

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-24

This report answers what a "second brain" for Specwright should be. It is based on how Graphify and other second-brain projects work, on what Codex and Claude Code actually do with MCP servers, and on the constraints of this repository. Sections 1–6 are the findings. Section 7 lists the decisions in Spec Kit's research format (Decision / Rationale / Alternatives considered), and the plan builds on them.

## 0. Summary

- **Graphify's core idea transfers almost unchanged.** Build a graph from what is explicit (free and deterministic), let the host agent's model add the semantic layer (the server never calls a model), cache extraction by content hash so nothing is analyzed twice, and give agents scoped, budgeted graph queries instead of raw reads. Specwright already has most of the explicit layer: `FR-###`, `SC-###`, `US<n>` and `T###` ids, task story labels, decision → feature links, and cited paths.
- **Obsidian is a view, not the engine.** Every second-brain project that works without Obsidian (Basic Memory, second-brain-mcp, Graphify's MCP server) keeps plain Markdown as the source of truth and builds its own index. Specwright will do the same, and offers an Obsidian vault only as an optional export, next to a Markdown report with Mermaid diagrams (renders on GitHub and in VS Code), a `graph.json`, and a CLI.
- **The cache the owner asked for is two caches, and neither needs Redis.**
  1. A per-file parse cache (in memory, plus a snapshot on disk) makes graph calls fast.
  2. The extraction coverage ledger (content hash per section, stored in Git) means the model never pays tokens twice for the same content. This is the token cache.

  Prompt caching on the client side (OpenAI and Anthropic) is helped by deterministic responses and a static tool list.
- **Honest expectation.** Graphify's "71.5x fewer tokens" is self-reported on a 52-file corpus. Its own table shows ~1x on 6 files and 5.4x on 4 files, and its serious benchmark (ERPNext) reports better answers, not fewer tokens. On a typical Spec Kit repository the main win is connected, correct context, and the token win grows with project size. SC-001 measures it.
- **Interfaces.** MCP tools are primary (8 new tools, 18 in total, after the owner removed the 10-tool cap). A thin CLI on the same binary serves people, CI and agents without MCP. There are no git hooks: the cache validates itself on every call, so hooks are not needed.

## 1. Graphify in depth

Source: the repository `safishamsi/graphify` (cloned at `main` on 2026-10-24). Files read: `README.md`, `ARCHITECTURE.md`, `BENCHMARKS.md`, `graphify/serve.py`, `graphify/export.py`, `graphify/cache.py`, `graphify/markdown_resolution.py`, `graphify/analyze.py`, `graphify/cluster.py`, `graphify/skill-codex.md`, `graphify/always_on/agents-md.md` and `graphify/skills/*/references/extraction-spec.md`.

### 1.1 Pipeline

`detect() → extract() → build() → cluster() → analyze helpers → report.generate() → export.to_*()`

Each stage is its own module, and the stages talk through plain dicts and NetworkX graphs. This is the same "one responsibility per file" shape that Specwright uses.

| Stage | What it does | Specwright equivalent |
|---|---|---|
| detect | scans files, honors `.gitignore` and `--exclude` | source discovery over `specs/`, `.specify/` and `graph.include` |
| extract | code: tree-sitter AST (deterministic, ~40 languages); docs, PDFs and images: LLM | explicit edges from the existing parsers; semantic edges from the client agent |
| build | merges extractions into one graph | `graph/build.ts` |
| cluster | Leiden communities (Louvain fallback); communities over 25% of nodes are split again | deterministic Louvain plus a connected-component split |
| analyze | god nodes, surprising connections, suggested questions, cycles, diff | `graph/analyze.ts` |
| report | `GRAPH_REPORT.md` | `export_graph` with `format: "report"` |
| export | `graph.json`, `graph.html`, Obsidian vault, wiki, Neo4j, SVG and more | `json`, `report`, `obsidian` |

### 1.2 Extraction schema and confidence

Every extractor returns `{ nodes: [{ id, label, source_file, source_location }], edges: [{ source, target, relation, confidence }] }`. The semantic extraction prompt adds:
- `file_type`, one of `code | document | paper | image | rationale | concept`;
- `confidence_score`, which is required: 1.0 for EXTRACTED, 0.6–0.95 for INFERRED, never 0.5 as a default;
- `hyperedges` for groups of 3 or more nodes, at most 3 per chunk;
- relations `calls | implements | references | cites | conceptually_related_to | shares_data_with | semantically_similar_to | rationale_for`.

The "why" behind a concept is stored as a `rationale` attribute, not as a node.

| Confidence | Meaning |
|---|---|
| `EXTRACTED` | stated explicitly in the source (an import, a call, a citation) |
| `INFERRED` | a reasonable deduction (a second-pass call graph, co-occurrence) |
| `AMBIGUOUS` | uncertain; listed for human review in `GRAPH_REPORT.md` |

Graphify's Markdown resolver states the rule that matters most for us: **"an ambiguous name is a guess, and a guess is not an edge."** A bare mention resolves only when exactly one candidate exists.

### 1.3 Who does the semantic extraction

Graphify needs no API key. Code goes through the AST only. For documents, **the host agent is the LLM**:
1. The skill splits uncached files into chunks of at most 20–25 files and about 6,000 lines. A file over 2,000 lines gets its own chunk, and files from the same directory are grouped together.
2. It dispatches one subagent per chunk, all in one message, in parallel. On Codex it uses `spawn_agent`, `wait_agent` and `close_agent`, which needs `multi_agent = true` in `~/.codex/config.toml`.
3. Each subagent returns strict JSON. Results are validated before anything is merged. If one chunk fails, nothing is merged and the cache is not touched.

The reason given for the chunk bound: "a subagent holding 25 files splits its attention across all of them and skims the dense ones; a 590-line plan can come back with zero nodes." **Bounding content, not only file count, is what keeps coverage honest.** Our plan mode bounds batches by estimated tokens for this reason.

### 1.4 Cache

- The SHA256 of each file's content is stored in `graphify-out/cache/`. Only changed files are re-extracted.
- The semantic cache key also includes the extraction prompt file. When the prompt changes, old entries are re-extracted instead of replayed (issue #1939).
- The AST cache has a schema version (currently 25), which is bumped whenever extraction output changes.
- There is no Redis and no database. It is local JSON files.

For Specwright, this maps to: content hash per extraction unit, plus an `EXTRACTOR_VERSION` that is bumped when the instructions change, plus a snapshot `schema` version.

### 1.5 MCP server and query algorithm

Graphify's stdio MCP server has 7 graph tools (plus 3 GitHub PR tools and 6 resources):

| Tool | Input |
|---|---|
| `query_graph` | `question`, `mode` bfs/dfs, `depth` (default 3, max 6), `token_budget` (default 2000), `context_filter` |
| `get_node` | `label` or `node_id` |
| `get_neighbors` | `label`, `relation_filter`, `token_budget` |
| `get_community` | `community_id`, `token_budget` |
| `god_nodes` | `top_n`, `exclude_hubs_percentile` |
| `graph_stats` | nothing |
| `shortest_path` | `source`, `target`, `max_hops` (default 8), `undirected` |

How the query works:
1. **Terms.** The question is split into words and question words are dropped. If every word is a stopword, the unfiltered terms are used.
2. **Scoring.** An exact label match gets +1000, a prefix match +100, a substring match +1 and a source-path match +0.5, all weighted by IDF. Ties are broken by degree, then the shorter label, then the id.
3. **Traversal.** BFS or DFS from the seeds. A node with degree at or above `max(50, p99 degree)` is not expanded unless it is a seed, so a hub cannot flood the answer.
4. **Budget.** Rendered as text at about 3 characters per token. Seeds are never cut. When the answer is cut, it says how many nodes were dropped and the exact budget that would return them all.

We copy steps 3 and 4 closely, and use our existing tokenizer (accent-free, English and Portuguese stopwords) and the `ceil(chars/4)` estimate (decision 0007).

### 1.6 Analysis heuristics (`analyze.py`, `cluster.py`)

- **God nodes:** sorted by plain degree, skipping file-level hubs and concept nodes.
- **Surprising connections:** cross-file edges (skipping `imports`, `contains` and `method`), scored by:

  | Signal | Points |
  |---|---|
  | AMBIGUOUS | +3 |
  | INFERRED | +2 |
  | EXTRACTED | +1 |
  | different file categories | +2 |
  | different top-level directories | +2 |
  | different communities | +1 |
  | `semantically_similar_to` | ×1.5 |
  | a peripheral node (degree ≤ 2) touching a hub (degree ≥ 5) | +1 |

  Every result carries a "why" string.
- **Suggested questions** (7 by default, interleaved across types): AMBIGUOUS edges; the top 3 bridge nodes by betweenness; high-degree nodes with 2 or more INFERRED edges; nodes with degree ≤ 1; communities of 5 or more nodes with cohesion below 0.15.
- **Cohesion:** intra-community edges divided by n(n−1)/2.
- **Community ids:** re-indexed by size (descending), with members sorted. Leiden there has no seed, so the "stable ids" are only this re-indexing.

### 1.7 Obsidian export (`export.to_obsidian`)

- One note per node with `[[wikilinks]]`, plus one `_COMMUNITY_<name>.md` overview per community.
- A manifest (`.graphify_obsidian_manifest.json`) records which files Graphify owns. A pre-existing file that is not in the manifest is the user's and is never overwritten.
- Writes are skipped when the content is byte-identical, to avoid churn and re-index storms.
- Stems are capped against the vault path, for Windows `MAX_PATH`.

All four practices are adopted (FR-020).

### 1.8 How Graphify gets agents to use the graph

- **Codex, and other hosts that use instruction files:** a block in `AGENTS.md` that says "run `graphify query "<question>"` before your first grep, search or source-file read". It also says to put that rule in every subagent prompt, to use `path` and `explain` for focused questions, to read the report only for broad reviews, and to run `graphify update .` after code changes.
- **Claude Code and Gemini CLI:** a `PreToolUse` hook that nudges toward the graph before search and read calls.
- **Lesson:** an always-on instruction is necessary. A graph that the agent is not told about is not used.

### 1.9 Benchmarks, read honestly

| Claim | Evidence |
|---|---|
| "71.5x fewer tokens per query" | Printed after each run on a 52-file mixed corpus. The same table shows **5.4x** (4 files) and **~1x** (6 files). "Token reduction scales with corpus size." |
| Code QA (ERPNext, ~1M lines, n=6) | Key-fact coverage goes from **70.8% to 82.0%** at ~140k tokens per query. The gain is accuracy. Stuffing the whole repo costs ~20x the tokens for lower coverage. |
| Graph build cost | Zero LLM credits for the AST build. |

**Conclusion:** promise correctness first and token savings that grow with size, and measure them (SC-001).

## 2. Other second-brain approaches

| Project | How it works | What we take | What we leave |
|---|---|---|---|
| **Basic Memory** (`basicmachines-co/basic-memory`) | Markdown files are the source of truth, with SQLite or Postgres as an index. Observations `- [category] text #tag (context)`. Relations `- relation_type [[Target]] (context)`; a bare `- [[Target]]` or a Markdown link means `links_to`. `build_context(url, depth=1 (max 5), timeframe="7d", max_related=10)`. Forward references are kept as unresolved edges (`to_id` NULL plus `to_name`). | **Relation lines** in notes (FR-003). Files as the source of truth with a rebuildable index. Paging and depth caps. | A SQL index (a new dependency, against principle IV). Unresolved edges as graph edges: we report them in lint instead. |
| **Karpathy's "LLM Wiki"** (idea file plus community stacks) | Three layers: `raw/` sources (immutable), `wiki/` (owned by the LLM), and a schema file (`CLAUDE.md`/`AGENTS.md`). Three operations: **ingest**, **query**, **lint**. `index.md` is the catalog read first, and `log.md` is the append-only history. | **Lint** as a first-class operation (`lint_memory`). A cheap entry point (`graph_report`). A schema file (server instructions plus an `AGENTS.md` snippet). | Ingesting external sources (URLs, PDFs) is out of scope. |
| **second-brain-mcp** (`noesskeetit/second-brain-mcp`) | A read-only stdio server (overview, semantic search, read, backlinks) using the local bge-m3 embedder (2.3 GB). Writes only through a human-approved "to_obsidian" flow. "Memory is what you chose to remember." | **Curation beats volume.** AMBIGUOUS relations go to review, and REJECTED ones are remembered. Backlinks as a first-class query (`get_node` incoming edges). | Embeddings (a heavy download and a dependency). |
| **Obsidian + Graphify** (community write-ups) | Obsidian holds declarative memory ("what was decided"). Graphify holds structural memory ("how the code is wired"). Claude and Codex share one vault through MCP. | The split matches ours: specs and memory now; code structure could be a later feature. | Requiring the Obsidian app. |
| **Obsidian MCP servers** (obsidian-gate, maxkuminov/obsidian-mcp) | Vault CRUD, backlinks, tags. Some use the Local REST API plugin, so Obsidian must be running. One uses FastAPI, Postgres and pgvector. | Nothing beyond confirming the pattern. | Any dependency on the Obsidian app or on a database server. |

## 3. What the clients really do

Sources: the `openai/codex` source on `main` (`codex-rs/config/src/mcp_types.rs`, `codex-mcp/src/rmcp_client.rs`, `core/src/mcp_tool_call.rs`, `tools/src/json_schema/compaction.rs`, `core/src/agents_md.rs`), Claude Code's MCP and subagent docs, and the MCP spec 2025-06-18 and 2025-11-25. Items marked *unverified* could not be confirmed against a released build.

### 3.1 Codex

- **Config:** `[mcp_servers.<name>]` with `command`, `args`, `env`, `cwd`, `startup_timeout_sec` (docs default 10 s), `tool_timeout_sec` (60 s), `enabled_tools`, `disabled_tools`, per-tool `approval_mode` and `output_token_limit`.
- **Approvals follow the annotations.** In auto mode a call needs approval **unless `readOnlyHint: true`, or `destructiveHint: false` and `openWorldHint: false`**. A missing `destructiveHint` or `openWorldHint` counts as true.
  - Today `save_memory` and `log_decision` declare only `destructiveHint: false`, so Codex asks the user to approve every call.
  - This feature fixes it for all tools (FR-029), and it is why `save_relations` never deletes a row (R11).
- **Schema size:** an input schema over 5,000 bytes is compacted (parameter descriptions are stripped first). Keep schemas small and put the semantics in the description.
- **Server `instructions`** become the description of the server's tool namespace in the current source. Older releases may ignore them (issue #6148, closed "not planned"). So instructions are necessary but not sufficient, and the `AGENTS.md` snippet is still needed.
- **MCP prompts:** no client support found. MCP resources: client support exists (*partially unverified*). **Everything must be reachable through tools.**
- **`structuredContent`:** when present, Codex sends only it to the model and ignores `content`. Specwright keeps returning JSON text only, consistently.
- **`AGENTS.md`** is discovered from `~/.codex` and then from the git root down to the cwd (`AGENTS.override.md` wins). `project_doc_max_bytes` is 32 KiB shared across all files, and anything over it is silently truncated. The snippet must stay short.
- **Subagents and MCP:** the evidence conflicts (issues #20135, #38353, #16475). A child may inherit the parent's servers, start its own stdio process, or not see them. **Design for one server process per subagent:** a fast cold start (disk snapshot), cross-process locks on writes, and stateless batches.
- **Tool search:** reportedly on by default in recent Codex (*unverified*). No tool-count cap was found.

### 3.2 Claude Code

- Tool output: a warning at 10,000 tokens, `MAX_MCP_OUTPUT_TOKENS` default 25,000, and results over 50,000 characters are spilled to a file. Our 20,000-character default is well inside.
- Server instructions are loaded at session start and cut at 4,096 characters. Put the important part first.
- Tool search is on by default: MCP tools are deferred and their descriptions loaded on demand, so a longer tool list costs little context. Names and descriptions still matter for retrieval.
- `readOnlyHint` lets read-only calls run in parallel. `idempotentHint` allows one retry after a dropped connection.
- Subagents inherit the parent's MCP connection by default.

### 3.3 Prompt caching (why determinism matters)

- **OpenAI:** automatic for prompts of 1,024 tokens or more, with exact prefix match. Tool definitions and their order are part of the prefix. A reordered or changed tool list, timestamps or whitespace early in the prompt all cause misses.
- **Anthropic:** the prefix order is tools → system → messages. Changing a tool definition invalidates everything after it. The TTL is 5 minutes (refreshed on hit), or optionally 1 hour.
- **Consequences:**
  - a static, deterministically ordered tool list registered at startup, with no `list_changed`;
  - byte-identical responses for the same files and arguments (FR-026), so repeated tool results do not break the cache of later turns;
  - no timestamps or per-call noise in responses.

## 4. Obsidian, GitHub and VS Code facts

- **Link forms:** `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]` and embeds `![[Note]]`. `[[Note]]`, `[[Note.md]]` and `[text](Note%20name.md)` are equivalent. A link path matches as a path suffix. Wikilinks are case-insensitive (*community-reported*). Which duplicate basename a bare link picks is *unverified*, so we refuse to guess (no edge, lint warning).
- **Markdown links** count as links in Obsidian's link cache (`LinkCache` covers both forms). GitHub does **not** render wikilinks; they show as literal text. **Writing standard relative Markdown links is the portable choice. Reading both forms is mandatory.**
- **Dot-paths:** Obsidian ignores files and folders whose vault-relative path starts with `.`. If the repository root is opened as a vault, `.specify/**` is invisible. Whether a vault *root* can sit at a hidden path (`.specify/graph/vault`) is *unverified*, so `graph.vaultDir` is configurable (FR-021) and the quickstart says how to check.
- **`.obsidian/`** is the per-vault config folder (`workspace.json` changes on every file open). An exporter must never create or write it.
- **Tags:** frontmatter `tags` is a YAML list. Inline `#SW-12` would become a tag, so the export avoids bare `#` text.
- **Mermaid:** GitHub renders `mermaid` fences in Markdown files, and VS Code's built-in preview renders them since 1.121. Mermaid's defaults are `maxTextSize` 50,000 and `maxEdges` 500, and diagrams cannot raise them. GitHub's exact version and limits are *unverified*, so diagrams are capped at 40 nodes and 100 edges, with a plain edge list as fallback.

## 5. Louvain, made deterministic

- **Gain for moving an isolated node `i` into community `C`:**

  ΔQ = k_i,in / m − γ · Σ_tot · k_i / (2m²)

  - `m`: total edge weight, each undirected edge counted once;
  - `k_i`: the weighted degree of `i`;
  - `k_i,in`: the weight from `i` to `C`;
  - `Σ_tot`: the sum of the weighted degrees in `C`, with `i` removed first;
  - `γ`: the resolution, 1.

  This matches networkx's implementation (`wt·m − (γ/2)·Σ_tot·k_i`, scaled).
- **Loop:**
  1. Start with singletons.
  2. Local moving: visit nodes and move each to the neighbouring community with the best positive gain, until no node moves.
  3. Aggregate communities into supernodes (intra-community weight becomes a self-loop).
  4. Repeat until a level changes nothing or the gain is ≤ 1e-7.
- **Determinism** (networkx shuffles and graphology uses `Math.random`, so neither is deterministic by default):
  - visit nodes in sorted-id order;
  - scan neighbour communities in ascending community index;
  - compare gains with an epsilon (1e-10), and on a tie stay put or take the lowest index;
  - after each level, relabel communities by their smallest member;
  - after the run, split each community into its connected components (a cheap guard against Louvain's badly connected communities, which Leiden fixes properly);
  - give final ids by size (descending), then smallest member.
- **Speed:** graphology's JS Louvain runs ~0.94 s on 50k nodes and ~1M edges. A plain TypeScript version on our ≤ 75k nodes and ~150k edges fits SC-003, and communities are computed lazily (only for `graph_report`, `get_node` and `export_graph`) and cached per graph version.
- **Label propagation** is simpler but breaks ties at random, so it is rejected.

## 6. Where Specwright stands

What the feature reuses:
- `features/` already parses ids, stories, tasks with `[USn]` labels and phases, and sections. `context/files.ts` (`extractPaths`) already finds cited paths. `decisions/` already reads the `feature` field. `memory/` reads notes with tags. `constitution/` reads principles. `storage/` has the path guard, `writeAtomic`, `createExclusive`, `withLock`, `mapLimit`, `tokenize` and `slugify`.
- Measured `tools/list` today: 5,966 characters for 10 tools (149–277-character descriptions, 371–754 characters per entry). Eight more tools at ~800 characters each lands near 12.5k, so the 12,000 budget has to change in any case (FR-025 sets 16,000 in total and 1,200 per tool).
- Performance today with 500 features and 1,000 notes: `pack_context`, which reads everything, takes 365 ms. A cold graph build reads the same files plus a few more, so 1.5 s is a safe cold budget, and warm calls avoid the reads entirely.
- The dogfood test (`tests/integration/repository-dogfood.test.ts`) lists the features of this repository exactly, so adding `specs/010-second-brain/` must update it in the same commit.

Constitution conflicts, to be amended in this feature (FR-030):
- **III. "At most 10 tools":** removed by the owner. It becomes a per-tool and total size budget, plus "no overlapping tools".
- **IV. "No database, no cache":** it becomes "files are the source of truth". Derived, rebuildable, fingerprint-validated caches under `.specify/graph/` are allowed. A database server, a vector index or an external service are still not allowed.
- **VI. Safe file access:** reads gain `graph.include` folders (Markdown only, read-only). Writes gain `.specify/graph/**` and the configured `graph.vaultDir` (for `export_graph` only). `.specify/memory/relations/**` is already inside `.specify/memory/**`.

## 7. Decisions

### R1. Engine and interfaces: MCP first, plus a thin CLI

- **Decision**: The graph lives in a new `src/graph/` module inside the server. Agents use it through MCP tools. The same binary gets a `graph` subcommand (`specwright-mcp graph query|node|path|report|lint|export`) that calls the same module functions and prints the same JSON. There are no git hooks and no file watcher.
- **Rationale**:
  - Codex and Claude Code both speak MCP, and tools are the only surface both support fully (no prompts in Codex).
  - The CLI covers people, CI (`graph lint` fails the build on broken links) and agents in environments without MCP.
  - Graphify needs hooks because its extraction is expensive and offline. Ours validates freshness on every call, so hooks add nothing.
- **Alternatives considered**:
  - CLI only, like Graphify's skill mode: agents would lose the typed, budgeted tool responses and would need shell access.
  - A separate binary: more packaging for no gain.
  - A file watcher: a long-lived process and platform quirks, and fingerprint checks are already cheap.

### R2. Source of truth: Markdown files; the graph is derived

- **Decision**: Nodes and explicit edges come from the existing Spec Kit and memory files. Semantic relations, concepts and coverage live in Markdown ledgers in `.specify/memory/relations/<scope>.md` (versioned in Git). Everything under `.specify/graph/` is derived and git-ignored.
- **Rationale**:
  - It keeps principle I (readable, reviewable Markdown).
  - Teammates and CI share the semantic layer through Git.
  - Deleting `.specify/graph/` loses nothing.
- **Alternatives considered**:
  - JSON or JSONL ledgers: easier to parse, but not reviewable on GitHub and not readable in Obsidian.
  - Writing relations into the source notes (Basic Memory style): it would edit Spec Kit artifacts the server must not write (`spec.md`, `plan.md`), and concentrate merge conflicts in hot files.
  - A database: violates G4 and principle IV.

### R3. Explicit layer: what counts as an EXTRACTED edge

- **Decision**: `contains`, `implements` (`[USn]`), `references` (scoped id mentions, qualified mentions, existing feature ids, "decision NNNN"), `touches` (cited paths that are not sources), `links_to` (Markdown links and wikilinks), `belongs_to` (decision frontmatter) and relation lines in the vocabulary. Unqualified ids outside a feature context, and ambiguous link targets, create no edge.
- **Rationale**:
  - These are exactly the links people and Spec Kit already write, so the graph is useful before any extraction.
  - Refusing to guess (Graphify's rule) keeps EXTRACTED meaning "explicit".
- **Alternatives considered**:
  - Fuzzy matching of titles: false edges labeled as certain.
  - Treating unresolved links as edges to placeholder nodes (Basic Memory, Obsidian graph view): useful for drafting, but it pollutes queries. Lint reports them instead.

### R4. Node ids are typed and stable

- **Decision**: `kind:` prefix plus a natural key (`requirement:006-memory/FR-003`, `decision:0007`, `note:<slug>`, `file:<path>`, `concept:<slug>` and so on). Tools also accept short forms and labels (FR-012).
- **Rationale**:
  - Ids are human-readable in ledgers and tool output.
  - They survive rebuilds and never collide across kinds.
  - The model can write them back exactly.
- **Alternatives considered**:
  - Hashes: unreadable in a Markdown ledger.
  - Bare natural keys: `0007` and `T007` would collide across features.

### R5. Semantic layer: the client agent extracts, the server plans and stores

- **Decision**: `extraction_batch` returns either a plan (pending units grouped into token-bounded batches) or the content of given units, with instructions and candidate ids. `save_relations` validates and stores relations, concepts and coverage. The unit is a `##` section, or the whole file when it has none.
- **Rationale**:
  - It keeps principle II (no model in the server).
  - The plan/fetch split is stateless, so batches stay disjoint even across processes and parallel subagents (Codex subagents may run their own server process).
  - Section-level units make re-extraction proportional to what changed.
  - Candidate ids in the fetch response let the model emit valid ids, and invalid ones come back with a reason.
- **Alternatives considered**:
  - A server-side batch lease (`next_batch`): needs shared state across processes.
  - File-level units: one edited line would re-send a whole spec.
  - MCP prompts to drive extraction: Codex has no prompts client.
  - Letting the server call a model: violates principle II and needs API keys.

### R6. The token cache: coverage records in Git

- **Decision**: Each analyzed unit gets a coverage row `{ unit, hash (sha256, 16 hex), extractor version, date }` in its scope's ledger. A unit is pending only when its current hash or the extractor version differs. A stale hash on save is rejected.
- **Rationale**:
  - This is Graphify's semantic cache (content hash plus prompt version), and it is what saves model tokens.
  - Storing it in Git means no clone, teammate or CI run pays for the same extraction twice.
- **Alternatives considered**:
  - Keeping coverage in the git-ignored cache: every clone re-extracts everything.
  - File modification times: they change on checkout.
  - Full SHA-256 hex: 64 characters per row for no practical gain over 16 (64 bits).

### R7. The speed cache: in memory plus a disk snapshot, validated by fingerprint

- **Decision**:
  - The graph is held per root in memory.
  - On each call, every source file is `stat`ed and `(size, mtimeMs)` is compared. Only changed files are re-read and re-parsed, then the graph is rebuilt from the per-file facts.
  - `.specify/graph/cache.json` persists the per-file facts for new processes.
  - `graph.cache` takes `disk` (default), `memory` or `off`.
- **Rationale**:
  - Stats are an order of magnitude cheaper than reads plus parses.
  - Rebuilding from cached facts is linear and keeps the code simple, with no incremental graph surgery.
  - The snapshot makes the first call of each Codex subagent process fast.
  - The result equals a full rebuild, which is tested.
- **Alternatives considered**:
  - Redis or another service: violates G4, adds an install step and a network dependency, and the work to cache is parsing, which lives in the same process anyway.
  - Hashing every file on every call: correct, but it reads everything.
  - Watching the file system: platform differences and long-lived state.

  **Accepted risk:** an edit that keeps both size and mtime the same is missed until the next change. Modern file systems store nanosecond mtimes, and `graph.cache: "off"` is there to rule the cache out when debugging.

### R8. Ledger format: Markdown tables, sorted, one row per fact

- **Decision**: Each ledger file has frontmatter `{ scope }`, a `# Relations: <scope>` title, and three tables:

  | Table | Columns |
  |---|---|
  | `## Concepts` | `id`, `label`, `summary` |
  | `## Relations` | `source`, `relation`, `target`, `confidence`, `score`, `evidence`, `date` |
  | `## Coverage` | `unit`, `hash`, `version`, `date` |

  Rows are sorted by key. `|` in cells is escaped as `\|`, and newlines become spaces.
- **Rationale**:
  - Tables render on GitHub, in VS Code and in Obsidian.
  - One row per fact gives one-line diffs (SC-006).
  - Sorted insertion is deterministic.
  - Per-scope files spread merge conflicts across features.
- **Alternatives considered**:
  - One ledger for the whole project: a merge-conflict hotspot.
  - One file per relation: thousands of tiny files.
  - Bullet relation lines: harder to carry confidence, score and evidence.

### R9. Relation vocabulary and confidence

- **Decision**:
  - Semantic relations: `depends_on`, `implements`, `rationale_for`, `supersedes`, `contradicts`, `refines`, `part_of`, `tests`, `uses`, `example_of`, `similar_to`, `related_to`.
  - The client may write `INFERRED` (0.5–0.99), `AMBIGUOUS` (0.1–0.49) or `REJECTED` (0), never `EXTRACTED`.
  - Relation lines written by people in Markdown count as `EXTRACTED`.
- **Rationale**:
  - A closed vocabulary keeps queries and reports meaningful across models (Codex and Claude will phrase things differently).
  - `related_to` is the escape hatch.
  - Score bands mirror Graphify's.
- **Alternatives considered**:
  - Free-form relations: inconsistent across models.
  - Hyperedges: useful in Graphify, but they complicate every tool. Concepts linked with `part_of` express the same group.

### R10. Concepts live in the project ledger

- **Decision**: New ideas found by the agent are `concept:<slug>` nodes with label and summary, stored in `project.md`'s Concepts table. The export turns them into Obsidian notes.
- **Rationale**:
  - Concepts are shared across features.
  - One row per concept keeps extraction cheap (no file per concept).
  - People can promote a concept to a full note with `save_memory` and link it.
- **Alternatives considered**:
  - A note file per concept: many files and heavy writes per batch.
  - Concepts per feature ledger: duplicates across features.

### R11. Never delete; reject

- **Decision**: `save_relations` has no delete operation. A wrong relation is saved again as `REJECTED`, which removes the edge and blocks the same proposal in future extractions. People delete rows by editing the file.
- **Rationale**:
  - A delete would make the tool destructive, and Codex would then ask for approval on every batch save in auto mode.
  - Remembering rejections stops the model from re-proposing the same wrong edge, which saves tokens and avoids churn.
- **Alternatives considered**:
  - A `remove` field (destructive annotation, approvals).
  - A separate `remove_relations` tool: one more tool for a rare action.

### R12. Query: scoped seeds, hub-aware traversal, budget that never drops seeds

- **Decision**:
  1. Terms come from the existing `tokenize`.
  2. Seed score: exact id or short-form match 1000, label term 3, tag 2, text 1. Ties go by degree, then id. Up to 3 seeds, restricted to the `feature` scope when given.
  3. BFS (default) or DFS up to `depth`. Nodes with degree ≥ `max(50, p99)` are not expanded unless they are seeds. AMBIGUOUS edges are skipped unless `include_ambiguous` is set, and REJECTED is never an edge.
  4. Ranking: seeds, then distance, then best edge score, then term score, then id.
  5. Output: nodes as compact objects, and edges as arrays `[source, relation, target]` for EXTRACTED or `[source, relation, target, confidence, score]` otherwise.
  6. Trimming keeps the seeds and reports omitted counts and the budget needed.
- **Rationale**:
  - These are Graphify's proven mechanics, adapted to our tokenizer and estimate.
  - The array edges roughly halve edge tokens compared with objects.
  - Reporting the budget needed avoids blind retries.
- **Alternatives considered**:
  - IDF weighting: marginal on Spec Kit-sized graphs. It can be added later behind the same function.
  - Text rendering: harder for agents to post-process and to test.

### R13. Overview: deterministic Louvain plus Graphify's heuristics

- **Decision**:
  - Communities come from deterministic Louvain (section 5) on the undirected graph, weighted by score, with `file` nodes included.
  - A community's label is the label of its highest-degree non-file member, prefixed with its feature title when one feature holds most members.
  - God nodes and surprises follow section 1.6, adapted:
    - "different file categories" becomes "different node kinds";
    - "different top-level dirs" becomes "different features";
    - `contains` and `belongs_to` are skipped.
  - Questions follow the five generators of section 1.6, using betweenness estimated by BFS from at most 100 sampled nodes (sampled as the lowest ids).
- **Rationale**: Graphify's outputs work well, and determinism comes from the sorted orders and fixed sampling.
- **Alternatives considered**:
  - Leiden: better-connected communities, but a randomized refinement step. The connected-component split covers the practical issue.
  - Exact betweenness: O(V·E), too slow at 75k nodes.

### R14. Views: JSON, Markdown report with Mermaid, Obsidian vault

- **Decision**: `export_graph` writes:
  - `json`: a node-link structure close to Graphify's;
  - `report`: `GRAPH_REPORT.md` with Mermaid diagrams capped at 40 nodes and 100 edges, plus an edge-list fallback;
  - `obsidian`: one note per node with wikilinks by vault-relative path with aliases, `_community-<n>.md` notes, a manifest, and byte-identical skips; it never writes `.obsidian/`.
- **Rationale**:
  - People without Obsidian get a report that renders on GitHub and in VS Code, and tools get JSON.
  - Obsidian users get the graph view.
  - The manifest protects user notes, as Graphify's does.
- **Alternatives considered**:
  - `graph.html` with a JS library: it needs a bundled viz library (a dependency) or a CDN (network).
  - Canvas files: Obsidian-only and verbose.

### R15. Extra Markdown folders are opt-in

- **Decision**: `graph.include` lists root-relative folders whose `.md` files become `doc` nodes, read-only, through a new read guard that refuses `..`, absolute paths, dot-folders, `.git`, `node_modules` and symlink escapes.
- **Rationale**: product docs, ADRs and existing vaults belong in a second brain, and opt-in keeps today's read scope by default (NFR-6).
- **Alternatives considered**:
  - Reading the whole repository: it would read code and secrets.
  - A fixed `docs/` folder: projects differ.

### R16. Always-on guidance

- **Decision**: Server `instructions` (≤ 1,200 characters, most important line first) plus a README snippet for `AGENTS.md` and `CLAUDE.md`, and an `AGENTS.md` in this repository.
- **Rationale**:
  - Claude Code loads instructions (cut at 4,096 characters).
  - Codex uses them as the namespace description in current builds but maybe not in older ones.
  - `AGENTS.md` is read by every Codex build.
  - Graphify's experience: without an always-on rule agents grep instead.
- **Alternatives considered**:
  - Hooks: client-specific, and Codex has none comparable.
  - MCP prompts: unsupported by Codex.

### R17. Tool surface after the 10-tool cap is removed

- **Decision**:
  - 8 new tools: `query_graph`, `get_node`, `find_path`, `graph_report`, `extraction_batch`, `save_relations`, `lint_memory`, `export_graph`.
  - Budgets: ≤ 2 sentences per description, ≤ 1,200 characters per tool entry, ≤ 16,000 characters for the whole listing.
  - Every tool declares `openWorldHint: false` plus read-only or non-destructive hints.
- **Rationale**:
  - Each tool maps to a distinct question an agent asks.
  - Merging neighbours or communities into `get_node` and `graph_report` avoids Graphify's 7-tool spread.
  - The budgets keep schemas under Codex's 5,000-byte compaction and the listing small even without tool search.
  - The annotations remove Codex approval prompts.
- **Alternatives considered**:
  - One `graph` tool with a `command` argument: a schema too large for Codex and descriptions too vague for tool search.
  - Separate `get_neighbors`, `get_community` and `graph_stats` tools: overlap.

### R18. `pack_context` follows the graph only when asked

- **Decision**: Add `graph: boolean` (default false). When true, items linked to the top 3 ranked items get a boost of half the linking item's score.
- **Rationale**: it recovers related decisions and notes that share no words with the task. Off by default, so existing behavior and tests stay unchanged.
- **Alternatives considered**:
  - On by default: it changes established outputs.
  - A separate tool: overlaps `query_graph`.

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The model emits wrong ids or relations | Medium | Candidate ids in each batch, per-item validation with reasons, closed vocabulary, `REJECTED` memory, lint |
| Over-linking (`related_to` everywhere) makes queries noisy | Medium | Score bands; AMBIGUOUS excluded from traversal by default; instructions ask for specific relations; report shows the relation mix |
| Stale cache served after an unusual edit | Low | Fingerprint plus snapshot schema version; `graph.cache: "off"`; equality test against a full rebuild |
| Merge conflicts in ledgers | Low | Per-scope files, sorted rows, one row per fact |
| Tool list grows and costs context | Low | Per-tool and total budgets, contract test, tool search in both clients |
| Obsidian cannot open a vault at a hidden path | Low | `graph.vaultDir` setting; quickstart check |
| Performance on very large projects | Medium | Lazy communities, a cached graph version, p99 hub guard, perf and load tests at 500 and 2,000 features |

## 9. Future work (not in this feature)

- A code-structure layer (tree-sitter, as in Graphify), probably as a separate feature with its own dependency decision.
- Leiden refinement, if Louvain communities prove poor.
- Ingesting external sources (`raw/` in Karpathy's pattern): URLs, PDFs, transcripts.
- An HTML viewer, if a dependency-free approach appears.
- `outputSchema` and `structuredContent`, once Claude Code's handling is confirmed.

## 10. Sources

**Graphify**
- https://github.com/safishamsi/graphify: `README.md`, `ARCHITECTURE.md`, `BENCHMARKS.md`, `graphify/serve.py`, `export.py`, `cache.py`, `analyze.py`, `cluster.py`, `markdown_resolution.py`, `skill-codex.md`, `always_on/agents-md.md`, `skills/kilo/references/extraction-spec.md`
- https://claudelog.com/claude-code-mcps/graphify
- https://docs.rs/graphify-rs (graph.json compatibility of the Rust port)

**Other second-brain projects**
- Basic Memory: https://github.com/basicmachines-co/basic-memory (`README.md`, `src/basic_memory/markdown/plugins.py`, `mcp/tools/build_context.py`, `models/knowledge.py`)
- second-brain-mcp: https://github.com/noesskeetit/second-brain-mcp
- Karpathy LLM Wiki: https://github.com/ScrapingArt/Karpathy-LLM-Wiki-Stack, https://denser.ai/blog/llm-wiki-karpathy-knowledge-base/
- Obsidian + agents write-ups: https://www.mindstudio.ai/blog/ai-second-brain-claude-code-obsidian-architecture, https://www.mindstudio.ai/blog/andrej-karpathy-llm-wiki-obsidian-codeex-second-brain, https://github.com/lucasrosati/claude-code-memory-setup

**Codex**
- https://github.com/openai/codex: `codex-rs/config/src/mcp_types.rs`, `codex-mcp/src/rmcp_client.rs`, `codex-mcp/src/pagination.rs`, `core/src/mcp_tool_call.rs`, `tools/src/json_schema/compaction.rs`, `core/src/agents_md.rs`, `protocol/src/models.rs`
- Issues #6148, #7138, #16475, #20135 and #38353

**Claude Code**
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/sub-agents

**Prompt caching**
- https://github.com/openai/openai-cookbook (`examples/Prompt_Caching101.ipynb`, `Prompt_Caching_201.ipynb`)
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool

**MCP specification**
- https://github.com/modelcontextprotocol/modelcontextprotocol (`docs/specification/2025-06-18/server/tools.mdx`, `schema/2025-06-18/schema.ts`, `docs/specification/2025-11-25/server/tools.mdx`)

**Obsidian, GitHub, VS Code, Mermaid**
- Obsidian help (from `obsidianmd/obsidian-help`): internal links, embeds, graph view, properties, aliases, tags, data storage and configuration folder
- `obsidianmd/obsidian-api` (`obsidian.d.ts`)
- GitHub docs: creating diagrams
- `mermaid-js/mermaid` (`config.schema.yaml`)
- `microsoft/vscode-docs` (`docs/languages/markdown.md`)

**Algorithms**
- networkx `algorithms/community/louvain.py` and `label_propagation.py`
- graphology `communities-louvain`
- `vtraag/leidenalg` (`doc/source/intro.rst`)
