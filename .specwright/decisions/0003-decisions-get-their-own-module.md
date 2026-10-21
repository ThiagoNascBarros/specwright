---
id: "0003"
spec_id: decision-log
title: Decisions get their own module
date: 2026-10-21
status: accepted
---
## Context
Decisions are written by log_decision and read by list_decisions and search_memory (Phase 2). Keeping them inside specs/ or memory/ would couple those modules.

## Decision
src/decisions/ owns the decision entity (types, repository, tools). Modules may consume another module public repository functions, never its tools.

## Consequences
The TRD dependency rules are relaxed from only context may consume others to read-only use of public repository functions.
