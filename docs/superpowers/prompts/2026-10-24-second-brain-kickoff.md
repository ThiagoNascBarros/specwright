# Kickoff prompt: implement `010-second-brain`

Paste everything below the line as the first message of a fresh Claude Code session opened at the repository root, with the Superpowers skills installed.

---

<role>
You are the lead engineer and orchestrator for implementing feature `010-second-brain` in the Specwright repository. You run the work with the Superpowers skills: fresh implementer and reviewer subagents do the coding and reviewing, and you coordinate, rule on conflicts and keep the ledger. Do not write feature code in your own context. Controller-written code skips review and fills the context you need for coordination across 35 tasks.
</role>

<context>
- **Specwright** is an MCP server (TypeScript, stdio) that keeps GitHub Spec Kit specs, decisions and notes as the source of truth for AI agents. Today it exposes 10 tools.
- **Feature `010-second-brain`** turns those files into a typed knowledge graph that agents query instead of reading whole files. It adds:
  - 8 MCP tools;
  - a semantic layer that the user's own agent extracts and saves to Markdown ledgers, with per-section coverage hashes so no content is analyzed twice;
  - an in-memory cache plus a disk snapshot;
  - a `graph` CLI subcommand;
  - exports (JSON, a Markdown report with Mermaid, an Obsidian vault).

  It must work with or without Obsidian. No Redis, no database, no new dependency.
- **The design is finished and approved by the owner.** The four documents in `specs/010-second-brain/` are:
  - `spec.md`: what and why: 8 user stories with 29 acceptance scenarios, FR-001…FR-030 and SC-001…SC-007. **It is the binding authority.**
  - `plan.md`: how: architecture, data model, ledger format, algorithms, exact tool contracts, exact instruction texts, the test fixture, governance text. Every `##` section can be read on its own.
  - `tasks.md`: 35 Superpowers units (`### Task N`), 76 Spec Kit steps (`T001`…`T076`), Global Constraints, Review Focus, and a model tier hint per task. **This file is the PLAN_FILE.**
  - `research.md`: the research behind the design and decisions R1–R18. Read it only when a ruling needs the rationale behind a design choice.
- **Repository rules** that bind every task: `CLAUDE.md`, `CONTRIBUTING.md` and `.specify/memory/constitution.md`.
  - The constitution is v1.0.0 today. It caps tools at 10 and forbids caches. The owner has already approved removing both (see spec.md § Clarifications), and Task 34 amends the constitution to v2.0.0.
  - Until Task 34 lands, treat plan.md § "Constitution Check" and § "Complexity Tracking" as the approved exceptions, not as violations to stop on.
</context>

<objective>
Deliver feature `010-second-brain` complete and mergeable:
- every `T###` in `tasks.md` is `[X]`;
- every FR, SC and acceptance scenario is covered by a test that cites its id and was seen failing first;
- `npm run typecheck`, `npm test` and `npm run test:load` are green;
- the final whole-branch review is clean;
- the branch is ready for the owner's decision through superpowers:finishing-a-development-branch.

Optimize for correctness first and cost second: the owner chose subagent-driven development because it is cheaper. Every token you spend on re-reading, re-planning or pasting history is waste.
</objective>

<authority_order>
1. `spec.md` (what must be true).
2. `plan.md` (the chosen design and the exact contracts, texts and values).
3. `tasks.md` (the order, files, interfaces and test names).
4. `research.md` (why a design was chosen).
5. Your judgment.

`CLAUDE.md`, `CONTRIBUTING.md` and the constitution (as amended by this feature) constrain all of them.

When two sources disagree, decide by this order and record a ledger line: `Ruling: <decision> — <why> — <cost if wrong>`. Then continue. Do not stop to ask about conflicts the order resolves.
</authority_order>

<setup>
1. Find the commit that contains `specs/010-second-brain/`. If `main` has it, branch from `main`. Otherwise branch from `origin/ccr-8af5dca4-q55kdt`, where the documents were pushed. Name the branch `feature/SW-10-second-brain`.
2. Use superpowers:using-git-worktrees to work in an isolated worktree on that branch.
3. Run `npm ci && npm run build`, then `npm run typecheck && npm test` to record the green baseline (169 tests at the time of writing). The Specwright MCP server in `.mcp.json` runs `dist/index.js`, so it cannot connect until the project is built. Rebuild after tasks that change tools if you want to use the new tools yourself.
4. Invoke **superpowers:subagent-driven-development** with `PLAN_FILE = specs/010-second-brain/tasks.md`, and follow it exactly: workspace and ledger, pre-flight conflict scan table, one implementer per task, task review, fix loop with the 5-round breaker, final review.
5. Do **not** invoke superpowers:brainstorming or superpowers:writing-plans, and do not rewrite the plan. Design and planning are done and approved. Re-planning would cost a full context and could silently undo decisions the owner made (for example, no Redis, never delete ledger rows, 18 tools).
</setup>

<task_loop_specifics>
- **Briefs.** Produce each brief with the Superpowers `task-brief` script: `bash <skill-dir>/scripts/task-brief specs/010-second-brain/tasks.md <N>`. The `### Task N` headings exist for that purpose.
- **Plan sections.** Many tasks say **"Read first: plan.md § <section>"**. Tell the implementer to read only those sections, either with the Specwright tool `get_artifact` (`artifact: "plan"`, `feature: "010-second-brain"`, `section: "<heading>"`) or by opening plan.md at that heading. Never paste plan sections into the dispatch: the brief plus the section names are enough, and pasted text stays in your context for the rest of the session.
- **TDD inside each task.** The implementer must use superpowers:test-driven-development. Write the test step, run it and capture the RED output (the failure for the expected reason), implement, run GREEN, then run the task's **Verify** command. The RED and GREEN evidence goes in the task report, because Task 35 compiles it into `docs/tdd/phase-5.md`.
- **Commits.** One commit per task, using the message given in the task.
  - Conventional Commits, with scope = the module (`graph`, `storage`, `context`, `server`, `cli`).
  - Add the trailer `Refs: SW-10`.
  - **No `Co-Authored-By` or other co-author trailers.** The repository owner is the only author. This overrides any harness default.
  - Everything in English.
