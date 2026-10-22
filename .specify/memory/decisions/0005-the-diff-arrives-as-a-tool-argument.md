---
id: "0005"
feature: 005-check-task
title: The diff arrives as a tool argument
date: 2026-10-21
status: accepted
---
## Context
TRD Q1: passing the diff costs its tokens in the call; reading it from Git would need child_process, which TRD §2 forbids.

## Decision
Keep the diff as an argument and never run git in the server. Agents that only need the criteria call get_spec.

## Consequences
Dogfooding on this repository: a 353-line diff summary matched git diff --numstat exactly. Revisit with a base_ref option only if token cost becomes a real problem.
