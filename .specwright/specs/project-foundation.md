---
id: project-foundation
title: Project foundation (repository, structure, build, CI)
status: in-progress
---

## Context
First spec of the [Roadmap](../../docs/03-roadmap.md). It creates the base on which the following specs are developed with TDD: the repository, the folder structure from TRD §3, the build, the CI and an MCP server that starts over stdio, still with no tools. Requirements met: NFR-9 (portability) and the base of NFR-10 (test suite and verification gate).

## Requirements
- Private repository `ThiagoNascBarros/specwright`, default branch `main`.
- Node.js ≥ 22.12 (`engines` in `package.json` and `.nvmrc` with `22`). TypeScript `strict`, ESM.
- Dependencies exactly those of TRD §2:
  - runtime: `@modelcontextprotocol/server`, `zod`, `yaml`;
  - development: `typescript`, `vitest`, `@types/node`, `@modelcontextprotocol/client`.
- `package.json`:
  - `name: specwright-mcp`, `private: true`, `bin: { "specwright-mcp": "dist/index.js" }`;
  - scripts `build` (`tsc`), `typecheck` (`tsc --noEmit && tsc -p tests`, covering src and tests) and `test` (build followed by `vitest run`).
- `src/index.ts` creates the server with `name: "specwright"` and `version` read from `package.json`, connects the stdio transport and registers no tools. It starts with the shebang `#!/usr/bin/env node`.
- Folder structure:

```
.github/workflows/ci.yml
.specwright/specs/            # this spec
.specwright/decisions/.gitkeep
docs/                         # PRD, TRD, Roadmap, ADRs
docs/superpowers/plans/.gitkeep
src/index.ts
src/storage/.gitkeep
src/specs/.gitkeep
src/memory/.gitkeep
src/context/.gitkeep
tests/contract/server.test.ts
tests/fixtures/.gitkeep
CLAUDE.md
README.md                     # empty
package.json  package-lock.json  tsconfig.json
.gitignore  .gitattributes  .nvmrc
```

- `.gitattributes`: `* text=auto eol=lf` and `tests/fixtures/** -text`. The second rule preserves CRLF and BOM in the fixtures (TRD §9).
- `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `*.tmp`.
- `CLAUDE.md` contains, in up to 40 lines:
  - where the PRD, TRD, Roadmap and ADRs are;
  - the per-spec cycle of the Roadmap;
  - mandatory TDD;
  - the commands `npm run typecheck`, `npm test` and `npm run build`;
  - the global constraints of TRD §2, by reference, without copying the text.
- CI (`ci.yml`): runs on `push` and `pull_request` to `main`, in a Node matrix of `22` and `24`, with the steps `npm ci`, `npm run typecheck` and `npm test`.

## Acceptance criteria
- [x] AC-1: The private repository `ThiagoNascBarros/specwright` exists on GitHub
- [x] AC-2: `npm ci && npm run build` finishes with exit code 0 and generates `dist/index.js` starting with `#!/usr/bin/env node`
- [x] AC-3: `npm run typecheck` finishes with exit code 0, with `strict: true` in `tsconfig.json`
- [x] AC-4: The contract test starts `node dist/index.js` over stdio with the SDK client and receives `serverInfo.name === "specwright"` and `serverInfo.version` equal to the `version` of `package.json`
- [x] AC-5: The contract test confirms that the server exposes zero tools: `listTools` returns an empty list, or the server does not announce the `tools` capability
- [x] AC-6: All folders and files listed under "Requirements" exist, and `package.json` declares exactly the dependencies of TRD §2
- [x] AC-7: `README.md` exists with 0 bytes
- [x] AC-8: The GitHub Actions CI runs green on Node 22 and 24 in this spec's PR
- [ ] AC-9: `main` receives this spec through a PR, with the merge done after the CI is green. Since the repository is empty, `main` is born from an initial commit that contains only the empty `README.md`, and the PR starts from it.

## Out of scope
- MCP tools, `config.ts`, `errors.ts`, `storage/*` (spec 2 `spec-reading`)
- README content
- License (PRD Q2) and npm publication
- Branch protection, Dependabot and linter
- `.mcp.json` for dogfooding (enters in spec 2, when there are tools)

## Notes
- AC-1 was executed before this spec was approved, at the user's request. It is recorded as already met.
- AC-5 accepts both forms because the SDK v2 may omit the `tools` capability when no tool is registered. The plan fixes the actual behavior after verifying it.
