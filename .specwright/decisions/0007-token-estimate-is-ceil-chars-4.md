---
id: "0007"
spec_id: context-pack
title: Token estimate is ceil(chars / 4)
date: 2026-10-21
status: accepted
---
## Context
PRD Q1 asked whether pack_context needs a real tokenizer.

## Decision
Estimate tokens as ceil(chars / 4) with no tokenizer dependency, documented as approximate.

## Consequences
Budgets are approximate; revisit if the estimate proves far off for real models.
