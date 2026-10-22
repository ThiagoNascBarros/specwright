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

## Branches, commits and pull requests

Every piece of work has a **task code** `SW-<n>`: one code per pull request, taken in sequence. The code appears in the branch, the commits and the PR title.

**Branches:** `<type>/SW-<n>-<short-kebab-description>`

| Type | Use |
|---|---|
| `feature/` | new behavior (`feature/SW-7-config-versioning`) |
| `fix/` | bug fixes (`fix/SW-8-crlf-in-diff-parser`) |
| `docs/` | documentation only (`docs/SW-6-git-conventions`) |
| `chore/`, `ci/`, `refactor/`, `test/` | maintenance, pipelines, internal changes, tests only |

**Commits:** [Conventional Commits](https://www.conventionalcommits.org/), with the task code as a trailer:

```
feat(memory): rank title matches above tag matches

Optional body explaining why, wrapped at 72 columns.

Refs: SW-3
```

- Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
- Scope: the module (`specs`, `decisions`, `memory`, `context`, `storage`, `server`), or none.
- Subject: imperative, lowercase, no period, at most 72 characters.
- Breaking changes: `feat(specs)!: …`, plus a `BREAKING CHANGE:` footer.
- The repository owner is the only author; do not add co-author trailers.

**Pull requests:**
- The title is `[SW-<n>] <type>: <summary>`, for example `[SW-3] feat: phase 2, project memory`.
- One task per PR. Fill in the PR template.
- Merge with a merge commit, so the branch history stays visible.
- CI must be green: typecheck, tests and the load suite, on Node 22 and 24.
- Add your change to `CHANGELOG.md` under **Unreleased**.

| Code | Branch | Delivered |
|---|---|---|
| SW-1 | `feature/SW-1-project-foundation` | Repository, build, CI, stdio server |
| SW-2 | `feature/SW-2-spec-core` | Phase 1: specs and decisions tools |
| SW-3 | `feature/SW-3-project-memory` | Phase 2: memory tools |
| SW-4 | `feature/SW-4-context-packer` | Phase 3: `pack_context`, load suite |
| SW-5 | `docs/SW-5-open-source-docs` | Open-source documentation, v0.1.0 |
| SW-6 | `docs/SW-6-git-conventions` | These conventions |
| SW-7 | `chore/SW-7-dependabot-node-types` | Keep `@types/node` on the Node floor |

## Code of Conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
