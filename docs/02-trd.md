---
id: TRD-001
title: Specwright — Technical Requirements Document
status: draft
version: 0.2
implements: PRD-001
---

# TRD-001 — Specwright

Explains **how** the [PRD-001](01-prd.md) will be built. The decisions, with the alternatives considered, are in the ADRs in [`adr/`](adr/). The development specs and implementation plans follow the [Roadmap](03-roadmap.md).

## 1. Technical vision

MCP server in TypeScript, **stdio** transport, on top of the official SDK v2 (`@modelcontextprotocol/server`) ([ADR-0002](adr/0002-typescript.md)). It uses no LLM ([ADR-0003](adr/0003-no-llm-in-server.md)) and no database ([ADR-0004](adr/0004-markdown-storage.md)). All state is Markdown in `.specwright/`, inside the target project's repository, **re-read on every call**: there is no persistent index and no cache.

```
MCP client (agent)
        │ stdio / JSON-RPC
        ▼
   src/index.ts ── registers the tools of each module
        │
   ┌────┼──────────────┐
 specs/ memory/       context/     (independent modules)
   └────┼──────────────┘
        ▼
    storage/  ── the only layer that touches the disk
        ▼
 .specwright/{config.json, specs/, decisions/, memory/}
```

## 2. Global constraints

Every implementation plan copies this list verbatim into its *Global Constraints* section.

- Node.js **≥ 22.12** (the Node 20 left LTS on 2026-04; 22.12 is the floor required by Vitest 5); TypeScript in `strict` mode; ESM (`"type": "module"`).
- Allowed runtime dependencies: `@modelcontextprotocol/server` (v2), `zod` (v4), `yaml` (v2). Any other requires an ADR.
- Development dependencies: `typescript`, `vitest`, `@types/node` and `@modelcontextprotocol/client` (v2, used in the contract test). No linter in Phase 1: `tsc --noEmit && tsc -p tests` (src and tests) is the type gate.
- Forbidden in the server: network, `child_process`, LLM calls, writes outside `SPECWRIGHT_DIR`.
- Tool names in `snake_case` and in English. Error messages in English, with a stable `code`.
- Every tool returns compact JSON in a single text block.
- In total, up to 10 tools (PRD NFR-2).

## 3. Code structure

```
src/
├── index.ts          # creates the server, loads the config, registers the tools
├── config.ts         # resolves SPECWRIGHT_DIR and config.json
├── errors.ts         # SpecwrightError + codes
├── storage/
│   ├── paths.ts      # path guard
│   ├── files.ts      # reading, atomic write, exclusive creation
│   └── markdown.ts   # frontmatter + splitting into sections
├── specs/            # spec parser, spec tools, diff parser
├── memory/           # Phase 2
└── context/          # Phase 3
tests/                # mirrors src/; fixtures in tests/fixtures/
```

Dependency rules:
- `specs`, `memory` and `context` depend only on `storage` and `errors`, and do not depend on each other.
- The exception is `context`, which consumes the public functions of `specs` and `memory`.
- `index.ts` is the only file that knows all the modules.
- Each module exports a function `register(server, deps)` that registers its own tools.

## 4. Data flow

**Read** (e.g., `get_spec`)
1. The SDK validates the input with the tool's zod schema.
2. The tool resolves `specs/<spec_id>.md` via `storage/paths`. Since the id equals the file name, there is no search.
3. `storage/markdown` separates the frontmatter from the sections, and the tool cuts out the requested section.
4. If the response exceeds `maxResponseChars`, it is truncated with `truncated: true`.

**Write** (e.g., `set_criterion_status`)
1. Reads the raw file (bytes).
2. Finds the line of the `AC-n` and changes only the checkbox character.
3. Writes to a temporary file in the same folder and does a `rename` (atomic operation).
4. Returns the new state, recalculated from the written text.

Reading, editing and writing happen within the same call. For that reason there is no in-memory state that can become stale between calls.

## 5. Storage

Root: `SPECWRIGHT_DIR`.
- A relative path is resolved against the server's `process.cwd()`. The default is `.specwright`.
- The README instructs to use an absolute path when the client does not start the server at the project root.

```
.specwright/
├── config.json       # optional
├── specs/            # <spec-id>.md
├── decisions/        # NNNN-<slug>.md (created on demand by log_decision)
└── memory/           # <slug>.md (Phase 2)
```

`config.json` is optional, and all fields have defaults:

```json
{ "maxResponseChars": 20000 }
```

Unknown fields are ignored. Versioning of `config.json` is deferred (PRD Q3): the absence of a version means v1.

### 5.1 Guarantees of `storage/`
- **Path guard (NFR-6).** Every path is resolved with `realpath` and must be inside the root. For a new file, `realpath` is applied to the parent directory. Otherwise the error is `PATH_OUTSIDE_ROOT`. This covers `..`, absolute paths and symlinks.
- **Atomic write (NFR-5).** Writes to a temporary file `.<name>.<pid>.tmp` in the same folder and does a `rename`.
- **Minimal edit (NFR-5).** Only the target line changes. The rest of the file is preserved byte for byte, including line endings (LF/CRLF) and BOM.
- **Exclusive creation.** New files (decisions, memories) use the `wx` flag. On a name collision, the next number is tried, up to 5 times, and then the error is `INTERNAL`.
- **No conflict detection between processes.** The premise is one server per project, and the race window stays within a single call. Concurrent edits by the user show up in the Git diff (PRD N5).

