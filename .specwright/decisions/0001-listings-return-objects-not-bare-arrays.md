---
id: "0001"
spec_id: spec-reading
title: Listings return objects, not bare arrays
date: 2026-10-21
status: accepted
---
## Context
TRD §7 described list outputs as bare arrays, but truncation (NFR-4) needs a place for the truncated flag.

## Decision
Every listing returns an object with one array field (specs, open, decisions, results) plus an optional truncated: true.

## Consequences
Clients read data.specs instead of data; the TRD tool table is updated to match.
