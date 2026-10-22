# Specwright Constitution

## Core Principles

### I. Specs Live in the Repository
Specs, plans, tasks, decisions and notes are plain Markdown in the project's Git repository, in Spec Kit's layout (`specs/NNN-name/`, `.specify/memory/`). They must stay readable and reviewable by humans and agents without any proprietary tool.

### II. No LLM in the Server
The server never calls a model and never needs an API key. It returns structured data; the agent that called it does the judging.

### III. Few, Well-Described Tools
At most 10 tools in total. Each description is at most 2 sentences and says when to use the tool, and the whole `tools/list` stays within 12,000 characters.

### IV. No Database, No Cache
State is re-read from the files on every call, so nothing can go stale. An index or cache is added only if a measured performance budget fails in real use.

### V. Test-First (NON-NEGOTIABLE)
Every requirement and acceptance scenario gets a test, named after its id, that is seen failing before the implementation. A feature is done only when typecheck, `npm test` and `npm run test:load` pass, locally and in CI.

### VI. Safe File Access
Only `specs/` and `.specify/` are read; only `tasks.md` checkboxes and `.specify/memory/**` are written. Writes are atomic and byte-minimal, new files never overwrite existing ones, and symlinks cannot escape.

## Additional Constraints

- Node.js 22.12 or later, TypeScript in strict mode, ESM.
- Runtime dependencies are limited to `@modelcontextprotocol/server`, `zod` and `yaml`; any other one needs a recorded decision.
- No network access, no `child_process`, and nothing written to stdout except JSON-RPC.
- All code, comments, docs, specs, commits and PR text are in English.

## Development Workflow

- One feature at a time: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → implement test-first → verify → close.
- Mark tasks with `set_task_status` and record non-obvious choices with `log_decision`.
- Branches `<type>/SW-<n>-<description>`, Conventional Commits with a `Refs: SW-<n>` trailer, and PR titles `[SW-<n>] <type>: <summary>`.

## Governance

This constitution supersedes other practices in this repository. An amendment needs a PR that explains the change and its impact. It also updates the version: MAJOR when a principle is removed or redefined, MINOR when one is added, PATCH for wording.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
