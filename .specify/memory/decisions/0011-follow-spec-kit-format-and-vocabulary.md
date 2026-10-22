---
id: "0011"
feature: 009-speckit-format
title: Follow Spec Kit format and vocabulary
date: 2026-10-21
status: accepted
---
## Decision
Read Spec Kit v1.2.x features (specs/NNN-name/) and track progress through tasks.md T### checkboxes; tools renamed to list_features, get_artifact, list_open_tasks, set_task_status, check_against_spec.

## Rationale
The owner asked that Specwright follow Spec Kit exactly; Spec Kit tracks progress in tasks.md and keeps checklists reviewer-owned.

## Alternatives considered
Supporting both formats (two parsers, two progress rules); keeping v0.1.0 tool names (misleading once criteria no longer exist).
