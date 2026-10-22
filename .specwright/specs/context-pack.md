---
id: context-pack
title: Pack the minimal context for a task (pack_context)
status: done
---

## Context
Phase 3 of the [Roadmap](../../docs/03-roadmap.md). Given a task description, the server returns the spec sections, memories and decisions that matter most, plus the file paths they mention, all within a token budget. The agent then starts work without broad reads. Requirement covered: FR-11 (PRD-001). It decides PRD Q1.

## Requirements
- **PRD Q1 decision.** Tokens are estimated as `ceil(chars / 4)`, with no tokenizer dependency. The estimate is documented as approximate.
- **NFR-6 is kept.** Candidate files are the paths cited in backticks inside the selected items (for example `src/auth.ts`). The server never lists or reads project files outside the root.
- `src/context/` module:
  - `types.ts`, the entities;
  - `estimate.ts`, the token estimate;
  - `candidates.ts`, which collects and scores items;
  - `packer.ts`, the greedy fill;
  - `files.ts`, which extracts paths;
  - `tools/pack-context.ts`, the tool.
- `pack_context({ task, budget_tokens?, spec_id? })` → `{ budget_tokens, used_tokens, items: [{ kind, ref, title, score, tokens, content }], files, skipped }`.
  - `kind` ∈ `spec-section | memory | decision`.
  - `ref` is `<spec_id>#<section>` for a spec section, and the memory id or the decision id otherwise.
  - Scoring uses the `search_memory` tokenizer:
    - spec sections: heading 3, spec title 2, content 1;
    - memories and decisions: the `search_memory` weights.
  - Items are added in score order while they fit the remaining budget. An item that does not fit is skipped and counted in `skipped`, and smaller items after it can still be added.
  - With `spec_id`, spec sections come only from that spec, and its acceptance-criteria section is pinned first.
  - `budget_tokens` defaults to 4,000 and must be between 200 and 100,000. The effective budget is capped at `floor((maxResponseChars − 2,000) / 4)`, so the response is never truncated, and the effective value is reported.
  - Invalid specs are ignored. `files` holds at most 20 unique paths, the most cited first.

## Acceptance criteria
- [x] AC-1: Returns the relevant items ranked by score, each with `kind`, `ref`, `title`, `score`, `tokens` and `content`
- [x] AC-2: Every item's `tokens` is `ceil(content.length / 4)`, and `used_tokens` is their sum
- [x] AC-3: `used_tokens` never exceeds the budget. An item larger than the remaining budget is skipped and counted, and smaller lower-ranked items are still added.
- [x] AC-4: With `spec_id`, only that spec's sections are used, and its acceptance-criteria section comes first
- [x] AC-5: Relevant memories and decisions are included next to spec sections
- [x] AC-6: `files` lists the unique backticked paths cited by the selected items, at most 20, without reading any file outside the root
- [x] AC-7: Invalid specs never contribute items
- [x] AC-8: A task with no searchable terms gives `INVALID_INPUT`, a budget outside 200–100,000 is rejected, and an unknown `spec_id` gives `SPEC_NOT_FOUND`
- [x] AC-9: The effective budget is capped by `maxResponseChars`, and the response is never truncated
- [x] AC-10: With 500 specs and 1,000 memories, `pack_context` answers in under 1 second
- [x] AC-11: The finished server exposes exactly the 10 tools of PRD NFR-2, and `tools/list` stays within 12,000 characters

## Out of scope
- Reading source files or their content
- A real tokenizer (revisit if estimates prove too far off)
