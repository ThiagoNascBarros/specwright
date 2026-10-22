---
id: "0012"
feature: 009-speckit-format
title: One line scanner for the tasks parser and editor
date: 2026-10-21
status: accepted
---
## Decision
tasks-parser scanTasks() marks fences, HTML comments and frontmatter once; setTaskCheckbox edits only lines that scanner reports as tasks.

## Rationale
A line the parser counts is exactly a line the editor may touch, so a task-like line in the template Parallel Example can never be edited.

## Alternatives considered
Separate regex passes in editor and parser (could disagree).
