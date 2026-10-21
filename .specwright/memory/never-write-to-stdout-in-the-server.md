---
id: never-write-to-stdout-in-the-server
type: pitfall
title: Never write to stdout in the server
tags:
  - stdio
  - logging
date: 2026-10-21
---
stdout carries JSON-RPC over stdio. Any console.log corrupts the protocol; use console.error for diagnostics.
