---
id: memory
title: Project memory (save_memory, search_memory)
status: done
---

## Context
Phase 2 of the [Roadmap](../../docs/03-roadmap.md). Conventions, learnings and pitfalls that an agent discovers are saved as Markdown and found again in later sessions, together with recorded decisions, without rereading files. Requirements covered: FR-8, FR-9 (PRD-001).

## Requirements
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

## Acceptance criteria
- [x] AC-1: `save_memory` creates `memory/<slug>.md` with the frontmatter fields and the body, and returns a relative `path`
- [x] AC-2: Saving the same title twice creates `<slug>-2.md`, and the first file is unchanged
- [x] AC-3: An unknown `type`, an empty title or an empty body is rejected, and nothing is written
- [x] AC-4: `memory/` is created on demand, and a missing root gives `NOT_INITIALIZED`
- [x] AC-5: The ranking puts a title match above a tag match above a body match
- [x] AC-6: Decisions are searched too (`kind: decision`), and `type` filters by memory type or `decision`
- [x] AC-7: The search ignores case and accents: `convenção` finds `convencao` and the reverse
- [x] AC-8: `limit` defaults to 10 and is capped at 50, and every snippet is at most 200 characters and contains a matched term when the body matches
- [x] AC-9: A query with only stopwords or punctuation gives `INVALID_INPUT`
- [x] AC-10: A memory saved by one server instance is found by a new instance on the same root (persists across sessions)
- [x] AC-11: Searching 1,000 memories and 200 decisions takes under 300 ms

## Out of scope
- Editing or deleting memories (humans edit the files)
- Embeddings or any external index (ADR-0004)
