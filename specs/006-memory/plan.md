# Implementation Plan: Project memory (save_memory, search_memory)

**Branch**: `feature/SW-3-project-memory` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `memory`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

- `src/memory/` module:
  - `types.ts`, the `Memory` entity;
  - `repository.ts`, which creates and reads memories;
  - `search.ts`, the ranking;
  - `tools/save-memory.ts` and `tools/search-memory.ts`.
- `src/storage/text.ts`: `tokenize(text)`. It lowercases, removes accents, splits on non-alphanumerics, keeps terms of 2 or more characters and drops a small English and Portuguese stopword list.
- `save_memory({ type, title, body, tags? })` → `{ id, path }`:
  - `type` ∈ `convention | learning | pitfall`;
  - the file is `memory/<slug>.md`, with frontmatter `id`, `type`, `title`, `tags` and `date`, and the body as given;
  - when the slug is taken, the next free `-2`, `-3`, … suffix is used, and nothing is overwritten;
  - limits: title 1–200 characters, body at least 1, up to 20 tags of 1–40 characters each, deduplicated.
- `search_memory({ query, type?, limit? })` → `{ results: [{ kind, id, title, type?, spec_id?, tags?, date, path, score, snippet }] }`:
  - it searches memories and decisions; `kind` ∈ `memory | decision`, and `type` filters by memory type or by `decision`;
  - score = Σ over query terms of occurrences × weight: title 3, tags 2, body 1;
  - only results with a positive score are returned, sorted by score, then newest date, then id;
  - `limit` defaults to 10, with a maximum of 50;
  - `snippet` is at most 200 characters around the first body match.
