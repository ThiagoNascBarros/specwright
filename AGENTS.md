# Working on Specwright (Codex and other agents)

Specwright is an MCP server (TypeScript, stdio) that keeps specs, decisions, notes and a knowledge graph as the source of truth for AI agents. It has 18 tools.

## Rules
- Specs are written in English. Conversation with the user may be in Portuguese.
- One spec at a time: follow the "Per-spec cycle" in `docs/03-roadmap.md`.
- TDD is mandatory: every `FR-###` and acceptance scenario has a test that cites its id in its name, seen failing before the implementation.
- One responsibility per file. Entities in `types.ts`, disk access in `repository.ts`, pure logic in its own file, each tool in `tools/<tool-name>.ts`. Only `storage/` and `repository.ts` touch the disk.
- Never write to stdout in the server; diagnostics go to stderr. Only the `graph` CLI prints to stdout.
- A change is ready only when `npm run typecheck`, `npm test` and `npm run test:load` are green.
- Git: branch `<type>/SW-<n>-<description>`, Conventional Commits with a `Refs: SW-<n>` trailer, PR title `[SW-<n>] <type>: <summary>`. No co-author trailers.
- Constitution: `.specify/memory/constitution.md`. Global constraints: `docs/02-trd.md` §2.

## Specwright instructions for agents

Specwright keeps this project's specs, tasks, decisions and notes as a knowledge graph. Before reading whole files or searching for a spec or design question, call query_graph (get_node for one id, find_path for how two things relate) and read only what it points to. Start a task with pack_context and close it with check_against_spec, set_task_status and log_decision. Run lint_memory after renaming or deleting files. Files under .specify/graph/ are derived; never edit them.
