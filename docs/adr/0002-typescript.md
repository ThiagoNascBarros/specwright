# ADR-0002 — Stack: TypeScript with the official MCP SDK

- **Status:** accepted
- **Date:** 2026-10-21

## Context
The draft listed "Python or Dotnet" and "Node.js" at the same time, while the folder structure already used `src/index.ts`. A stack had to be chosen.

## Decision
**TypeScript** on Node.js ≥ 22.12 (the floor required by the test runner, Vitest 5), with the official **v2** SDK `@modelcontextprotocol/server` (2.3.x on 2026-10-21) and `zod` v4 to validate inputs. stdio transport.

The old `@modelcontextprotocol/sdk` package (1.x) is still published, but v2 splits the packages by role (`server`, `client`, `core`) and is the current line. The contract test uses `@modelcontextprotocol/client` as a development dependency.

## Alternatives
| Option | Pros | Cons |
|---|---|---|
| **TypeScript** | Most mature SDK; distribution via `npx` with no extra runtime for those who already use Node; types for tool contracts | Requires Node installed |
| Python (FastMCP) | Lean code; `uvx`/`pipx` | Less uniform distribution; outside the structure already designed |
| .NET | Official C# SDK; fits the .NET ecosystem | Larger binary; less common for agent tools |

## Consequences
Build with `tsc`, tests with Vitest, npm package with `bin`. Anyone without Node must install it (Node ≥ 22.12).
