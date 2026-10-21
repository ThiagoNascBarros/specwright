# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base do Specwright: repositório com `main`, a estrutura do TRD §3, o build, um servidor MCP stdio sem tools, provado por um teste de contrato, e o CI verde.

**Architecture:** `src/index.ts` cria um `McpServer` do SDK v2 sem tools e o conecta a um `StdioServerTransport`. O teste de contrato executa `dist/index.js` como processo filho, pelo `StdioClientTransport`, e inspeciona o handshake.

**Tech Stack:** Node ≥ 22, TypeScript (strict, ESM), `@modelcontextprotocol/server` e `@modelcontextprotocol/client` 2.3.x, Vitest, GitHub Actions.

**Spec:** `.specwright/specs/project-foundation.md`

## Global Constraints

(Copiadas do TRD §2.)
- Node.js **≥ 22**; TypeScript em modo `strict`; ESM (`"type": "module"`).
- Dependências de runtime permitidas: `@modelcontextprotocol/server` (v2), `zod` (v4), `yaml` (v2). Qualquer outra exige ADR.
- Dependências de desenvolvimento: `typescript`, `vitest`, `@types/node` e `@modelcontextprotocol/client` (v2, usado no teste de contrato).
- Proibido no servidor: rede, `child_process`, chamada a LLM, escrita fora de `SPECWRIGHT_DIR`.
- Nomes de tool em `snake_case` e em inglês. Mensagens de erro em inglês, com `code` estável.
- Toda tool devolve JSON compacto em um único bloco de texto.
- No total, até 10 tools (PRD NFR-2).

Fatos do SDK verificados no pacote 2.3.1:
- **Imports.** `McpServer` vem de `@modelcontextprotocol/server`, e `StdioServerTransport` de `@modelcontextprotocol/server/stdio`. `Client` vem de `@modelcontextprotocol/client`, e `StdioClientTransport` de `@modelcontextprotocol/client/stdio`.
- **Capability `tools`.** O `McpServer` só anuncia `tools` quando ela é passada em `capabilities`. Isso fixa o AC-5: a asserção é `client.getServerCapabilities()?.tools === undefined`.
- **Tipos do Node.** No TypeScript ≥ 6, o `tsconfig` precisa de `"types": ["node"]`.

## Review Focus

1. **stdout poluído.** Qualquer `console.log` no servidor corrompe o JSON-RPC sobre stdio. Toda saída de diagnóstico vai para `stderr`. Teste: o handshake do contrato falharia se houvesse lixo no stdout (coberto pelo próprio AC-4).
2. **Versão lida errada em `dist/`.** O `package.json` é lido por caminho relativo ao módulo (`new URL('../package.json', import.meta.url)`), nunca ao `cwd`. Teste: o contrato executa o servidor com `cwd` igual a `tests/`, não à raiz.
3. **Encerramento.** O servidor termina quando o cliente fecha o stdin, em vez de ficar órfão. Teste: depois de `client.close()`, o processo filho sai em menos de 2 s.
4. **Caminho do binário.** O teste resolve `dist/index.js` a partir de `import.meta.url`, e não por caminho relativo ao `cwd`, para rodar igual no CI.
5. **Fixtures com CRLF.** A regra `tests/fixtures/** -text` precisa existir antes do primeiro fixture. Verificação: `git check-attr text tests/fixtures/x` imprime `unset`.

---

### Task 1: `main` inicial com README vazio (AC-7, base do AC-9)

**Files:**
- Create: `README.md` (0 bytes)

- [ ] **Step 1: Criar o commit inicial em `main` e publicar**

O repositório está vazio. A branch atual, `spec/project-foundation`, ainda não tem commits, então a ref dela ainda não existe. `docs/` e `.specwright/` ficam no diretório de trabalho, sem ser rastreados.

```bash
git switch --orphan main
: > README.md
git add README.md
git commit -m "chore: initial commit"
git push -u origin main
git switch -c spec/project-foundation
```

- [ ] **Step 2: Verificar**

