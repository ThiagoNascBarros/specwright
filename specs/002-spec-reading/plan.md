# Implementation Plan: Read specs (list_specs, get_spec)

**Branch**: `feature/SW-2-spec-core` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `spec-reading`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

- `src/config.ts`: `loadConfig(env, cwd)`
  - resolves the root from `SPECWRIGHT_DIR`, default `.specwright`, with relative paths resolved against `cwd`;
  - reads the optional `config.json`, taking `maxResponseChars` with a default of `20000` and ignoring unknown fields.
- `src/errors.ts`: `SpecwrightError(code, message, hint?)` with the codes from TRD §8 used here: `NOT_INITIALIZED`, `SPEC_NOT_FOUND`, `SECTION_NOT_FOUND`, `PATH_OUTSIDE_ROOT`, `INTERNAL`. A helper turns an error into an MCP tool result with `isError: true` and the JSON `{ code, message, hint }`.
- `src/storage/paths.ts`: `resolveInside(root, relative)` (TRD §5.1)
  - resolves the path with `realpath`, falling back to the parent directory for files that do not exist yet;
  - rejects anything outside the root with `PATH_OUTSIDE_ROOT`.
- `src/storage/markdown.ts`: `parseDocument(text)` returns `{ frontmatter, sections }`.
  - The frontmatter is the leading `---` block, read with `yaml.parse`.
  - Sections follow the rules in TRD §6.1: each `##` heading opens a section that runs to the next `##`, and the key is normalized. A UTF-8 BOM is stripped before parsing.
- `src/specs/`: spec parser
  - validation, giving `valid` and `issues`;
  - criteria extraction, giving `{done, total}`;
  - the fixed aliases (`acceptance-criteria` = `criterios-de-aceite`, `out-of-scope` = `fora-de-escopo`).
- `src/specs/` also holds the `register(server, deps)` function, which registers both tools; `src/index.ts` calls it.
- Tools (contract in TRD §7):
  - `list_specs({ status? })` → `[{ id, title, status, valid, issues?, criteria: {done, total} }]`, sorted by `id`, with no body. It reads every `specs/*.md` on each call.
  - `get_spec({ spec_id, section? })` → `{ id, title, status, section?, content, truncated? }`. It reads only `specs/<spec_id>.md`. Without `section`, `content` is the whole body without the frontmatter.
  - `spec_id` must match `^[a-z0-9][a-z0-9-]*$` in the zod schema.
  - Responses longer than `maxResponseChars` are cut and flagged `truncated: true`.
  - Each tool description has at most 2 sentences and says when to use it.
- `.mcp.json` at the repo root runs `node dist/index.js` with `SPECWRIGHT_DIR=.specwright`, so the project can use itself (smoke dogfooding).
- Fixtures under `tests/fixtures/spec-reading/`; integration tests copy them into a `tmpdir` (TRD §10).

## Notes

- AC-13 updates the foundation contract test: from now on `tools/list` is no longer empty, so the `project-foundation` AC-5 test is replaced by AC-13. This is expected, not a regression.
- AC-14 measures time in-process inside Vitest, with a 2x margin allowed on CI (`CI=true`) to avoid flakiness on shared runners.
