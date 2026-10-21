# ADR-0001 — Project name: Specwright

- **Status:** accepted
- **Date:** 2026-10-21

## Context
The provisional name "Spec Guardian MCP" was descriptive, but generic and long. We need a short, memorable name that is available as an npm package.

## Decision
Adopt **Specwright** ("wright" = craftsman, as in playwright): the one who works the spec. Folder `.specwright/`, variable `SPECWRIGHT_DIR`, package `specwright-mcp`.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| **Specwright** | Says what it does, evokes craft, free on npm | Less obvious than "guardian" |
| Lodestar | Guiding star, free on npm | Abstract, does not evoke specs |
| Cairn | Good metaphor for memory/decisions | `cairn-mcp` already exists on npm |
| Plumb | Plumb line = alignment with the spec | `plumb-mcp` already exists on npm |
| Spec Guardian | Descriptive | Long and generic |

## Consequences
Rename the draft's references (`.spec-guardian` → `.specwright`). npm availability must be re-checked before publication.
