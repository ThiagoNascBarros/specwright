# ADR-0005 — Dedicated tool for checking off criteria (`set_criterion_status`)

- **Status:** accepted
- **Date:** 2026-10-21

## Context
`list_open_requirements` depends on the `[ ]`/`[x]` checkboxes, but the initial draft had no tool that changed them, leaving the spec → validation → updated spec cycle incomplete.

## Decision
Add `set_criterion_status(spec_id, ac_id, done)`. It is the 6th tool of Phase 1, and with it the product total reaches 10, the ceiling of PRD NFR-2. The server changes only the checkbox character on the `AC-n` line, atomically and idempotently.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| **Dedicated tool** | Single responsibility; the cycle closes inside MCP; easy to test | Uses one of the 10 tools |
| Human edits the file | Simpler and safer | Cycle stays manual; the agent cannot record progress |
| `check_task_against_spec` checks it by itself | Fewer tools | Mixes read and write; unexpected side effect in a query tool |

## Consequences
The tool budget is exhausted (10/10): a new tool requires removing or merging another one. Writing to a spec requires the minimal editing infrastructure of `storage/`.
