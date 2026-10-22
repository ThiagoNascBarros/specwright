---
id: "0002"
feature: 002-spec-reading
title: Composition root in src/server.ts
date: 2026-10-21
status: accepted
---
## Context
Tests need the full server in-process, without stdio.

## Decision
createServer(config, deps) in src/server.ts registers every module; src/index.ts only loads config and connects stdio.

## Consequences
Integration tests use InMemoryTransport; the stdio contract test still covers dist/index.js.
