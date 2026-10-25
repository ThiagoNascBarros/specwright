---
id: "0001"
feature: 001-photo-albums
title: Keep photo data as plain files
date: 2026-10-02
status: accepted
---
## Context
FR-001 needs stored photos that people can inspect and diff.

## Decision
Photo data stays as plain files on disk. Identifiers follow [[keep-ids-stable]].

## Consequences
Tools read the files directly, so no database is needed.
