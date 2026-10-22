---
id: "0008"
spec_id: context-pack
title: Candidate files come from cited paths
date: 2026-10-21
status: accepted
---
## Context
FR-11 asks for candidate files, but NFR-6 forbids reading outside SPECWRIGHT_DIR.

## Decision
pack_context returns the backticked paths cited by the selected items; it never lists or reads project files.

## Consequences
Specs and memories that cite paths in backticks make pack_context more useful; NFR-6 holds without exceptions.
