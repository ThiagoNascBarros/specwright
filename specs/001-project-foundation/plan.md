# Implementation Plan: Project foundation (repository, structure, build, CI)

**Branch**: `feature/SW-1-project-foundation` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `project-foundation`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

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

## Notes

- AC-1 was executed before this spec was approved, at the user's request. It is recorded as already met.
- AC-5 accepts both forms because the SDK v2 may omit the `tools` capability when no tool is registered. The plan fixes the actual behavior after verifying it.
