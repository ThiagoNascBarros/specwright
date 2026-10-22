# Implementation Plan: Pack the minimal context for a task (pack_context)

**Branch**: `feature/SW-4-context-packer` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

## Summary

Migrated from the v0.1.0 spec `context-pack`. The technical requirements below are the original ones; paths and tool names are those of v0.1.0 (see [009-speckit-format](../009-speckit-format/plan.md) for the current layout).

## Technical Context

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
