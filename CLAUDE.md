# Specwright

MCP server (TypeScript, stdio) that keeps specs, decisions and project memory as the source of truth for AI agents.

## Language
- All code, comments, docs, specs, ADRs, plans, commit messages and PR text are written in English.
- Conversation with the user may be in Portuguese.

## Documentation
- Product (what/why): `docs/01-prd.md`
- Technical (how): `docs/02-trd.md`. The global constraints are in **TRD §2** and apply to all code.
- Spec order and work cycle: `docs/03-roadmap.md`
- Architecture decisions: `docs/adr/`
- Development specs: `.specwright/specs/`
- Implementation plans: `docs/superpowers/plans/`

## How to work
- **One spec at a time**, following the "Per-spec cycle" table in the Roadmap: spec → plan → TDD → verification → closing. Each step starts only after human approval of the previous one.
- **TDD is mandatory:** every `AC-n` has a test that cites the id in its name and that was seen failing before the implementation.
- Never write to stdout in the server. stdout carries JSON-RPC; diagnostics go to stderr.
- A spec is only ready when the whole suite is green and CI is green.

## Commands
- `npm run typecheck`: `tsc --noEmit && tsc -p tests` (src and tests)
- `npm test`: build, then the whole Vitest suite
- `npm run build`: compiles to `dist/`

## Structure
- `src/index.ts`: creates the server and registers the tools of the modules
- `src/storage/`: the only layer that touches the disk
- `src/specs/`, `src/memory/`, `src/context/`: independent modules (TRD §3)
- `tests/contract/`: tests over stdio
- `tests/fixtures/`: fixtures; Git preserves the bytes (CRLF/BOM)