## 6. Formats

### 6.1 Spec (`specs/<id>.md`)

```markdown
---
id: auth-login            # required; ^[a-z0-9][a-z0-9-]*$; same as the file name
title: Login with e-mail  # required
status: in-progress       # draft | in-progress | done | deprecated
---

## Context
...
## Acceptance criteria
- [x] AC-1: ...
- [ ] AC-2: ...
## Out of scope
- ...
```

Parsing rules:
- **Frontmatter.** It is the block between the `---` lines at the start of the file, read with `yaml.parse`. The server **never re-serializes** the frontmatter of an existing spec.
- **Sections.**
  - A section goes from a `##` heading to the next `##`, and the inner `###` headings are part of it.
  - Text before the first `##` does not belong to any section.
  - The section key is the heading text in lowercase, without accents, with spaces replaced by `-`.
  - `get_spec(section)` accepts the key or the original text.
- **Fixed aliases.** The Portuguese headings from the original specs are accepted as aliases of the English keys:
  - `acceptance-criteria` (primary) — alias `criterios-de-aceite`.
  - `out-of-scope` (primary) — alias `fora-de-escopo`.
- **Criteria.**
  - They are the lines of the criteria section in the format `^\s*[-*] \[( |x|X)\] (AC-\d+):\s*(.+)$`.
  - The ids are unique per spec and stable. The server never renumbers them.
  - Checkbox lines without `AC-n` are ignored and generate an issue.
- **Out of scope.** These are the list items of the corresponding section.
- **Invalid spec.** An invalid spec does not break the others: it appears in `list_specs` with `valid: false` and `issues: string[]`. It is invalid when:
  - the frontmatter, `id` or `title` is missing;
  - the `id` differs from the file name;
  - the `status` is outside the enum;
  - there is a duplicate `AC`;
  - there is a duplicate `##` heading.

  Writing to an invalid spec is refused with `INVALID_SPEC`.

### 6.2 Decision (`decisions/NNNN-<slug>.md`)

File created by `log_decision`, with frontmatter generated by `yaml.stringify` (escaped values):

```markdown
---
id: "0007"              # string, so YAML does not read it as a number
spec_id: auth-login
title: Lock by account, not by IP
date: 2026-10-21        # local creation date
status: accepted        # accepted | superseded (superseded is edited by humans)
---
## Context
## Decision
## Consequences
```

- `NNNN` is the highest existing number + 1, with 4 digits.
- The `slug` comes from the title: without accents, lowercase, `[a-z0-9-]`, at most 50 characters.
- Empty sections (`context` or `consequences` missing) are omitted.

## 7. Tool contract

Conventions:
- Input is validated with zod.
- Listings never include the body.
- Errors come out as `isError: true` with `{ code, message, hint }`.
- Each tool's description has at most 2 sentences and says **when** to use it.

### Phase 1

| Tool | Input | Output |
|---|---|---|
| `list_specs` | `status?` | `[{ id, title, status, valid, issues?, criteria: {done, total} }]` |
| `get_spec` | `spec_id`, `section?` | `{ id, title, status, section?, content, truncated? }` |
| `list_open_requirements` | `spec_id?` | `[{ spec_id, ac_id, text }]` (invalid specs are left out) |
| `set_criterion_status` | `spec_id`, `ac_id`, `done: boolean` | `{ spec_id, ac_id, done, changed, criteria: {done, total} }` |
| `log_decision` | `spec_id`, `title`, `decision`, `context?`, `consequences?` | `{ id, path }` |
| `check_task_against_spec` | `spec_id`, `diff` | `{ spec_id, open_criteria, met_criteria, out_of_scope, diff_summary }` |

- **`get_spec` without `section`** returns the whole body, without the frontmatter.
- **`set_criterion_status`** is idempotent: if the requested state is already the current one, it returns `changed: false` and does not write.
- **`log_decision`** validates that the spec exists (`SPEC_NOT_FOUND`) and creates `decisions/` if the folder is missing.
- **`check_task_against_spec`** judges nothing.
  - It parses the unified diff as text, without depending on `git`, and returns `diff_summary = { files: [{ path, added, removed, hunks }], totals: { files, added, removed } }`.
  - It also returns the open and met criteria and the items of "Out of scope".
  - An empty diff, or one without any recognizable `diff --git`/`---`/`+++` header, produces `INVALID_DIFF`.

### Phase 2 (detailed in its own spec)
- `save_memory(type, title, body, tags?)` writes `memory/<slug>.md`. `type` ∈ `convention | learning | pitfall`.
- `search_memory(query, type?, limit?)` performs text search over memories and decisions. The ranking weighs title > tags > body, and the tool returns excerpts.
- `list_decisions(spec_id?, from?, to?)`.

