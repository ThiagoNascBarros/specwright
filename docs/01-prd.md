---
id: PRD-001
title: Specwright — Product Requirements Document
status: accepted
version: 1.1
---

# PRD-001 — Specwright

> **v1.1 (2026-10-21):** Specwright now follows GitHub Spec Kit's file format and vocabulary (feature [009-speckit-format](../specs/009-speckit-format/spec.md)). The requirements below keep their ids; FR-1 to FR-11 now name the Spec Kit tools.

> MCP server that keeps specs, decisions and project memory as the source of truth for AI agents and assembles the minimal context needed for each task.

This document answers **what** and **why**. The **how** is in [TRD-001](02-trd.md).

## 1. Problem

In agentic development, three pains recur:

1. **Spec drift:** as the session advances, the agent drifts away from what was specified and nobody notices until code review.
2. **Amnesia between sessions:** decisions, conventions and discovered pitfalls are lost when the context runs out.
3. **Bloated context:** to "be safe", the agent reads too many files (or the whole PRD) and spends tokens on noise.

## 2. Vision

A single MCP server, in three modules that share the same Markdown storage inside the repository:

| Module | Responsibility |
|---|---|
| `specs` | Queries specs and validates the agent's work against the acceptance criteria |
| `memory` | Keeps decisions, conventions and learnings across sessions |
| `context` | Assembles the minimal context (specs + memory + relevant code) for a task |

Cycle that the product closes:

```
spec -> code -> validation -> decision recorded -> spec/memory updated
```

## 3. Users

| User | Need |
|---|---|
| **AI agent** (Claude Code, other MCP clients) | Read only the spec section needed, validate its own work, record decisions and retrieve history |
| **Developer** | Write and review specs/decisions in Markdown, in Git, without proprietary tooling |

## 4. Goals and non-goals

**Goals**
- G1. Reduce drift: the agent can compare its work against the acceptance criteria before declaring "done".
- G2. Persist decisions and learnings in a form readable by humans and agents, versioned in Git.
- G3. Reduce the tokens spent reading context (reading by section, not by document).
- G4. Zero external runtime dependencies: no API key, no database, no service.

**Non-goals**
- N1. The server does **not** call an LLM nor judge compliance; it delivers structured data and the agent decides.
- N2. It is not a task/issue manager and does not replace Jira, Linear or similar tools.
- N3. It does not generate code or specs automatically.
- N4. No database server nor vector index; derived, rebuildable caches are allowed.
- N5. No web interface, no multi-user/concurrency across machines (Git is the synchronization mechanism).

## 5. Functional requirements

Priority: **P0** = Phase 1 (core), **P1** = Phase 2, **P2** = Phase 3.

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-1 | Read GitHub Spec Kit features (`specs/NNN-name/` with `spec.md`, `plan.md`, `tasks.md`…) and `.specify/memory/constitution.md`, always reflecting the current files | P0 | 1 |
| FR-2 | `list_features`: list features with id, title, status, artifacts and task progress | P0 | 1 |
| FR-3 | `get_artifact`: return a Spec Kit artifact (or the constitution), whole or one section | P0 | 1 |
| FR-4 | `list_open_tasks`: list open `T###` tasks, from one feature or all, optionally by user story | P0 | 1 |
| FR-5 | `check_against_spec`: receive a diff + feature and return requirements, success criteria, scenarios, edge cases, open tasks and a structured summary of the changes | P0 | 1 |
| FR-6 | `set_task_status`: mark/unmark a `T###` task in `tasks.md`, as `/speckit-implement` does | P0 | 1 |
| FR-7 | `log_decision`: record a decision linked to a feature in `.specify/memory/decisions/` | P0 | 1 |
| FR-8 | `save_memory`: save a convention, learning or pitfall | P1 | 2 |
| FR-9 | `search_memory`: search notes, decisions and constitution principles by topic | P1 | 2 |
| FR-10 | `list_decisions`: list decisions, filtering by feature or period | P1 | 2 |
| FR-11 | `pack_context`: given a task, return spec/plan sections, open tasks, principles, decisions, notes and candidate files within a token budget | P2 | 3 |

