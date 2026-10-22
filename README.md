<div align="center">

# Specwright

**Keep your specs, decisions and project memory as the source of truth for AI coding agents.**

An [MCP](https://modelcontextprotocol.io) server that lets an agent read only the part of a spec it needs, check its work against the acceptance criteria, record decisions, remember what earlier sessions learned, and assemble the minimal context for a task. Everything is plain Markdown in your repository.

[![CI](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml/badge.svg)](https://github.com/ThiagoNascBarros/specwright/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022.12-339933)
![MCP tools](https://img.shields.io/badge/MCP%20tools-10-7c3aed)

</div>

---

## Why

Three problems keep coming back in agentic development:

1. **Spec drift.** As the session goes on, the agent drifts away from what was specified, and nobody notices until code review.
2. **Amnesia between sessions.** Decisions, conventions and pitfalls are lost when the context window ends.
3. **Bloated context.** To be safe, the agent reads whole documents and spends tokens on noise.

Specwright closes this loop:

```
spec → code → validation → decision recorded → spec and memory updated
```

## Principles

- **Specs live in the repo.** They are Markdown with frontmatter, versioned in Git, and readable by humans and agents.
- **No LLM inside the server.** It needs no API key and makes no model calls. It returns structured data, and the agent that called it does the judging.
- **Few, well-described tools.** There are 10 tools, and the whole `tools/list` stays under 12,000 characters.
- **No database.** Files are re-read on every call, so nothing goes stale.
- **Safe by default.** It has no network access and runs no commands. Nothing is read or written outside `.specwright/`, writes are atomic and byte-minimal, and nothing is ever overwritten.

## Tools

| Tool | Use it to… |
|---|---|
| `list_specs` | find which spec covers your task (id, title, status, criteria progress) |
| `get_spec` | read a whole spec, or only one section such as `acceptance-criteria` |
| `list_open_requirements` | see which acceptance criteria are still unmet, in one spec or in all of them |
| `check_task_against_spec` | send your diff before saying "done", and get the open and met criteria, the out-of-scope items and a per-file summary |
| `set_criterion_status` | check or uncheck one `AC-n`; only that checkbox character changes |
| `log_decision` | record a decision linked to a spec, as `decisions/NNNN-slug.md` |
| `list_decisions` | list decisions by spec or by date range |
| `save_memory` | save a convention, learning or pitfall for future sessions |
| `search_memory` | search memories and decisions by topic, ignoring case and accents |
| `pack_context` | get the most relevant sections, memories, decisions and cited files for a task, within a token budget |

The full input and output contracts are in [TRD §7](docs/02-trd.md#7-tool-contract).

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

**Claude Code**, from the root of the project you want to use it in:

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
      "env": { "SPECWRIGHT_DIR": ".specwright" }
    }
  }
}
```

Any MCP client that supports stdio servers works the same way.

### 3. Write your first spec

```bash
mkdir -p .specwright/specs
cp /absolute/path/to/specwright/examples/starter/.specwright/specs/auth-login.md .specwright/specs/
```

Then ask your agent: *"Use `list_specs`, then implement the open criteria of `auth-login`."*

## Spec format

```markdown
---
id: auth-login            # same as the file name; lowercase, digits and dashes
title: Login with e-mail and password
status: in-progress       # draft | in-progress | done | deprecated
---

## Context
Users need to authenticate to reach the logged-in area. Code lives in `src/auth/login.ts`.

## Acceptance criteria
- [x] AC-1: Valid e-mail and password return a session
- [ ] AC-2: After 5 failed attempts the account is locked for 15 minutes
- [ ] AC-3: Login errors never reveal whether the e-mail exists

## Out of scope
- Social login
- Password recovery
```

Rules to know:
- **Sections** are delimited by `##` headings, and their keys are normalized: `Acceptance criteria` → `acceptance-criteria`.
- **Criteria ids** must be stable: `AC-1` and `AC-10` are different criteria, and Specwright never renumbers them.
- **Invalid specs** are still listed, with the reasons in `issues`, and writes to them are refused.
- **File paths** in backticks are picked up by `pack_context` as candidate files.

## Recommended agent instructions

Add something like this to your project's `CLAUDE.md` (or your agent's instructions):

```markdown
## Specs (Specwright MCP)
- Start a task with `pack_context` (or `list_specs` + `get_spec` with a section). Do not read whole spec files.
- Before saying a task is done, call `check_task_against_spec` with your diff and report any open criterion or out-of-scope change.
- After verifying a criterion, call `set_criterion_status`. Record non-obvious choices with `log_decision`.
- Save conventions and pitfalls you discover with `save_memory`; check `search_memory` before changing an approach.
```

## Configuration

| Setting | Where | Default |
|---|---|---|
| Root folder | `SPECWRIGHT_DIR` environment variable, resolved against the server's working directory | `.specwright` |
| Maximum response size | `.specwright/config.json` → `maxResponseChars` (integer ≥ 100) | `20000` |

Use an absolute `SPECWRIGHT_DIR` if your client does not start servers from the project root.

```
.specwright/
├── config.json      # optional
├── specs/           # <spec-id>.md
├── decisions/       # NNNN-<slug>.md, written by log_decision
└── memory/          # <slug>.md, written by save_memory
```

## Performance

Medians measured with the test suite (laptop / GitHub Actions):

| Scenario | Budget | Result |
|---|---|---|
| `list_specs`, 500 specs | < 500 ms | ~60–95 ms |
| `get_spec` with section | < 200 ms | < 1 ms |
| `search_memory`, 1,000 memories + 200 decisions | < 300 ms | ~140–200 ms |
| `pack_context`, 500 specs + 1,000 memories | < 1 s | ~185–240 ms |
| 2,000 sequential calls over stdio | p95 < 50 ms | p95 ~25–37 ms |

Load scenarios also cover 500 concurrent calls, 200 concurrent writes, two server processes on the same root, and 2,000 specs with 5,000 memories. Details are in [docs/tdd/phase-3.md](docs/tdd/phase-3.md).

## Documentation

| Document | Content |
|---|---|
| [PRD](docs/01-prd.md) | Problem, goals, requirements (FR/NFR), success metrics |
| [TRD](docs/02-trd.md) | Architecture, storage guarantees, formats, tool contracts, errors |
| [Roadmap](docs/03-roadmap.md) | Phases, specs and their status |
| [ADRs](docs/adr/) and [decisions](.specwright/decisions/) | Why things are the way they are |
| [TDD records](docs/tdd/) | RED → GREEN evidence, AC → test map, and load results per phase |
| [Specs](.specwright/specs/) | Specwright's own development specs (it is built with itself) |

## Development

```bash
npm run build       # compile to dist/
npm run typecheck   # tsc for src and tests
npm test            # unit, integration and stdio contract tests
npm run test:load   # performance and load suites (serial)
```

The code is organized as one module per entity: `specs/`, `decisions/`, `memory/` and `context/`. Each module has its own types, repository, pure logic, and one file per tool. All of them sit on top of `storage/`, the only layer that touches the disk. See [TRD §3](docs/02-trd.md#3-code-structure).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first: every change starts with a spec and follows test-driven development. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
