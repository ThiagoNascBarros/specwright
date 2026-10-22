# Specwright

MCP server (TypeScript, stdio) that keeps specs, decisions and project memory as the source of truth for AI agents. It has 10 tools, and all three roadmap phases are done.

## Language
- All code, comments, docs, specs, ADRs, plans, commit messages and PR text are written in English.
- Conversation with the user may be in Portuguese.

## Documentation
- Product (what/why): `docs/01-prd.md`. Technical (how): `docs/02-trd.md`. The global constraints in **TRD §2** apply to all code.
- Spec order and work cycle: `docs/03-roadmap.md`. TDD records per phase: `docs/tdd/`.
- Decisions: ADRs in `docs/adr/` (early ones) and `.specwright/decisions/` (written with `log_decision`).
- Development specs: `.specwright/specs/`. Project memory: `.specwright/memory/`.

## How to work
- **One spec at a time**, following the "Per-spec cycle" in the Roadmap. Specwright is built with itself, through `.mcp.json`:
  - start with `pack_context` or `get_spec` (with a section);
  - close with `check_task_against_spec`, `set_criterion_status` and `log_decision`.
- **TDD is mandatory:** every `AC-n` has a test that cites the id in its name and that was seen failing before the implementation.
- **One responsibility per file.**
  - Each module keeps its entities in `types.ts`, its disk access in `repository.ts`, its pure logic in separate files, and each tool in `tools/<tool-name>.ts`.
  - `storage/` is the only layer that touches the disk.
- Never write to stdout in the server. stdout carries JSON-RPC; diagnostics go to stderr.
- A spec is only ready when typecheck, `npm test` and `npm run test:load` are green, locally and in CI.
- Commits: Conventional Commits, with the repository owner as the only author.

## Commands
- `npm run typecheck`: `tsc --noEmit && tsc -p tests` (src and tests)
- `npm test`: build, then the unit, integration and stdio contract tests
- `npm run test:load`: performance and load suites, run serially
- `npm run build`: compiles to `dist/`

## Structure
- `src/index.ts`: entry point. `src/server.ts`: composition root that registers every module.
- `src/storage/`: paths, files, lock, concurrency, markdown, slug, text.
- `src/specs/`, `src/decisions/`, `src/memory/`, `src/context/`: domain modules (TRD §3).
- `tests/unit`, `tests/integration` (in-process client), `tests/contract` (stdio), `tests/perf`, `tests/load`.
