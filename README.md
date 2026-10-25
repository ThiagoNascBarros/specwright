<div align="center">

# Specwright

**The memory and validation layer for [GitHub Spec Kit](https://github.com/github/spec-kit) projects.**

Specwright is an [MCP](https://modelcontextprotocol.io) server that lets a coding agent:
- read only the Spec Kit artifact, or the section of it, that it needs;
- check its work against the spec's requirements and acceptance scenarios;
- mark tasks done exactly like `/speckit-implement`;
- record decisions and remember what earlier sessions learned;
- assemble the minimal context for a task;
- ask a knowledge graph of the whole project how things relate, instead of reading files.

Everything stays plain Markdown in your repository, in Spec Kit's own layout. The graph can also be browsed as a Markdown report or an Obsidian vault.

[![CI](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml/badge.svg)](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.12-339933)
![MCP tools](https://img.shields.io/badge/MCP%20tools-18-7c3aed)
![Spec Kit](https://img.shields.io/badge/Spec%20Kit-v1.2.x-2ea44f)

</div>

---

## Why

Spec Kit gives your agent a process: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Three problems remain during implementation:

1. **Spec drift.** As the session goes on, the agent drifts from `spec.md` and nobody notices until review.
2. **Amnesia between sessions.** Decisions and pitfalls found while implementing are lost when the context ends.
3. **Bloated context.** To be safe, the agent rereads whole specs, plans and task lists.

Specwright reads the files Spec Kit writes and gives the agent small, structured answers. It closes this loop:

```
spec.md → code → check_against_spec → set_task_status → log_decision / save_memory
```

## How it fits Spec Kit

| Spec Kit writes | Specwright |
|---|---|
| `specs/NNN-name/spec.md` (`/speckit-specify`, `/speckit-clarify`) | reads user stories, `FR-###`, `SC-###`, edge cases, assumptions and `[NEEDS CLARIFICATION]` markers |
| `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` (`/speckit-plan`) | returns any of them, or just one section |
| `tasks.md` (`/speckit-tasks`) | lists open `T###` tasks by story and marks them `[X]`, one character, like `/speckit-implement` |
| `checklists/*.md` (`/speckit-checklist`) | read-only, since checklist markers belong to the reviewer |
| `.specify/memory/constitution.md` (`/speckit-constitution`) | returns it and makes its principles searchable |
| (nothing) | adds `.specify/memory/decisions/`, `.specify/memory/notes/` and `.specify/memory/relations/` for project memory, and a derived, git-ignored `.specify/graph/` |

Specwright never creates features, plans or tasks. That stays with Spec Kit's skills.

## Principles

- **Your files, Spec Kit's format.** No proprietary layout. Everything is versioned in Git and readable by humans.
- **No LLM inside the server.** It needs no API key and makes no model calls. The agent that calls it does the judging.
- **Well-described, non-overlapping tools.** There are 18, and the whole `tools/list` stays under 16,000 characters.
- **No database. The cache never goes stale.** The graph's cache is derived from your files, git-ignored and checked against each file's size and modification time on every call.
- **Safe by default.**
  - The server has no network access and runs no commands.
  - It reads only `specs/`, `.specify/` and the folders you list in `graph.include`.
  - It writes only `tasks.md` checkboxes, `.specify/memory/`, `.specify/graph/` and the Obsidian vault folder.
  - Writes are atomic and byte-minimal, and nothing is ever overwritten.

## Tools

| Tool | Use it to… |
|---|---|
| `list_features` | find the feature your task belongs to (id, title, status, artifacts, task progress, open clarifications) |
| `get_artifact` | read `spec`, `plan`, `tasks`, `research`, `data-model`, `quickstart`, a named `checklist` or `contract`, or the `constitution`, whole or one `##` section |
| `list_open_tasks` | see open `T###` tasks for one feature or all, optionally for one story (`US1`) |
| `set_task_status` | mark a task `[X]` (or reopen it); only that checkbox character changes |
| `check_against_spec` | send your diff before saying "done"; get requirements, success criteria, scenarios, edge cases, open tasks and a per-file summary |
| `log_decision` | record a decision (Decision / Rationale / Alternatives considered) linked to a feature |
| `list_decisions` | list decisions by feature or date range |
| `save_memory` | save a convention, learning or pitfall for future sessions |
| `search_memory` | search notes, decisions and constitution principles, ignoring case and accents |
| `pack_context` | get the most relevant spec and plan sections, open tasks, principles, decisions and cited files for a task, within a token budget; `graph: true` also follows links from the top matches |
| `query_graph` | ask a question and get a ranked subgraph of requirements, tasks, decisions and notes that fits a token budget |
| `get_node` | read one node (`FR-003` with a feature, `0007`, a note slug, a path or a title) with its excerpt, links and backlinks |
| `find_path` | see the shortest chain of links between two nodes |
| `graph_report` | get an overview: counts, most-connected nodes, communities, surprising connections and suggested questions |
| `extraction_batch` | get the sections your agent has not analyzed yet, grouped into batches |
| `save_relations` | store the relations and concepts your agent found, and mark sections as covered |
| `lint_memory` | find broken links, dangling relations, invalid ledger rows, orphans, duplicates and contradictions |
| `export_graph` | write `graph.json`, a Markdown report with Mermaid diagrams, or an Obsidian vault |

Full contracts: [specs/009-speckit-format/contracts/tools.md](specs/009-speckit-format/contracts/tools.md) for the first 10 tools, and the "Tool contracts" section of [specs/010-second-brain/plan.md](specs/010-second-brain/plan.md) for the graph tools.

## Quick start

### 1. Install and connect

Requires **Node.js 22.12 or later**. Open your agent in the Spec Kit project where you want to use Specwright and paste this prompt:

```text
Install the Specwright MCP server for this project.

1. Run `node --version`. If it is older than 22.12, stop and tell me.
2. Clone https://github.com/ThiagoNascBarros/specwright.git into a folder outside this project. In that clone, run `npm ci` and then `npm run build`.
3. Register the server with your MCP client, using the absolute path to `dist/index.js` in that clone. In Claude Code, run this from the root of this project: `claude mcp add specwright -- node <absolute path>/dist/index.js`. In any other client that supports stdio servers, add an entry with `command` set to `node` and that path as the only argument.
4. Tell me if I need to restart the client, then call `list_features` and show me the result.
```

### 2. Configure by hand (optional)

To commit the configuration instead, add a `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "specwright": {
      "command": "node",
      "args": ["/absolute/path/to/specwright/dist/index.js"],
      "env": { "SPECWRIGHT_ROOT": "." }
    }
  }
}
```

A relative `SPECWRIGHT_ROOT` is resolved against the server's working directory, so `.` only works if your client starts servers from the project root. If it does not, use an absolute path, such as `/absolute/path/to/your-project`.

Any MCP client that supports stdio servers works the same way.

### 3. Your first feature

Specs are written by Spec Kit's skills. Specwright reads them. In your agent:

```text
/speckit-specify Build a photo organizer with albums grouped by date.
/speckit-plan    Use FastAPI and SQLite.
/speckit-tasks
```

Then paste this prompt:

```text
Use Specwright. Call `list_open_tasks` for the feature you just created, filtered to story US1, and implement those tasks test-first. Before finishing, call `check_against_spec` with your diff, report any requirement that is not met, and mark each verified task with `set_task_status`.
```

To try it without Spec Kit, copy [`examples/starter/`](examples/starter/) into a project. It holds `specs/001-auth-login/` and a constitution.

## Recommended agent instructions

Add this to your project's `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex). The `## Specwright` part is the same text the server sends to agents on `initialize`:

```markdown
## Specwright

Specwright keeps this project's specs, tasks, decisions and notes as a knowledge graph. Before reading whole files or searching for a spec or design question, call query_graph (get_node for one id, find_path for how two things relate) and read only what it points to. Start a task with pack_context and close it with check_against_spec, set_task_status and log_decision. To grow the graph, call extraction_batch for a plan of pending units, give each batch to one worker that calls extraction_batch with those units and then save_relations with the relations, concepts and covered hashes; parallel workers must take different batches. Run lint_memory after renaming or deleting files. Files under .specify/graph/ are derived; never edit them.

## Spec Kit + Specwright
- Start a task with `pack_context` (with the feature id), or `get_artifact` for one section. Do not read whole spec files.
- Before saying a task is done, call `check_against_spec` with your diff and report any unmet requirement or out-of-scope change.
- After verifying a task, call `set_task_status`. Record non-obvious choices with `log_decision`.
- Save conventions and pitfalls with `save_memory`; check `search_memory` before changing an approach.
```

## Second brain

Specwright turns `specs/`, `.specify/memory/` and any `graph.include` folders into one knowledge graph. It needs no model and no Obsidian.

**What is in the graph.** Every feature, artifact, requirement (`FR-###`), success criterion (`SC-###`), user story, task, constitution principle, decision, note and included document becomes a node with a typed id, such as `requirement:001-photo-albums/FR-002` or `decision:0007`. Edges come from what the files already say: a feature contains its items, a task implements its story, and mentions, links, wikilinks and cited paths connect the rest.

**The semantic layer.** Your own agent (Claude Code, Codex…) adds the relations the text implies but never states, such as "decision 0007 is the rationale for FR-011":
1. `extraction_batch` with no units returns a plan of the sections not analyzed yet, grouped into batches.
2. For each batch, a worker calls `extraction_batch` with those units, reads them, and calls `save_relations` with the relations, concepts and covered hashes. Parallel workers must take different batches.
3. The relations land in Markdown tables in `.specify/memory/relations/<scope>.md`, which you review and commit like any other file. A section is sent again only when its content changes.

To retire a wrong relation, save it as `REJECTED` (score 0): it stays in the ledger and is never re-added.

**Without Obsidian.**
- **Agents:** `query_graph`, `get_node`, `find_path` and `graph_report` answer from the graph, and `lint_memory` checks it.
- **Terminal:** the same JSON as the tools.

  ```bash
  node /path/to/specwright/dist/index.js graph report
  node /path/to/specwright/dist/index.js graph query "album sorting"
  node /path/to/specwright/dist/index.js graph node FR-002 --feature 001-photo-albums
  node /path/to/specwright/dist/index.js graph path note:sorting-pitfall decision:0001
  node /path/to/specwright/dist/index.js graph lint
  node /path/to/specwright/dist/index.js graph export report
  ```

  Exit codes: 0 on success; 1 on error, or for `lint` when an error is found; 2 on bad usage; 3 when a reference is ambiguous; 4 when no node matches.
- **GitHub:** `export_graph` with `report` writes `.specify/graph/GRAPH_REPORT.md`, whose Mermaid diagrams render on GitHub; `json` writes `.specify/graph/graph.json` for other tools.

**With Obsidian.** `export_graph` with `obsidian` writes one note per node, with wikilinks, plus one note per community, to `graph.vaultDir` (default `.specify/graph/vault`). Open that folder with "Open folder as vault".
- The default path starts with a dot, so the folder picker may hide it. If it does, set `graph.vaultDir` to a visible folder such as `brain` and open that one.
- Specwright never touches `.obsidian/` and never overwrites a file it did not write. It removes only its own files that are no longer produced.

**Codex.** Add the server to `~/.codex/config.toml`, and the agent instructions above to `AGENTS.md`:

```toml
[mcp_servers.specwright]
command = "node"
args = ["/absolute/path/to/specwright/dist/index.js"]
```

## Configuration

| Setting | Where | Default |
|---|---|---|
| Project root | `SPECWRIGHT_ROOT` environment variable, resolved against the server's working directory | the working directory |
| Maximum response size | `.specify/specwright.json` → `maxResponseChars` (integer ≥ 100) | `20000` |
| Extra Markdown folders for the graph (read-only) | `graph.include`, up to 20 relative folders such as `["docs"]`; not `specs`, `.specify`, dot-folders or `node_modules` | `[]` |
| Graph cache | `graph.cache`: `disk` (memory plus a snapshot), `memory`, or `off` | `disk` |
| Obsidian vault folder | `graph.vaultDir` | `.specify/graph/vault` |

```json
{ "maxResponseChars": 20000, "graph": { "include": ["docs"], "cache": "disk", "vaultDir": "brain" } }
```

```
<project>/
├── specs/
│   └── 001-photo-albums/        # spec.md, plan.md, tasks.md, research.md, data-model.md,
│                                # quickstart.md, contracts/, checklists/  (written by Spec Kit)
└── .specify/
    ├── specwright.json          # optional
    └── memory/
        ├── constitution.md      # written by /speckit-constitution
        ├── decisions/           # NNNN-<slug>.md, written by log_decision
        ├── notes/               # <slug>.md, written by save_memory
        └── relations/           # <scope>.md, written by save_relations
    └── graph/                   # derived and git-ignored: cache.json, graph.json, GRAPH_REPORT.md, vault/
```

Don't edit the files under `.specify/graph/` by hand. They are rebuilt from your files.

Feature folders are recognized by Spec Kit's naming: `NNN-short-name`, or `YYYYMMDD-HHMMSS-short-name`.

## Migrating from v0.1.0

v0.2.0 replaces the `.specwright/` format with Spec Kit's.

1. Each `.specwright/specs/<id>.md` becomes `specs/NNN-<id>/spec.md`, in Spec Kit's spec template. Acceptance criteria `AC-n` become requirements `FR-00n`, and progress moves to a `tasks.md` with one `T###` per item.
2. Move `.specwright/decisions/*` to `.specify/memory/decisions/`, and rename the `spec_id:` frontmatter key to `feature:` with the new id. Old `Context`/`Consequences` sections stay readable.
3. Move `.specwright/memory/*` to `.specify/memory/notes/`.
4. Replace `SPECWRIGHT_DIR` with `SPECWRIGHT_ROOT` (the project root), and `.specwright/config.json` with `.specify/specwright.json`.
5. Rename the tools in your agent instructions:

| v0.1.0 | v0.2.0 |
|---|---|
| `list_specs` | `list_features` |
| `get_spec` | `get_artifact` |
| `list_open_requirements` | `list_open_tasks` |
| `set_criterion_status` | `set_task_status` |
| `check_task_against_spec` | `check_against_spec` |

This repository went through the same migration in [PR SW-8](specs/009-speckit-format/spec.md).

## Performance

Medians measured with the test suite on a laptop:

| Scenario | Budget | Result |
|---|---|---|
| `list_features`, 500 features | < 500 ms | ~170 ms |
| `list_open_tasks`, 500 features (2,500 open tasks) | < 500 ms | ~165 ms |
| `get_artifact` with section | < 200 ms | < 1 ms |
| `search_memory`, 1,000 notes + 200 decisions | < 300 ms | ~185 ms |
| `pack_context`, 500 features + 1,000 notes | < 1 s | ~365 ms |
| 2,000 sequential calls over stdio | p95 < 50 ms | p95 ~36 ms |
| Graph cold build, 500 features + 1,000 notes | < 1.5 s | ~1.1 s |
| Warm `query_graph` / `get_node` / `find_path` | < 200 ms | ~120–140 ms |
| First `query_graph` of a new process, with the snapshot | < 600 ms | ~400 ms |
| First / repeated `graph_report` | < 1.5 s / < 300 ms | ~1.3 s / ~240 ms |
| Graph cold build, 2,000 features + 5,000 notes | < 6 s | ~3.9 s |

The load scenarios also cover:
- 500 concurrent calls and 200 concurrent writes;
- two server processes on the same root;
- 1,000 task updates;
- 2,000 features with 5,000 notes;
- two processes saving relations into the same ledger.

See [docs/tdd/phase-4.md](docs/tdd/phase-4.md) and [docs/tdd/phase-5.md](docs/tdd/phase-5.md).

## Documentation

| Document | Content |
|---|---|
| [Constitution](.specify/memory/constitution.md) | The project's principles (Spec Kit) |
| [PRD](docs/01-prd.md) / [TRD](docs/02-trd.md) | Product requirements; architecture, formats, tool contracts and errors |
| [Roadmap](docs/03-roadmap.md) | Phases and features |
| [Features](specs/) | Specwright's own Spec Kit features (it is built with itself) |
| [Decisions](.specify/memory/decisions/) and [ADRs](docs/adr/) | Why things are the way they are |
| [TDD records](docs/tdd/) | RED → GREEN evidence, requirement → test maps, and load results |

## Development

```bash
npm run build       # compile to dist/
npm run typecheck   # tsc for src and tests
npm test            # unit, integration and stdio contract tests
npm run test:load   # performance and load suites (serial)
```

One module per entity:
- `features/`, `constitution/`, `decisions/`, `memory/`, `context/` and `graph/`, plus `cli/` for the `graph` subcommand;
- each has its own types, repository, pure logic, and one file per tool;
- all sit on top of `storage/`, the only layer that touches the disk.

See [TRD §3](docs/02-trd.md#3-code-structure).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md): every change starts as a Spec Kit feature and is built test-first. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
