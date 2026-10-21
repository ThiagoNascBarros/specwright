---
id: PRD-001
title: Specwright — Product Requirements Document
status: draft
version: 0.2
---

# PRD-001 — Specwright

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
- N4. There is no database nor vector index at the start.
- N5. No web interface, no multi-user/concurrency across machines (Git is the synchronization mechanism).

## 5. Functional requirements

Priority: **P0** = Phase 1 (core), **P1** = Phase 2, **P2** = Phase 3.

| ID | Requirement | Pri | Phase |
|---|---|---|---|
| FR-1 | Read Markdown specs with frontmatter (`id`, `title`, `status`) from `.specwright/specs/`, always reflecting the current state of the files | P0 | 1 |
| FR-2 | `list_specs`: list specs with id, title and status | P0 | 1 |
| FR-3 | `get_spec`: return a whole spec or only the requested section | P0 | 1 |
| FR-4 | `list_open_requirements`: list unmet acceptance criteria, from one spec or from all | P0 | 1 |
| FR-5 | `check_task_against_spec`: receive diff + `spec_id` and return criteria, out-of-scope items and a structured summary of the changes | P0 | 1 |
| FR-6 | `set_criterion_status`: mark/unmark an `AC-n` criterion of a spec | P0 | 1 |
| FR-7 | `log_decision`: record a decision linked to a spec | P0 | 1 |
| FR-8 | `save_memory`: save a convention, learning or pitfall | P1 | 2 |
| FR-9 | `search_memory`: search memories and decisions by topic | P1 | 2 |
| FR-10 | `list_decisions`: list decisions, filtering by spec or period | P1 | 2 |
| FR-11 | `pack_context`: given a task, return spec sections, memories and candidate files within a token budget | P2 | 3 |

## 6. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | No LLM and no API key in the server | 0 model calls |
| NFR-2 | Lean tool surface | ≤ 10 tools in total |
| NFR-3 | Context cost of tools | `tools/list` JSON ≤ 12,000 characters (≈ 3,000 tokens); each tool description ≤ 2 sentences |
| NFR-4 | Token-efficient responses | `get_spec` by section; listings without body; response truncated above `maxResponseChars` (default 20,000) |
| NFR-5 | Safe writes and clean diffs | atomic writes; only the necessary line/file is changed; no reformatting of the user's Markdown |
| NFR-6 | Path safety | no read/write outside `SPECWRIGHT_DIR` (anti path traversal, anti symlink escape) |
| NFR-7 | Performance (project with 500 specs, local disk) | `list_specs` and `list_open_requirements` < 500 ms; other tools < 200 ms; `pack_context` outside the target |
| NFR-8 | Actionable errors | structured error with a code and a fix hint, never a raw stack trace |
| NFR-9 | Portability | Node.js ≥ 22.12 (active or maintenance LTS); Linux, macOS, Windows; stdio transport |
| NFR-10 | Quality | TDD development: every `AC-n` has a test that cites the id and was seen failing before the implementation; whole suite green to complete a spec |

## 7. Success metrics

| Phase | Success signal |
|---|---|
| 1 | Dogfooding: in the `check-task` spec, an agent runs the cycle `get_spec` (by section) → implement → `check_task_against_spec` → `set_criterion_status` → `log_decision` without opening the whole PRD or TRD |
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
- The agent is responsible for judging compliance; the quality of `check_task_against_spec` depends on specs with clear, verifiable criteria.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Badly written specs (vague criteria) make validation useless | High | Format with stable `AC-n` ids; spec-writing guide; spec lint as a future evolution |
| Agent ignores validation | Medium | Tool descriptions guide usage; recommended instruction for `CLAUDE.md` |
| Manual edits and server edits conflicting in the same file | Medium | Files re-read on every call; minimal, atomic edits; Git shows the diff |
| Client starts the server outside the project root | Medium | Absolute `SPECWRIGHT_DIR` documented in the README; `NOT_INITIALIZED` error with a hint |
| Too many tools consume context | Medium | NFR-2/NFR-3 limits as a review criterion |
| Insufficient text search in Phase 2/3 | Low | More sophisticated index only when the need is proven |

## 11. Open questions

- Q1. Format of the `pack_context` token budget (character estimate or real tokenizer). Decide in Phase 3.
- Q2. Project license (to be defined before the first publication).
- Q3. Versioning policy for `config.json` and migration of specs between format versions.
