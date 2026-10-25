# Specwright

MCP server (TypeScript, stdio) that keeps specs, decisions and project memory as the source of truth for AI agents. It has 18 tools; the roadmap phases and the second brain (`010-second-brain`) are done.

## Language
- All code, comments, docs, specs, ADRs, plans, commit messages and PR text are written in English.
- Conversation with the user may be in Portuguese.

## Documentation
- Product (what/why): `docs/01-prd.md`. Technical (how): `docs/02-trd.md`. The global constraints in **TRD §2** apply to all code.
- Spec order and work cycle: `docs/03-roadmap.md`. TDD records per phase: `docs/tdd/`.
- Constitution (Spec Kit): `.specify/memory/constitution.md`. Decisions: ADRs in `docs/adr/` (early ones) and `.specify/memory/decisions/` (written with `log_decision`).
- Features (Spec Kit layout): `specs/NNN-name/` with `spec.md`, `plan.md`, `tasks.md`… Project notes: `.specify/memory/notes/`.

## How to work
- **One spec at a time**, following the "Per-spec cycle" in the Roadmap. Specwright is built with itself, through `.mcp.json`:
  - start with `pack_context` (with the feature id) or `get_artifact` (with a section);
  - close with `check_against_spec`, `set_task_status` and `log_decision`.
- **TDD is mandatory:** every `FR-###` and acceptance scenario (`US<n>-AS<m>`) has a test that cites the id in its name and that was seen failing before the implementation.
- **One responsibility per file.**
  - Each module keeps its entities in `types.ts`, its disk access in `repository.ts`, its pure logic in separate files, and each tool in `tools/<tool-name>.ts`.
  - `storage/` is the only layer that touches the disk.
- Never write to stdout in the server. stdout carries JSON-RPC; diagnostics go to stderr.
- A spec is only ready when typecheck, `npm test` and `npm run test:load` are green, locally and in CI.
- Git: branch `<type>/SW-<n>-<description>`, Conventional Commits with a `Refs: SW-<n>` trailer, PR title `[SW-<n>] <type>: <summary>` (CONTRIBUTING.md). The repository owner is the only author: no co-author trailers.

## Commands
- `npm run typecheck`: `tsc --noEmit && tsc -p tests` (src and tests)
- `npm test`: build, then the unit, integration and stdio contract tests
- `npm run test:load`: performance and load suites, run serially
- `npm run build`: compiles to `dist/`

## Structure
- `src/index.ts`: entry point. `src/server.ts`: composition root that registers every module.
- `src/storage/`: paths, files, lock, concurrency, markdown, slug, text.
- `src/graph/`: the knowledge graph (build, query, lint, exports, tools). `src/cli/`: the `graph` subcommand.
- `src/features/`, `src/constitution/`, `src/decisions/`, `src/memory/`, `src/context/`: domain modules (TRD §3).
- `tests/unit`, `tests/integration` (in-process client), `tests/contract` (stdio), `tests/perf`, `tests/load`.
