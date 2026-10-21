---
id: spec-reading
title: Read specs (list_specs, get_spec)
status: done
---

## Context
Spec 2 of the [Roadmap](../../docs/03-roadmap.md). This is the first vertical slice: once it is done, an agent connected to Specwright can list the project's specs and read a whole spec or a single section, without loading every file. Requirements covered: FR-1, FR-2, FR-3, NFR-3, NFR-4, NFR-6, NFR-7, NFR-8 (PRD-001). Technical reference: TRD-001 §3–§10.

## Requirements
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

## Acceptance criteria
- [x] AC-1: `loadConfig` resolves a relative `SPECWRIGHT_DIR` against `cwd`, uses `.specwright` when unset, and returns `maxResponseChars: 20000` when `config.json` is missing or has no such field
- [x] AC-2: Every tool call returns `NOT_INITIALIZED`, with a hint naming `.specwright/specs/`, when the root does not exist
- [x] AC-3: `resolveInside` rejects `../x`, absolute paths and a symlink inside the root that points outside it, each with `PATH_OUTSIDE_ROOT`
- [x] AC-4: `parseDocument` handles LF, CRLF and a UTF-8 BOM and gives the same sections for all three. Text before the first `##` belongs to no section, and `###` stays inside its parent section.
- [x] AC-5: A spec with missing frontmatter, `id` different from the file name, `status` outside the enum, a duplicated `AC-n` or a duplicated `##` heading is reported by `list_specs` with `valid: false` and one issue per problem, and the other specs are still listed
- [x] AC-6: `list_specs` returns every spec sorted by `id` with `criteria: {done, total}`. `AC-1` and `AC-10` count as distinct criteria, and a spec with no criteria section gives `{0, 0}`.
- [x] AC-7: `list_specs({ status: "done" })` returns only specs with that status
- [x] AC-8: `get_spec` without `section` returns the body without the frontmatter
- [x] AC-9: `get_spec` with `section` accepts the normalized key (`acceptance-criteria`), the original heading text (`Acceptance criteria`) and a fixed alias (`critérios de aceite`), and returns only that section
- [x] AC-10: `get_spec` returns `SPEC_NOT_FOUND` for an unknown id, and `SECTION_NOT_FOUND` with a hint listing the available keys for an unknown section
- [x] AC-11: `get_spec` rejects `spec_id` values `../etc`, `Foo`, `a/b` and `/abs` before touching the disk
- [x] AC-12: A response longer than `maxResponseChars` is cut to that length and carries `truncated: true`
- [x] AC-13: Over stdio, `tools/list` returns exactly `list_specs` and `get_spec`, and the serialized JSON is at most 12,000 characters (NFR-3)
- [x] AC-14: With a generated fixture of 500 specs, `list_specs` answers in under 500 ms and `get_spec` in under 200 ms (NFR-7)
- [x] AC-15: Smoke dogfooding: with `.mcp.json`, an agent session lists this repo's specs and reads one section of `spec-reading`

## Out of scope
- Writing to specs (`set_criterion_status`, spec 3) and `storage/files`
- `list_open_requirements` (spec 3) and `log_decision` (spec 4)
- Caching or indexing (ADR-0004)
- Any other `config.json` fields

## Notes
- AC-13 updates the foundation contract test: from now on `tools/list` is no longer empty, so the `project-foundation` AC-5 test is replaced by AC-13. This is expected, not a regression.
- AC-14 measures time in-process inside Vitest, with a 2x margin allowed on CI (`CI=true`) to avoid flakiness on shared runners.
