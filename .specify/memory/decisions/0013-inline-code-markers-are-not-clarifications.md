---
id: "0013"
feature: 009-speckit-format
title: Inline-code markers are not clarifications
date: 2026-10-21
status: accepted
---
## Decision
[NEEDS CLARIFICATION: ...] inside backticks is ignored when counting open clarifications.

## Rationale
Dogfooding: spec 009 quotes the marker in inline code and was reported with 2 open clarifications.

## Alternatives considered
Counting every match (false positives in specs that document Spec Kit itself).