## 6. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | No LLM and no API key in the server | 0 model calls |
| NFR-2 | No overlapping tools | each tool answers a distinct question; descriptions ≤ 2 sentences |
| NFR-3 | Context cost of tools | `tools/list` JSON ≤ 12,000 characters (≈ 3,000 tokens); each tool description ≤ 2 sentences |
| NFR-4 | Token-efficient responses | `get_artifact` by section; listings without body; response truncated above `maxResponseChars` (default 20,000) |
| NFR-5 | Safe writes and clean diffs | atomic writes; only the necessary line/file is changed; no reformatting of the user's Markdown |
| NFR-6 | Path safety | no read outside `specs/` and `.specify/`, writes only to `tasks.md` checkboxes and `.specify/memory/` (anti path traversal, anti symlink escape) |
| NFR-7 | Performance (project with 500 features, local disk) | `list_features` and `list_open_tasks` < 500 ms; other tools < 200 ms; `pack_context` < 1 s |
| NFR-8 | Actionable errors | structured error with a code and a fix hint, never a raw stack trace |
| NFR-9 | Portability | Node.js ≥ 22.12 (active or maintenance LTS); Linux, macOS, Windows; stdio transport |
| NFR-10 | Quality | TDD development: every `FR-###` and acceptance scenario has a test that cites the id and was seen failing before the implementation; whole suite green to complete a spec |

## 7. Success metrics

| Phase | Success signal |
|---|---|
| 1 | Dogfooding: on a feature of this repository, an agent runs the cycle `get_artifact` (by section) → implement → `check_against_spec` → `set_task_status` → `log_decision` without opening whole documents |
| 2 | A decision recorded in one session is retrieved via `search_memory` in a new session without re-reading files |
| 3 | `pack_context` delivers context within the configured budget and the agent completes the task without additional broad reads |

## 8. Scope per phase

- **Phase 1 — Spec core:** FR-1 to FR-7.
- **Phase 2 — Project memory:** FR-8 to FR-10, reusing `storage/` from Phase 1.
- **Phase 3 — Context Packer:** FR-11, with a configurable token budget.

Order of the development specs in the [Roadmap](03-roadmap.md).

## 9. Dependencies and assumptions

- MCP client with stdio support (e.g., Claude Code).
- The target project uses Git (not mandatory, but it is the history and review mechanism).
- The agent is responsible for judging compliance; the quality of `check_against_spec` depends on specs with clear, verifiable criteria.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Badly written specs (vague criteria) make validation useless | High | Spec Kit's spec template with stable `FR-###`/`SC-###` ids, Given/When/Then scenarios and its quality checklist |
| Agent ignores validation | Medium | Tool descriptions guide usage; recommended instruction for `CLAUDE.md` |
| Manual edits and server edits conflicting in the same file | Medium | Files re-read on every call; minimal, atomic edits; Git shows the diff |
| Client starts the server outside the project root | Medium | `SPECWRIGHT_ROOT` documented in the README; `NOT_INITIALIZED` error with a hint |
| Too many tools consume context | Medium | NFR-2/NFR-3 limits as a review criterion |
| Insufficient text search in Phase 2/3 | Low | More sophisticated index only when the need is proven |

## 11. Open questions

- ~~Q1. Format of the `pack_context` token budget.~~ **Decided** (decision 0007): estimate `ceil(chars / 4)`, with no tokenizer dependency.
- ~~Q2. Project license.~~ **Decided:** MIT ([LICENSE](../LICENSE)).
- Q3. Versioning of `config.json` and of the spec format. Still deferred; a file without a version is v1.

## 12. Delivery status

**v0.2.0** moves to Spec Kit's format; its measured results are in [tdd/phase-4.md](tdd/phase-4.md). The v0.1.0 results below are kept for history.

### v0.1.0

Every requirement in §5 and §6 is implemented and covered by tests. The test record of each phase is in [`tdd/`](tdd/).

| Phase | Success signal (§7) | Evidence |
|---|---|---|
| 1 | Full cycle on the repository itself | Specs 3–5 were closed with `set_criterion_status`, decisions 0001–0006 were written with `log_decision`, and `check_task_against_spec` summarized a real 353-line diff exactly like `git diff --numstat` |
| 2 | Memory found again in a new session | The `memory` AC-10 test and the end-to-end stdio workflow test start a second server process and find memories and decisions saved by the first one |
| 3 | Context within budget | `pack_context` on this repository returned 10 relevant items using 1,487 of 1,500 tokens, plus the cited source files |

Measured NFR-7 medians on a laptop (CI medians in brackets):

| Scenario | Budget | Result |
|---|---|---|
| `list_specs`, 500 specs | < 500 ms | 57–85 ms (89–95 ms) |
| `get_spec` with section, 500 specs | < 200 ms | < 1 ms |
| `search_memory`, 1,000 memories + 200 decisions | < 300 ms | 137–162 ms (167–200 ms) |
| `pack_context`, 500 specs + 1,000 memories | < 1 s | 184–190 ms (225–238 ms) |
| `check_task_against_spec`, 50,000-line diff | < 500 ms | passes |
