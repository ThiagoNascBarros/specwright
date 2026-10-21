---
id: one-entity-per-file
type: convention
title: One entity per file
tags:
  - architecture
  - layout
date: 2026-10-21
---
Each module splits types.ts (entities), repository.ts (disk access through storage/), pure logic files (parser, search, diff) and tools/<tool-name>.ts with one tool each. index.ts only registers the tools.
