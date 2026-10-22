# Implementation Plan: Spec Kit format

**Branch**: `feature/SW-8-speckit-format` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-speckit-format/spec.md`

## Summary

Specwright now reads and tracks GitHub Spec Kit projects instead of its own `.specwright/` format:
- features are `specs/NNN-name/` folders;
- progress is the `T###` tasks of `tasks.md`, marked `[X]` exactly as `/speckit-implement` does;
- checklists are read-only;
- project memory (decisions and notes) lives in `.specify/memory/` next to the constitution.

The specs-related tools are renamed to Spec Kit's vocabulary (`list_features`, `get_artifact`, `list_open_tasks`, `set_task_status`, `check_against_spec`), and the total stays at 10 tools.

The technical approach (see [research.md](research.md)):
- a project-root config with an allowlist path guard (`specs/`, `.specify/`);
- line-level parsers for Spec Kit's `spec.md` and `tasks.md` template shapes, which strip HTML comments and code fences first;
- a one-character task editor built on the existing atomic write;
- memory and context modules repointed to `.specify/memory/` and to Spec Kit artifacts.

The repository itself is migrated to the layout and gets a `constitution.md`.

## Technical Context

**Language/Version**: TypeScript (strict, ESM) on Node.js ≥ 22.12

**Primary Dependencies**: `@modelcontextprotocol/server` v2, `zod` v4, `yaml` v2. No new runtime dependency.

**Storage**: Markdown files in the target repository: `specs/**`, `.specify/memory/**`, and `.specify/specwright.json` for the optional config.

**Testing**: Vitest. Unit tests and in-process integration tests (`InMemoryTransport`) run in `npm test`, together with the stdio contract and workflow tests; the perf and load suites run in `npm run test:load`.

**Target Platform**: a local MCP stdio server on Linux, macOS and Windows

**Project Type**: CLI-launched MCP server (single project)

**Performance Goals**: SC-003. With 500 features, `list_features` and `list_open_tasks` take under 500 ms, and `get_artifact` with a section under 200 ms.

**Constraints**:
- no network, no `child_process`, no LLM;
- reads only `specs/` and `.specify/`, and writes only `tasks.md` checkboxes and `.specify/memory/**`;
- `tools/list` ≤ 12,000 characters;
- 10 tools.

**Scale/Scope**: up to 2,000 features and 5,000 notes, the scale of the existing load suite.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project's constitution is created by this feature (US6), from PRD-001 principles and TRD §2. Those principles are the gates:

| Gate | Status |
|---|---|
| I. Specs live in the repo, in plain Markdown, versioned in Git | ✅ Spec Kit files are plain Markdown in the repo |
| II. No LLM in the server | ✅ unchanged |
| III. Few tools (≤ 10), each described in ≤ 2 sentences | ✅ 10 tools, renamed |
| IV. No database or cache | ✅ files are re-read on every call |
| V. Test-first (NON-NEGOTIABLE) | ✅ every task group starts with failing tests (tasks.md) |
| VI. Safe I/O: path guard, atomic and byte-minimal writes, no overwrite | ✅ the allowlist is stricter than before |

Post-design re-check: ✅ there are no violations; see Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-speckit-format/
├── spec.md
├── plan.md              # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tools.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── index.ts                 # loadConfig + stdio
├── server.ts                # registers features, decisions, memory, context
├── config.ts                # SPECWRIGHT_ROOT, .specify/specwright.json
├── deps.ts
├── errors.ts                # renamed codes (FEATURE_NOT_FOUND, TASK_NOT_FOUND, …)
├── storage/
│   ├── paths.ts             # resolveInside + allowlist (specs/, .specify/)
│   ├── files.ts  lock.ts  concurrency.ts  slug.ts  text.ts
│   └── markdown.ts          # + stripComments(), codeFenceMask
├── features/                # replaces src/specs/
│   ├── types.ts             # Feature, Specification, UserStory, Item, Task, ArtifactName
│   ├── schemas.ts           # featureId, taskId, story, artifact name
│   ├── artifacts.ts         # artifact → path; which artifacts exist
│   ├── spec-parser.ts       # parseSpecification(raw)
│   ├── tasks-parser.ts      # parseTasks(raw)
│   ├── feature.ts           # buildFeature(): validation, summarize()
│   ├── task-editor.ts       # setTaskCheckbox(raw, id, done)
│   ├── diff.ts              # moved unchanged from src/specs/diff.ts
│   ├── repository.ts        # listFeatureIds, readFeature, readAllFeatures, readArtifact, assertValid
│   ├── tools/
│   │   ├── list-features.ts  get-artifact.ts  list-open-tasks.ts
│   │   └── set-task-status.ts  check-against-spec.ts
│   └── index.ts
├── constitution/
│   ├── types.ts  parser.ts  repository.ts   # readConstitution (read-only)
├── decisions/               # path → .specify/memory/decisions, field feature
│   ├── types.ts  repository.ts  tools/{log-decision,list-decisions}.ts  index.ts
├── memory/                  # path → .specify/memory/notes; search adds constitution
│   ├── types.ts  repository.ts  search.ts  tools/{save-memory,search-memory}.ts  index.ts
└── context/                 # candidates from spec/plan sections, tasks, constitution
    ├── types.ts  estimate.ts  candidates.ts  packer.ts  files.ts  tools/pack-context.ts  index.ts

tests/
├── fixtures/speckit/        # Spec Kit-shaped project (template comments and fences kept)
├── helpers.ts               # makeProject(), connect(), copyFixture()
├── unit/  integration/  contract/  perf/  load/
```

**Structure Decision**: This is a single project. `src/specs/` becomes `src/features/` to match Spec Kit's "feature" unit. `constitution/` is a new read-only module. The other modules keep their place and change their paths and field names.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

There are no violations. Note the breaking change: v0.1.0 projects that use `.specwright/` must migrate (FR-014). The README documents the steps, and the version goes to 0.2.0.
