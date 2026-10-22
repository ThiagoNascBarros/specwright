<div align="center">

# Specwright

**The memory and validation layer for [GitHub Spec Kit](https://github.com/github/spec-kit) projects.**

Specwright is an [MCP](https://modelcontextprotocol.io) server that lets a coding agent:
- read only the Spec Kit artifact, or the section of it, that it needs;
- check its work against the spec's requirements and acceptance scenarios;
- mark tasks done exactly like `/speckit-implement`;
- record decisions and remember what earlier sessions learned;
- assemble the minimal context for a task.

Everything stays plain Markdown in your repository, in Spec Kit's own layout.

[![CI](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml/badge.svg)](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.12-339933)
![MCP tools](https://img.shields.io/badge/MCP%20tools-10-7c3aed)
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
| (nothing) | adds `.specify/memory/decisions/` and `.specify/memory/notes/` for project memory |

Specwright never creates features, plans or tasks. That stays with Spec Kit's skills.

## Principles

- **Your files, Spec Kit's format.** No proprietary layout. Everything is versioned in Git and readable by humans.
- **No LLM inside the server.** It needs no API key and makes no model calls. The agent that calls it does the judging.
- **Few, well-described tools.** There are 10, and the whole `tools/list` stays under 12,000 characters.
- **No database, no cache.** Files are reread on every call, so nothing goes stale.
- **Safe by default.**
  - The server has no network access and runs no commands.
  - It reads only `specs/` and `.specify/`.
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
| `pack_context` | get the most relevant spec and plan sections, open tasks, principles, decisions and cited files for a task, within a token budget |

Full contracts: [specs/009-speckit-format/contracts/tools.md](specs/009-speckit-format/contracts/tools.md).

## Quick start

### 1. Install

Requires **Node.js 22.12 or later**.

```bash
git clone https://github.com/ThiagoNascBarros/specwright.git
cd specwright
npm ci
npm run build
```

### 2. Add it to your MCP client

**Claude Code**, from the root of your Spec Kit project:

```bash
claude mcp add specwright -- node /absolute/path/to/specwright/dist/index.js
```

Or commit a `.mcp.json` at the project root:

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

### 3. Use it with Spec Kit

```text
/speckit-specify Build a photo organizer with albums grouped by date.
/speckit-plan    Use FastAPI and SQLite.
/speckit-tasks
```

Then ask your agent: *"Use `list_open_tasks` for `001-photo-albums` US1 and implement them. Before finishing, call `check_against_spec` with your diff and mark each verified task with `set_task_status`."*

To try it without Spec Kit, copy [`examples/starter/`](examples/starter/): it holds `specs/001-auth-login/` and a constitution.

## Recommended agent instructions

Add this to your project's `CLAUDE.md` (or your agent's instructions):

```markdown
## Spec Kit + Specwright
- Start a task with `pack_context` (with the feature id), or `get_artifact` for one section. Do not read whole spec files.
- Before saying a task is done, call `check_against_spec` with your diff and report any unmet requirement or out-of-scope change.
- After verifying a task, call `set_task_status`. Record non-obvious choices with `log_decision`.
- Save conventions and pitfalls with `save_memory`; check `search_memory` before changing an approach.
```

## Configuration

| Setting | Where | Default |
|---|---|---|
| Project root | `SPECWRIGHT_ROOT` environment variable, resolved against the server's working directory | the working directory |
| Maximum response size | `.specify/specwright.json` → `maxResponseChars` (integer ≥ 100) | `20000` |

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
        └── notes/               # <slug>.md, written by save_memory
```

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

The load scenarios also cover:
- 500 concurrent calls and 200 concurrent writes;
- two server processes on the same root;
- 1,000 task updates;
- 2,000 features with 5,000 notes.

See [docs/tdd/phase-4.md](docs/tdd/phase-4.md).

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
- `features/`, `constitution/`, `decisions/`, `memory/` and `context/`;
- each has its own types, repository, pure logic, and one file per tool;
- all sit on top of `storage/`, the only layer that touches the disk.

See [TRD §3](docs/02-trd.md#3-code-structure).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md): every change starts as a Spec Kit feature and is built test-first. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