Run: `git log --oneline main && wc -c README.md && gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
Expected: um commit `chore: initial commit`, `0 README.md` e `main`.

---

### Task 2: Toolchain + servidor stdio provado por teste de contrato (AC-2, AC-3, AC-4, AC-5)

**Files:**
- Create: `package.json`, `package-lock.json` (gerado), `tsconfig.json`, `.gitignore`, `.gitattributes`, `.nvmrc`
- Create: `src/index.ts`
- Test: `tests/contract/server.test.ts`

**Interfaces:**
- Produces: o executável `dist/index.js`, que fala MCP por stdio com `serverInfo = { name: "specwright", version: <package.json version> }` e não tem capabilities de tools. As specs seguintes registram tools em `src/index.ts`.

- [ ] **Step 1: Toolchain**

O `package.json` tem:
- `name: "specwright-mcp"`, `version: "0.0.0"`, `private: true`, `type: "module"`, `engines.node: ">=22"` e `bin: { "specwright-mcp": "dist/index.js" }`;
- os scripts `build: "tsc"`, `typecheck: "tsc --noEmit"`, `pretest: "npm run build"` e `test: "vitest run"`.

Instalação:

```bash
npm i @modelcontextprotocol/server@^2.3 zod@^4 yaml@^2
npm i -D typescript vitest @types/node @modelcontextprotocol/client@^2.3
```

O `tsconfig.json` tem:
- `strict: true`, `target: "ES2023"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`;
- `rootDir: "src"`, `outDir: "dist"`, `types: ["node"]`, `skipLibCheck: true`;
- `include: ["src"]`.

Os testes ficam fora do `tsc`, e o Vitest os transpila.

Arquivos de apoio:
- `.nvmrc`: `22`.
- `.gitignore`: `node_modules/`, `dist/`, `coverage/` e `*.tmp`.
- `.gitattributes`: `* text=auto eol=lf` e `tests/fixtures/** -text`.

- [ ] **Step 2: Escrever o teste de contrato que falha**

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

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL. O `tsc` não encontra entradas (`src/index.ts` ainda não existe), ou o teste falha ao executar `dist/index.js`.

- [ ] **Step 4: Implementar `src/index.ts`**

O arquivo:
- começa com `#!/usr/bin/env node`;
- lê `version` com `JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))`;
- cria `new McpServer({ name: 'specwright', version })` sem `capabilities`;
- faz `await server.connect(new StdioServerTransport())`.

Para os erros de inicialização, usa `console.error` e `process.exit(1)`. Nada pode escrever em stdout.

Se o teste de encerramento falhar porque o processo não sai sozinho, registre `process.stdin.on('close', () => process.exit(0))`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test && npm run typecheck && head -1 dist/index.js`
Expected: 3 testes passando, typecheck com código 0 e a linha `#!/usr/bin/env node`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .gitattributes .nvmrc src/index.ts tests/contract/server.test.ts
git commit -m "feat: bootstrap stdio MCP server with contract test"
```

---

### Task 3: Estrutura de pastas, CLAUDE.md e documentação (AC-6)

**Files:**
- Create: `src/storage/.gitkeep`, `src/specs/.gitkeep`, `src/memory/.gitkeep`, `src/context/.gitkeep`
- Create: `tests/fixtures/.gitkeep`, `.specwright/decisions/.gitkeep`, `docs/superpowers/plans/` (este plano já está nela)
- Create: `CLAUDE.md`
- Add: `docs/**`, `.specwright/specs/project-foundation.md`

- [ ] **Step 1: Criar as pastas com `.gitkeep`** e escrever o `CLAUDE.md` (até 40 linhas). Ele contém:
  - os caminhos `docs/01-prd.md`, `docs/02-trd.md`, `docs/03-roadmap.md` e `docs/adr/`;
  - a tabela "Ciclo por spec" do Roadmap, por referência;
  - a regra "TDD obrigatório: todo `AC-n` tem teste que cita o id e que falhou primeiro";
  - os comandos `npm run typecheck`, `npm test` e `npm run build`;
  - a frase "Restrições globais: TRD §2".

- [ ] **Step 2: Verificar a estrutura e as dependências**

```bash
for p in .github/workflows .specwright/specs/project-foundation.md .specwright/decisions/.gitkeep docs/superpowers/plans src/index.ts src/storage/.gitkeep src/specs/.gitkeep src/memory/.gitkeep src/context/.gitkeep tests/contract/server.test.ts tests/fixtures/.gitkeep CLAUDE.md README.md package-lock.json tsconfig.json .gitignore .gitattributes .nvmrc; do test -e "$p" || echo "MISSING $p"; done
node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies).sort().join(','),'|',Object.keys(p.devDependencies).sort().join(','))"
git check-attr text tests/fixtures/x
```

Expected:
- nenhum `MISSING`, exceto `.github/workflows`, que nasce na Task 4;
- a linha `@modelcontextprotocol/server,yaml,zod | @modelcontextprotocol/client,@types/node,typescript,vitest`;
- `tests/fixtures/x: text: unset`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs .specwright src/*/.gitkeep tests/fixtures/.gitkeep
git commit -m "docs: add PRD, TRD, roadmap, ADRs, foundation spec and project layout"
```

---

### Task 4: CI, PR e merge (AC-8, AC-9)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Escrever o workflow.**
  - Gatilhos: `on: push` e `pull_request` para `branches: [main]`.
  - Job `test` em `ubuntu-latest`, com matriz `node: [22, 24]`.
  - Passos: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: ${{ matrix.node }}`, `cache: npm`), `npm ci`, `npm run typecheck` e `npm test`.

- [ ] **Step 2: Commit, push e abrir a PR**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck and test on Node 22 and 24"
git push -u origin spec/project-foundation
gh pr create --base main --title "spec: project-foundation" --body "Implementa .specwright/specs/project-foundation.md"
```

- [ ] **Step 3: Verificar o CI**

Run: `gh pr checks --watch`
Expected: `test (22)` e `test (24)` com `pass`.

- [ ] **Step 4: Fechar a spec (Roadmap etapa 5).** Isto acontece depois da verificação, com o skill `superpowers:finishing-a-development-branch`:
  - na spec, marcar os ACs 2 a 9 com `[x]` e mudar `status: done`;
  - no Roadmap, marcar a spec 1 com `[x]`;
  - fazer o merge da PR, após o seu OK.
