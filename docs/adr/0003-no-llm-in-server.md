# ADR-0003 — No LLM inside the server

- **Status:** accepted
- **Date:** 2026-10-21

## Context
`check_task_against_spec` and `pack_context` seem to call for semantic judgment. We could call a model inside the server to decide whether the diff meets the spec.

## Decision
The server **does not call any model and does not require an API key**. It delivers structured data (criteria, out-of-scope items, diff summary, selected excerpts); the agent that called it is the one who judges.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| **No LLM** | Zero cost and dependency; deterministic and testable; no code leaking to third parties | Judgment depends on the calling agent |
| Embedded LLM | Ready-made verdict | API key, cost, non-determinism, privacy, a second model opining on the first |
| Optional LLM (flag) | Flexible | Doubles the test and config surface; out of the initial scope |

## Consequences
The quality of validation depends on clear `AC-n` criteria. Tool descriptions must instruct the agent to compare and report gaps. It can be revisited if real use shows the need.
