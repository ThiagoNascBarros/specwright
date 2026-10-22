# Data Model: Spec Kit format

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-21

All entities are read from files and never cached. Types live in each module's `types.ts`.

## Feature (`src/features/types.ts`)

| Field | Type | Source / rule |
|---|---|---|
| `id` | string | folder name under `specs/`, `^(\d{3,}\|\d{8}-\d{6})-[a-z0-9][a-z0-9-]*$` |
| `title` | string | `# Feature Specification: <title>` in `spec.md` |
| `branch`, `created`, `status`, `input` | string | the `**Feature Branch**:`, `**Created**:`, `**Status**:` and `**Input**:` lines; empty when missing |
| `artifacts` | `ArtifactName[]` | which of `spec, plan, tasks, research, data-model, quickstart, contracts, checklists` exist |
| `valid` | boolean | false when a blocking issue exists (below) |
| `issues` | string[] | blocking issues first, then warnings |
| `spec` | `Specification \| undefined` | parsed `spec.md` |
| `tasks` | `Task[]` | parsed `tasks.md` (empty if missing) |

**Blocking issues (FR-015).** Any of these makes the feature invalid:
- `spec.md` is missing;
- there is no `# Feature Specification:` heading;
- a `T###`, `FR-###` or `SC-###` id is duplicated.

**Warnings.** These are reported but do not make the feature invalid:
- a checkbox line in `tasks.md` without a `T###` id;
- a `**Status**:` line is missing.

## Specification

| Field | Type | Rule |
|---|---|---|
| `sections` | `Section[]` | `##` blocks (from `storage/markdown`), after HTML comments are stripped |
| `userStories` | `UserStory[]` | `### User Story N - Title (Priority: Pn)` |
| `requirements` | `Item[]` | `- **FR-###**: text` |
| `successCriteria` | `Item[]` | `- **SC-###**: text` |
| `edgeCases` | string[] | list items of `### Edge Cases` |
| `assumptions` | string[] | list items of `## Assumptions` |
| `clarifications` | string[] | the text of each `[NEEDS CLARIFICATION: …]` marker outside fences and comments |

- **`UserStory`**: `{ number: number; title: string; priority: string /* "P1" */; scenarios: string[] }`. Each scenario is the numbered `**Given** … **When** … **Then** …` line, without the Markdown emphasis, for example `Given X, When Y, Then Z`.
- **`Item`**: `{ id: string; text: string }`.

## Task

| Field | Type | Rule |
|---|---|---|
| `id` | string | `T\d{3,}` |
| `done` | boolean | `[x]` or `[X]` |
| `parallel` | boolean | `[P]` present |
| `story` | string \| undefined | `US\d+` |
| `phase` | string | text after `## Phase N:` of the nearest heading above, e.g. `User Story 1 - Upload photos (Priority: P1) 🎯 MVP`; `""` if none |
| `text` | string | description after the labels |

**State transition.** `open ⇄ done`, only through `set_task_status`, which rewrites one character: ` ` ⇄ `X`.

## Checklist (read-only)

`checklists/<name>.md`. It is returned as text by `get_artifact` (`artifact: "checklist"`, `name`), and its `CHK###` items are never written.

## Constitution (`src/constitution/types.ts`)

| Field | Type | Rule |
|---|---|---|
| `title` | string | first `# ` heading |
| `principles` | `{ key, name, content }[]` | `###` blocks under `## Core Principles` |
| `sections` | `Section[]` | `##` blocks |
| `version` | string | `**Version**:` value, `""` if missing |

## Decision (`src/decisions/types.ts`)

File `.specify/memory/decisions/NNNN-<slug>.md`:

```markdown
---
id: "0007"
feature: 001-photo-albums
title: Store metadata in SQLite
date: 2026-10-21
status: accepted
---
## Decision
## Rationale
## Alternatives considered
```

Input: `{ feature, title, decision, rationale?, alternatives? }`. When read back, the record is `{ id, feature, title, date, status, path, body }`. Reading accepts any `##` sections, so migrated decisions stay valid.

## Note (`src/memory/types.ts`)

File `.specify/memory/notes/<slug>.md`. Its frontmatter is `id`, `type` (`convention | learning | pitfall`), `title`, `tags` and `date`, followed by the body. The fields are unchanged from v0.1.0; only the folder changes.

## Context item (`src/context/types.ts`)

`kind` ∈ `spec-section | plan-section | task | constitution | decision | memory`. `ref` takes one of these forms:
- `<feature>/spec.md#<section-key>`
- `<feature>/plan.md#<section-key>`
- `<feature>/tasks.md#T012`
- `constitution#<principle-key>`
- the decision id
- the note id
