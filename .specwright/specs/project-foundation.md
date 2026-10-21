---
id: project-foundation
title: Fundação do projeto (repositório, estrutura, build, CI)
status: draft
---

## Contexto
Primeira spec do [Roadmap](../../docs/03-roadmap.md). Ela cria a base sobre a qual as specs seguintes são desenvolvidas com TDD: o repositório, a estrutura de pastas do TRD §3, o build, o CI e um servidor MCP que sobe por stdio, ainda sem nenhuma tool. Requisitos atendidos: NFR-9 (portabilidade) e a base do NFR-10 (suíte de testes e gate de verificação).

## Requisitos
- Repositório privado `ThiagoNascBarros/specwright`, branch padrão `main`.
- Node.js ≥ 22 (`engines` no `package.json` e `.nvmrc` com `22`). TypeScript `strict`, ESM.
- Dependências exatamente as do TRD §2:
  - runtime: `@modelcontextprotocol/server`, `zod`, `yaml`;
  - desenvolvimento: `typescript`, `vitest`, `@types/node`, `@modelcontextprotocol/client`.
- `package.json`:
  - `name: specwright-mcp`, `private: true`, `bin: { "specwright-mcp": "dist/index.js" }`;
  - scripts `build` (`tsc`), `typecheck` (`tsc --noEmit`) e `test` (build seguido de `vitest run`).
- `src/index.ts` cria o servidor com `name: "specwright"` e `version` lida do `package.json`, conecta o transporte stdio e não registra tools. Começa com shebang `#!/usr/bin/env node`.
- Estrutura de pastas:

```
.github/workflows/ci.yml
.specwright/specs/            # esta spec
.specwright/decisions/.gitkeep
docs/                         # PRD, TRD, Roadmap, ADRs
docs/superpowers/plans/.gitkeep
src/index.ts
src/storage/.gitkeep
src/specs/.gitkeep
src/memory/.gitkeep
src/context/.gitkeep
tests/contract/server.test.ts
tests/fixtures/.gitkeep
CLAUDE.md
README.md                     # vazio
package.json  package-lock.json  tsconfig.json
.gitignore  .gitattributes  .nvmrc
```

- `.gitattributes`: `* text=auto eol=lf` e `tests/fixtures/** -text`. A segunda regra preserva CRLF e BOM nos fixtures (TRD §9).
- `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `*.tmp`.
- `CLAUDE.md` contém, em até 40 linhas:
  - onde estão PRD, TRD, Roadmap e ADRs;
  - o ciclo por spec do Roadmap;
  - TDD obrigatório;
  - os comandos `npm run typecheck`, `npm test` e `npm run build`;
  - as restrições globais do TRD §2, por referência, sem copiar o texto.
- CI (`ci.yml`): roda em `push` e `pull_request` para `main`, numa matriz Node `22` e `24`, com os passos `npm ci`, `npm run typecheck` e `npm test`.

## Critérios de aceite
- [x] AC-1: O repositório privado `ThiagoNascBarros/specwright` existe no GitHub
- [ ] AC-2: `npm ci && npm run build` termina com código 0 e gera `dist/index.js` começando com `#!/usr/bin/env node`
- [ ] AC-3: `npm run typecheck` termina com código 0, com `strict: true` no `tsconfig.json`
- [ ] AC-4: O teste de contrato inicia `node dist/index.js` via stdio com o cliente do SDK e recebe `serverInfo.name === "specwright"` e `serverInfo.version` igual ao `version` do `package.json`
- [ ] AC-5: O teste de contrato confirma que o servidor expõe zero tools: `listTools` devolve lista vazia, ou o servidor não anuncia a capability `tools`
- [ ] AC-6: Todas as pastas e arquivos listados em "Requisitos" existem, e o `package.json` declara exatamente as dependências do TRD §2
- [ ] AC-7: `README.md` existe com 0 bytes
- [ ] AC-8: O CI do GitHub Actions roda verde em Node 22 e 24 na PR desta spec
- [ ] AC-9: `main` recebe esta spec por PR, com merge feito após o CI verde. Como o repositório está vazio, `main` nasce de um commit inicial que contém só o `README.md` vazio, e a PR parte dele.

## Fora de escopo
- Tools MCP, `config.ts`, `errors.ts`, `storage/*` (spec 2 `spec-reading`)
- Conteúdo do README
- Licença (PRD Q2) e publicação no npm
- Proteção de branch, Dependabot e linter
- `.mcp.json` para dogfooding (entra na spec 2, quando houver tools)

## Notas
- O AC-1 foi executado antes da aprovação desta spec, a pedido do usuário. Está registrado como já atendido.
- O AC-5 aceita as duas formas porque o SDK v2 pode omitir a capability `tools` quando nenhuma tool está registrada. O plano fixa o comportamento real depois de verificá-lo.
