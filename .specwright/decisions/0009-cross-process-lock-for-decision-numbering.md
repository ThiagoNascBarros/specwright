---
id: "0009"
spec_id: decision-log
title: Cross-process lock for decision numbering
date: 2026-10-21
status: accepted
---
## Context
Load test: two server processes writing to the same root produced duplicate decision numbers (28 unique ids for 40 files), because wx only protects the full file name and slugs differ.

## Decision
Number allocation runs under a mkdir-based lock (decisions/.lock) shared by all processes, broken when older than 10 s; the in-process queue stays.

## Consequences
Two agent sessions on one project can log decisions safely. TRD §5.1 no longer assumes a single server per project for decisions.
