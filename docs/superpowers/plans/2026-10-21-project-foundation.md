# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Specwright base: a repository with `main`, the structure of TRD §3, the build, a stdio MCP server with no tools, proven by a contract test, and green CI.

**Architecture:** `src/index.ts` creates an SDK v2 `McpServer` with no tools and connects it to a `StdioServerTransport`. The contract test runs `dist/index.js` as a child process, through `StdioClientTransport`, and inspects the handshake.

**Tech Stack:** Node ≥ 22.12, TypeScript (strict, ESM), `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.3.x, Vitest, GitHub Actions.

**Spec:** `.specwright/specs/project-foundation.md`

## Global Constraints

(Copied from TRD §2.)
- Node.js **≥ 22.12**; TypeScript in `strict` mode; ESM (`"type": "module"`).
- Allowed runtime dependencies: `@modelcontextprotocol/server` (v2), `zod` (v4), `yaml` (v2). Any other requires an ADR.
- Development dependencies: `typescript`, `vitest`, `@types/node` and `@modelcontextprotocol/client` (v2, used in the contract test).
- Forbidden in the server: network, `child_process`, LLM calls, writes outside `SPECWRIGHT_DIR`.
- Tool names in `snake_case` and in English. Error messages in English, with a stable `code`.
- Every tool returns compact JSON in a single text block.
- In total, up to 10 tools (PRD NFR-2).

SDK facts verified in package 2.3.1:
- **Imports.** `McpServer` comes from `@modelcontextprotocol/server`, and `StdioServerTransport` from `@modelcontextprotocol/server/stdio`. `Client` comes from `@modelcontextprotocol/client`, and `StdioClientTransport` from `@modelcontextprotocol/client/stdio`.
- **`tools` capability.** `McpServer` announces `tools` only when it is passed in `capabilities`. This fixes AC-5: the assertion is `client.getServerCapabilities()?.tools === undefined`.
- **Node types.** In TypeScript ≥ 6, the `tsconfig` needs `"types": ["node"]`.

## Review Focus

1. **Polluted stdout.** Any `console.log` in the server corrupts JSON-RPC over stdio. All diagnostic output goes to `stderr`. Test: the contract handshake would fail if there were garbage on stdout (covered by AC-4 itself).
2. **Wrong version read from `dist/`.** `package.json` is read via a path relative to the module (`new URL('../package.json', import.meta.url)`), never relative to the `cwd`. Test: the contract runs the server with `cwd` equal to `tests/`, not the root.
3. **Shutdown.** The server ends when the client closes stdin, instead of becoming orphaned. Test: after `client.close()`, the child process exits in less than 2 s.
4. **Binary path.** The test resolves `dist/index.js` from `import.meta.url`, not from a path relative to the `cwd`, so that it runs the same way in CI.
5. **CRLF fixtures.** The rule `tests/fixtures/** -text` must exist before the first fixture. Verification: `git check-attr text tests/fixtures/x` prints `unset`.

---

### Task 1: Initial `main` with empty README (AC-7, base of AC-9)

**Files:**
- Create: `README.md` (0 bytes)

- [ ] **Step 1: Create the initial commit on `main` and publish it**

The repository is empty. The current branch, `spec/project-foundation`, does not have any commits yet, so its ref does not exist. `docs/` and `.specwright/` stay in the working directory, untracked.

```bash
git switch --orphan main
: > README.md
git add README.md
git commit -m "chore: initial commit"
git push -u origin main
git switch -c spec/project-foundation
```

- [ ] **Step 2: Verify**

Run: `git log --oneline main && wc -c README.md && gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
Expected: one commit `chore: initial commit`, `0 README.md` and `main`.

---

### Task 2: Toolchain + stdio server proven by a contract test (AC-2, AC-3, AC-4, AC-5)

**Files:**
- Create: `package.json`, `package-lock.json` (generated), `tsconfig.json`, `.gitignore`, `.gitattributes`, `.nvmrc`
- Create: `src/index.ts`
- Test: `tests/contract/server.test.ts`

**Interfaces:**
- Produces: the executable `dist/index.js`, which speaks MCP over stdio with `serverInfo = { name: "specwright", version: <package.json version> }` and has no tools capabilities. The following specs register tools in `src/index.ts`.

- [ ] **Step 1: Toolchain**

`package.json` has:
- `name: "specwright-mcp"`, `version: "0.0.0"`, `private: true`, `type: "module"`, `engines.node: ">=22"` and `bin: { "specwright-mcp": "dist/index.js" }`;
- the scripts `build: "tsc"`, `typecheck: "tsc --noEmit"`, `pretest: "npm run build"` and `test: "vitest run"`.

Installation:

```bash
npm i @modelcontextprotocol/server@^2.3 zod@^4 yaml@^2
npm i -D typescript vitest @types/node @modelcontextprotocol/client@^2.3
```

`tsconfig.json` has:
- `strict: true`, `target: "ES2023"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`;
- `rootDir: "src"`, `outDir: "dist"`, `types: ["node"]`, `skipLibCheck: true`;
- `include: ["src"]`.

Tests stay outside `tsc`, and Vitest transpiles them.

Support files:
- `.nvmrc`: `22`.
- `.gitignore`: `node_modules/`, `dist/`, `coverage/` and `*.tmp`.
- `.gitattributes`: `* text=auto eol=lf` and `tests/fixtures/** -text`.

- [ ] **Step 2: Write the contract test that fails**

```ts
// tests/contract/server.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

let client: Client | undefined;
afterEach(async () => { await client?.close(); client = undefined; });

async function connect() {
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], cwd: `${root}tests` });
  client = new Client({ name: 'contract-test', version: '0.0.0' });
  await client.connect(transport);
  return { client, transport };
}

describe('project-foundation contract', () => {
  it('AC-4: reports serverInfo name "specwright" and package.json version', async () => {
    const { client } = await connect();
    expect(client.getServerVersion()).toMatchObject({ name: 'specwright', version: pkg.version });
  });

  it('AC-5: exposes no tools capability', async () => {
    const { client } = await connect();
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
  });

  it('exits after the client closes stdin', async () => {
    const { client, transport } = await connect();
    const pid = transport.pid!;
    await client.close();
    await new Promise((r) => setTimeout(r, 2000));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
```

- [ ] **Step 3: Run and see it fail**

Run: `npm test`
Expected: FAIL. `tsc` finds no inputs (`src/index.ts` does not exist yet), or the test fails when executing `dist/index.js`.

- [ ] **Step 4: Implement `src/index.ts`**

The file:
- starts with `#!/usr/bin/env node`;
- reads `version` with `JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))`;
- creates `new McpServer({ name: 'specwright', version })` without `capabilities`;
- does `await server.connect(new StdioServerTransport())`.

For startup errors, it uses `console.error` and `process.exit(1)`. Nothing may write to stdout.

If the shutdown test fails because the process does not exit on its own, register `process.stdin.on('close', () => process.exit(0))`.

- [ ] **Step 5: Run and see it pass**

Run: `npm test && npm run typecheck && head -1 dist/index.js`
Expected: 3 tests passing, typecheck with exit code 0, and the line `#!/usr/bin/env node`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .gitattributes .nvmrc src/index.ts tests/contract/server.test.ts
git commit -m "feat: bootstrap stdio MCP server with contract test"
```

---

### Task 3: Folder structure, CLAUDE.md and documentation (AC-6)

**Files:**
- Create: `src/storage/.gitkeep`, `src/specs/.gitkeep`, `src/memory/.gitkeep`, `src/context/.gitkeep`
- Create: `tests/fixtures/.gitkeep`, `.specwright/decisions/.gitkeep`, `docs/superpowers/plans/` (this plan is already in it)
- Create: `CLAUDE.md`
- Add: `docs/**`, `.specwright/specs/project-foundation.md`

- [ ] **Step 1: Create the folders with `.gitkeep`** and write `CLAUDE.md` (up to 40 lines). It contains:
  - the paths `docs/01-prd.md`, `docs/02-trd.md`, `docs/03-roadmap.md` and `docs/adr/`;
  - the "Per-spec cycle" table of the Roadmap, by reference;
  - the rule "TDD mandatory: every `AC-n` has a test that cites the id and that failed first";
  - the commands `npm run typecheck`, `npm test` and `npm run build`;
  - the phrase "Global constraints: TRD §2".

- [ ] **Step 2: Verify the structure and dependencies**

```bash
for p in .github/workflows .specwright/specs/project-foundation.md .specwright/decisions/.gitkeep docs/superpowers/plans src/index.ts src/storage/.gitkeep src/specs/.gitkeep src/memory/.gitkeep src/context/.gitkeep tests/contract/server.test.ts tests/fixtures/.gitkeep CLAUDE.md README.md package-lock.json tsconfig.json .gitignore .gitattributes .nvmrc; do test -e "$p" || echo "MISSING $p"; done
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies).sort().join(','),'|',Object.keys(p.devDependencies).sort().join(','))"
git check-attr text tests/fixtures/x
```

Expected:
- no `MISSING`, except `.github/workflows`, which is created in Task 4;
- the line `@modelcontextprotocol/server,yaml,zod | @modelcontextprotocol/client,@types/node,typescript,vitest`;
- `tests/fixtures/x: text: unset`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs .specwright src/*/.gitkeep tests/fixtures/.gitkeep
git commit -m "docs: add PRD, TRD, roadmap, ADRs, foundation spec and project layout"
```

---

### Task 4: CI, PR and merge (AC-8, AC-9)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow.**
  - Triggers: `on: push` and `pull_request` for `branches: [main]`.
  - Job `test` on `ubuntu-latest`, with matrix `node: [22, 24]`.
  - Steps: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: ${{ matrix.node }}`, `cache: npm`), `npm ci`, `npm run typecheck` and `npm test`.

- [ ] **Step 2: Commit, push and open the PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck and test on Node 22 and 24"
git push -u origin spec/project-foundation
gh pr create --base main --title "spec: project-foundation" --body "Implements .specwright/specs/project-foundation.md"
```

- [ ] **Step 3: Verify the CI**

Run: `gh pr checks --watch`
Expected: `test (22)` and `test (24)` with `pass`.

- [ ] **Step 4: Close the spec (Roadmap step 5).** This happens after verification, with the skill `superpowers:finishing-a-development-branch`:
  - in the spec, check off ACs 2 to 9 with `[x]` and change `status: done`;
  - in the Roadmap, check off spec 1 with `[x]`;
  - merge the PR, after your OK.

---

## Deviations

Changes made during implementation that differ from the steps above:

- **(a) `@types/node` pinned to `^22`** instead of the latest (26), so the types match the Node floor.
- **(b) `engines.node` raised to `>=22.12`**, the floor required by Vitest 5 (`^22.12`). This applies to the Node floor everywhere in the docs.
- **(c) Typecheck covers tests too.** `npm run typecheck` is now `tsc --noEmit && tsc -p tests`, using `tests/tsconfig.json`, instead of `tsc --noEmit` on `src` only.
