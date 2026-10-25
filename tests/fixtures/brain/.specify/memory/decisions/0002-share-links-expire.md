---
id: "0002"
feature: 002-sharing
title: Share links expire
date: 2026-10-05
status: accepted
---
## Context
Shared links must not stay valid forever. This extends the storage choice, see decision 0001.

## Decision
Every share link carries an expiry date. Identifiers follow [[keep-ids-stable]].

## Consequences
- depends_on [[0001-keep-photo-data-as-plain-files]]
