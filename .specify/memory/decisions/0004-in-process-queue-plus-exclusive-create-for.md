---
id: "0004"
feature: 004-decision-log
title: In-process queue plus exclusive create for numbering
date: 2026-10-21
status: accepted
---
## Context
Parallel log_decision calls computed the same next number.

## Decision
Serialize creations within the process with a promise queue; keep the wx flag and up to 5 retries for other processes.

## Consequences
10 parallel calls produce 0001..0010 deterministically.
