# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| 0.1.x | ❌ (use 0.2) |

## Security model

Specwright runs locally as an MCP stdio server that reads and writes files the agent asks it to. Its guarantees ([TRD §5.1, §12](docs/02-trd.md)):

- **No network access and no command execution.** The server never opens sockets, never spawns processes and never calls an LLM.
- **Confined to Spec Kit folders.** Every path is resolved with `realpath` and must stay under `specs/` or `.specify/` of the project root (`SPECWRIGHT_ROOT`). `..`, absolute paths, drive letters, backslash traversal and symlinks pointing anywhere else are rejected with `PATH_OUTSIDE_ROOT`. Writes are limited to `tasks.md` checkboxes and `.specify/memory/`.
- **Validated identifiers.** `feature`, `task_id`, `story` and artifact names are checked against strict patterns before any disk access.
- **No overwrites.** New decisions and memories use exclusive creation, and spec edits change only one checkbox character, through an atomic rename.
- **No path leaks.** Errors never include absolute paths; details go to stderr only.
- **Content is data.** Spec, decision and memory text is returned to the agent and never interpreted by the server. Treat files from untrusted contributors the way you would treat any text you feed to an agent.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting (**Security → Report a vulnerability**) on this repository, or contact the maintainer directly through GitHub.

Include:
- the version or commit;
- your OS and Node version;
- a minimal `specs/` / `.specify/` tree and the tool call that reproduces the problem;
- the impact you observed.

You will receive an acknowledgment within 7 days. Once a fix is available, the issue will be disclosed in the changelog, with credit to you unless you prefer otherwise.