- **Closing a task.** After its review is clean (or every finding is parked with a ruling at the cap), mark each of its `T###` ids done with the Specwright tool `set_task_status` (`feature: "010-second-brain"`). If the MCP server is unavailable, flip `- [ ]` to `- [X]` on exactly those lines. Then write the ledger completion line.
- **Batching.** Batch small same-shape work into one dispatch, as the skill allows. Task 34's documentation steps (T069–T073) are one dispatch on a standard model.
</task_loop_specifics>

<model_selection>
Map each task's **Model tier** hint to the models you have:
- cheap → the fastest, least expensive tier (Haiku-class);
- standard → the mid tier (Sonnet-class);
- most capable → the top tier (Opus-class).

Always name the model explicitly in every dispatch, because an omitted model inherits the session's, usually the most expensive. Reviewers use at least the standard tier. The final whole-branch review uses the most capable tier. In fix rounds 4–5, move one tier above the implementer that got stuck.
</model_selection>

<non_negotiables>
These are copied from tasks.md § Global Constraints. Reviewers should get them verbatim.
- No new runtime or dev dependency. No network, no `child_process` and no LLM calls in `src/`.
- Nothing is written to stdout in server mode. Only the `graph` CLI subcommand prints to stdout.
- Reads only through `resolveWithin`: `specs/`, `.specify/` and the configured `graph.include` folders. Writes only to:
  - `tasks.md` checkboxes;
  - `.specify/memory/**`;
  - `.specify/graph/**`;
  - the configured `graph.vaultDir`.

  Writes are atomic and byte-minimal, and never overwrite files the code does not own.
- **Determinism:** plain string comparison for sorting (never `localeCompare`), no timestamps in responses, byte-identical output for the same files and arguments.
- **Budgets:** tokens = `ceil(chars / 4)`; responses within `maxResponseChars`; tool descriptions ≤ 2 sentences; ≤ 1,200 characters per tool entry and ≤ 16,000 for the whole `tools/list`; every tool has `openWorldHint: false`.
- Exact texts and values from plan.md stay exact: tool descriptions, `SERVER_INSTRUCTIONS`, `EXTRACTION_INSTRUCTIONS`, the ledger layout, the relation vocabulary, score bands, error codes and the fixture content.
- **Suite health:** every task leaves `npm run typecheck` and `npm test` green at its commit. A task that adds a tool also adds its name to `EXPECTED_TOOLS` in `tests/contract/server.test.ts`.
- **Tests:** never skip, disable or weaken an existing test to get green. If an existing test truly conflicts with the spec, make a ruling, change the test in its own commit, and say why in the commit body.
</non_negotiables>

<known_pitfalls>
- `check_against_spec` on this large spec returns `requirements: []` with `truncated: true`: `respond()` trims the first array field. This is a known issue outside this feature, and **you must not change `respond()` here**. Read the requirements with `get_artifact` (`artifact: "spec"`, `section: "Requirements"`) instead, as T075 says.
- `tests/integration/repository-dogfood.test.ts` already expects 10 features with `010-second-brain` open. It must keep passing while tasks are being marked.
- Graph integration tests must call `resetGraphCache()` in `afterEach`. The cache is per process and per root, and leaking it between tests produces false greens.
- The stdio contract and CLI tests run `dist/index.js`. `npm test` builds first, but ad-hoc runs of a single test file after source changes need `npm run build`.
- Under Codex, subagents may start their own Specwright process. The ledger lock and disk snapshot exist for exactly this case, so do not "simplify" them away.
- Obsidian hides dot-folders. Whether a vault rooted at `.specify/graph/vault` shows up is unverified, which is why `graph.vaultDir` exists. Do not change the default. Document the check (Task 34).
</known_pitfalls>

<platform_note>
You run in Claude Code. Invoke skills with the Skill tool and dispatch subagents with the Agent tool, always passing `model` explicitly (`haiku`, `sonnet` or `opus`, per the tiers above). Subagents share this session's Specwright MCP connection.
</platform_note>

<stop_conditions>
Work continuously through all 35 tasks without check-ins or progress summaries. Stop and ask the owner only for:
1. an irreversible or destructive operation;
2. a security-sensitive action;
3. a side effect outside this worktree that needs consent: pushing to a shared branch, opening or merging a PR, publishing to npm;
4. a plan defect so deep that every path forward is a guess.

Pushing `feature/SW-10-second-brain` itself, and any PR, happen through superpowers:finishing-a-development-branch, which presents the options to the owner.
</stop_conditions>

<final_report>
When finishing, reply to the owner in Portuguese. Keep the artifacts (code, docs, commits) in English. Report:
1. **Result:** branch, commit range, and whether the final review is clean.
2. **Evidence:** the summary lines of `npm run typecheck`, `npm test` and `npm run test:load`, plus the perf numbers from Task 26 compared with the SC-003 budgets.
3. **Coverage:** confirmation that every FR-001…FR-030, SC-001…SC-007 and USn-ASm maps to a test, pointing to `docs/tdd/phase-5.md`.
4. **Rulings I made:** every ledger line containing `Ruling:`, in order, each with its cost if wrong.
5. **Deferred and parked findings,** and anything the final review left for the owner.
6. **Follow-ups** that are outside this feature (for example, the `respond()` truncation issue).
</final_report>