### Phase 3 (detailed in its own spec)
- `pack_context(task, budget_tokens?)` selects spec sections and memories by term matching. It lists candidate files by name and path and cuts everything to the budget.
- The token estimate is `ceil(chars / 4)`, until PRD Q1 is decided.

## 8. Errors

| Code | When |
|---|---|
| `NOT_INITIALIZED` | the root `SPECWRIGHT_DIR` does not exist (hint: create `.specwright/specs/`) |
| `SPEC_NOT_FOUND` | `spec_id` does not exist |
| `SECTION_NOT_FOUND` | the section does not exist (hint: lists the available keys) |
| `CRITERION_NOT_FOUND` | the `ac_id` does not exist in the spec |
| `INVALID_SPEC` | write to an invalid spec (hint: lists the `issues`) |
| `INVALID_DIFF` | empty diff or outside the unified format |
| `PATH_OUTSIDE_ROOT` | the path resolves outside the root |
| `INTERNAL` | unexpected I/O error; the message does not expose an absolute path |

Input that violates the zod schema is rejected by the SDK itself, before reaching the tool.

## 9. Edge cases

This section is the source of the *Review Focus* of each plan. The plan chooses the cases that touch its spec and adds a test for each one.

- Files with CRLF, with UTF-8 BOM, empty, or with only frontmatter.
- Headings with accents, emoji or double spaces; requested section with an accent (`critérios de aceite`, the Portuguese alias, checked for accent stripping).
- `spec_id` with `../`, uppercase letters, a slash or an absolute path.
- Symlink inside `specs/` pointing outside the root.
- Spec without the criteria section (`criteria: {done: 0, total: 0}`, no error).
- `AC-10` and `AC-1` in the same spec (the match must be exact, not by prefix).
- Diff with a renamed file, binary file, new or deleted file (`/dev/null`), and multiple hunks.
- Huge diff: the `diff_summary` stays small, because it never includes the content of the lines.
- Windows path (`\`) in the path guard.

## 10. Testing strategy

Development follows **TDD**: each `AC-n` of a spec gets a test, written before the code, that must fail for the expected reason before the implementation. The test name cites the id (`AC-3: ...`).

- **Unit:** path guard, atomic write, frontmatter and sections, criteria extraction, diff parser.
- **Integration:** each tool runs against a copy of `tests/fixtures/<scenario>/` in a `tmpdir`. The tests do not read the repository's real `.specwright/`, because it changes as the criteria are checked off.
- **MCP contract:** a test starts `dist/index.js` over stdio with the SDK client and calls each registered tool.
- **Measurable NFRs in tests:**
  - NFR-3: the `tools/list` JSON has at most 12,000 characters.
  - NFR-7: a fixture generated with 500 specs is read within the target time.
- **Dogfooding:** a manual smoke test, at the end of each spec, with Specwright itself pointing at the repository. It does not replace the suite.
- **Completion gate:** `npm test` (the whole suite) and `tsc --noEmit` green, with the output attached to the spec's report.

## 11. Build and distribution

- `tsc` generates `dist/`. The entry point is `dist/index.js`, and the `bin` field allows use via `npx`.
- The npm package will be provisionally named `specwright-mcp`. The name was free on 2026-10-21; re-check before publishing.
- Intended use: `claude mcp add specwright -- npx -y specwright-mcp`, with `SPECWRIGHT_DIR` optional.

## 12. Security

- The server does not use the network, does not run commands and does not read outside the root (§2, §5.1).
- The content of specs and memories is data, and the server never interprets it as an instruction.
- The `spec_id` is restricted by regex in the schema, before any disk access.

## 13. Traceability

| Requirement | Component | Spec (Roadmap) |
|---|---|---|
| NFR-9, NFR-10 (base) | `package.json`, `src/index.ts`, CI | 1 `project-foundation` |
| FR-1, FR-2, FR-3, NFR-4, NFR-6, NFR-8 | `storage/paths`, `storage/markdown`, `specs/` | 2 `spec-reading` |
| FR-4, FR-6, NFR-5 | `storage/files`, `specs/` | 3 `acceptance-criteria` |
| FR-7 | `specs/` | 4 `decision-log` |
| FR-5 | `specs/diff` | 5 `check-task` |
| NFR-3, NFR-7 | cross-cutting tests | 2 (base) and reviewed in 5 |
| FR-8 to FR-10 | `memory/` | Phase 2 |
| FR-11 | `context/` | Phase 3 |

## 14. Open questions

- **Q1 (decide in spec 5).** How does the diff reach `check_task_against_spec`?
  - Today the agent passes the diff as an argument, which costs the diff's tokens in the call (tension with goal G3).
  - The alternative is to accept `base_ref` and have the server read the diff from Git. That requires `child_process` (forbidden in §2) or a Git library (a new dependency).
  - Provisional recommendation: keep the argument and measure the cost during dogfooding.
