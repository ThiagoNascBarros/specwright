---
id: "0010"
spec_id: spec-reading
title: Linear response truncation and bounded file reads
date: 2026-10-21
status: accepted
---
## Context
Load test: list_open_requirements over 2,000 specs took 33 s because truncation re-serialized the whole response per dropped item; reads also opened every file at once.

## Decision
Truncation measures the envelope once and adds items while they fit; repositories read at most 32 files at a time.

## Consequences
2,000 specs: list_open_requirements 33 s to 188 ms; no EMFILE risk on low ulimit systems.
