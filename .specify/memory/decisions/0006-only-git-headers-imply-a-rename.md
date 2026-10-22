---
id: "0006"
feature: 005-check-task
title: Only git headers imply a rename
date: 2026-10-21
status: accepted
---
## Context
Plain diff -u compares two trees (old/x vs new/x), so different paths do not mean a rename.

## Decision
status renamed is reported only for diff --git headers whose paths differ, or rename from/to lines.

## Consequences
Plain diffs are reported as modified with the new path.
