# Contributing to Specwright

Thanks for your interest! Specwright is built with its own method: a spec first, tests first, then code. This guide explains how to work that way.

## Before you start

- **Bugs:** open an issue with the bug template, including a minimal `.specwright/` that reproduces it.
- **Features:** open an issue first. Specwright keeps a hard limit of 10 tools (PRD NFR-2), so a new tool usually means replacing or merging an existing one. Discuss that before writing code.
- **Docs and typos:** a PR is enough.

## Development setup

Requires Node.js 22.12 or later.

```bash
git clone https://github.com/ThiagoNascBarros/specwright.git
cd specwright
npm ci
npm test
```

| Command | What it does |
|---|---|
| `npm run build` | compiles `src/` to `dist/` |
| `npm run typecheck` | type-checks `src/` and `tests/` |
| `npm test` | builds, then runs the unit, integration and stdio contract tests |
| `npm run test:load` | runs the performance and load suites serially |

The repository has a `.mcp.json`, so an MCP client opened at the repo root can use Specwright on its own specs.

## How a change is made

1. **Spec.** Add or update a spec in `.specwright/specs/<id>.md`, with numbered acceptance criteria (`AC-n`). Format: [TRD §6.1](docs/02-trd.md#61-spec-specsidmd).
2. **Test first.** For each criterion, write a test whose name starts with its id, such as `it('AC-3: …')`, and watch it fail for the expected reason.
3. **Implement** the minimum code that makes it pass.
4. **Verify.** `npm run typecheck`, `npm test` and `npm run test:load` must all pass.
5. **Close.** Check the criteria with `set_criterion_status`, record non-obvious choices with `log_decision`, and set the spec's `status: done`.

## Code guidelines

- **One responsibility per file.**
  - Each module (`specs/`, `decisions/`, `memory/`, `context/`) keeps its entities in `types.ts`, its disk access in `repository.ts`, its pure logic in its own files, and each tool in `tools/<tool-name>.ts`.
  - `storage/` is the only layer that touches the disk, and it knows no domain.
- **Respect the global constraints** in [TRD §2](docs/02-trd.md#2-global-constraints).
  - The server uses no network, no `child_process` and no LLM, and writes nothing outside `SPECWRIGHT_DIR`.
  - A new runtime dependency needs an ADR.
- **Never write to stdout in the server.** It carries JSON-RPC. Use `console.error` for diagnostics.
- **Errors** are `SpecwrightError` values with a stable `code` and a `hint`, and they never carry absolute paths.
- **Tool descriptions** are at most 2 sentences and say *when* to use the tool. The contract test enforces this and the 12,000-character `tools/list` budget.
- **Language.** All code, comments, docs, specs, commits and PR text are in English.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(memory): …`, `fix(specs): …`, `docs: …`, `test: …`, `ci: …`.
- One spec (or one fix) per PR. Fill in the PR template.
- CI must be green: typecheck, tests and the load suite, on Node 22 and 24.
- Add your change to `CHANGELOG.md` under **Unreleased**.

## Code of Conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
