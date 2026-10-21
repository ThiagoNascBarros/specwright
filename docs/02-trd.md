---
id: TRD-001
title: Specwright — Technical Requirements Document
status: draft
version: 0.2
implements: PRD-001
---

# TRD-001 — Specwright

Responde **como** o [PRD-001](01-prd.md) será construído. As decisões, com as alternativas consideradas, estão nos ADRs em [`adr/`](adr/). As specs de desenvolvimento e os planos de implementação seguem o [Roadmap](03-roadmap.md).

## 1. Visão técnica

Servidor MCP em TypeScript, transporte **stdio**, sobre o SDK oficial v2 (`@modelcontextprotocol/server`) ([ADR-0002](adr/0002-typescript.md)). Não usa LLM ([ADR-0003](adr/0003-sem-llm-no-servidor.md)) nem banco ([ADR-0004](adr/0004-armazenamento-em-markdown.md)). Todo o estado é Markdown em `.specwright/`, dentro do repositório do projeto-alvo, **relido a cada chamada**: não existe índice persistente nem cache.

```
Cliente MCP (agente)
        │ stdio / JSON-RPC
        ▼
   src/index.ts ── registra as tools de cada módulo
        │
   ┌────┼──────────────┐
 specs/ memory/       context/     (módulos independentes)
   └────┼──────────────┘
        ▼
    storage/  ── única camada que toca o disco
        ▼
 .specwright/{config.json, specs/, decisions/, memory/}
```

## 2. Restrições globais

Todo plano de implementação copia esta lista literalmente para a seção *Global Constraints*.

- Node.js **≥ 22** (o Node 20 saiu de LTS em 2026-04); TypeScript em modo `strict`; ESM (`"type": "module"`).
- Dependências de runtime permitidas: `@modelcontextprotocol/server` (v2), `zod` (v4), `yaml` (v2). Qualquer outra exige ADR.
- Dependências de desenvolvimento: `typescript`, `vitest`, `@types/node` e `@modelcontextprotocol/client` (v2, usado no teste de contrato). Sem linter na Fase 1: `tsc --noEmit` é o gate de tipos.
- Proibido no servidor: rede, `child_process`, chamada a LLM, escrita fora de `SPECWRIGHT_DIR`.
- Nomes de tool em `snake_case` e em inglês. Mensagens de erro em inglês, com `code` estável.
- Toda tool devolve JSON compacto em um único bloco de texto.
- No total, até 10 tools (PRD NFR-2).

## 3. Estrutura do código

```
src/
├── index.ts          # cria o servidor, carrega a config, registra as tools
├── config.ts         # resolve SPECWRIGHT_DIR e config.json
├── errors.ts         # SpecwrightError + códigos
├── storage/
│   ├── paths.ts      # guarda de caminho
│   ├── files.ts      # leitura, escrita atômica, criação exclusiva
│   └── markdown.ts   # frontmatter + divisão em seções
├── specs/            # parser de spec, tools de spec, parser de diff
├── memory/           # Fase 2
└── context/          # Fase 3
tests/                # espelha src/; fixtures em tests/fixtures/
```

Regras de dependência:
- `specs`, `memory` e `context` dependem só de `storage` e `errors`, e não dependem entre si.
- A exceção é `context`, que consome as funções públicas de `specs` e `memory`.
- `index.ts` é o único arquivo que conhece todos os módulos.
- Cada módulo exporta uma função `register(server, deps)` que registra as próprias tools.

## 4. Fluxo de dados

**Leitura** (ex.: `get_spec`)
1. O SDK valida a entrada com o schema zod da tool.
2. A tool resolve `specs/<spec_id>.md` por `storage/paths`. Como o id é igual ao nome do arquivo, não há busca.
3. `storage/markdown` separa o frontmatter das seções, e a tool recorta a seção pedida.
4. Se a resposta passar de `maxResponseChars`, ela é truncada com `truncated: true`.

**Escrita** (ex.: `set_criterion_status`)
1. Lê o arquivo bruto (bytes).
2. Localiza a linha do `AC-n` e troca apenas o caractere do checkbox.
3. Grava num arquivo temporário na mesma pasta e faz `rename` (operação atômica).
4. Devolve o novo estado, recalculado a partir do texto gravado.

Leitura, edição e gravação acontecem dentro da mesma chamada. Por isso não há estado em memória que possa ficar desatualizado entre chamadas.

## 5. Armazenamento

Raiz: `SPECWRIGHT_DIR`.
- Caminho relativo é resolvido contra `process.cwd()` do servidor. O padrão é `.specwright`.
- O README instrui a usar caminho absoluto quando o cliente não iniciar o servidor na raiz do projeto.

```
.specwright/
├── config.json       # opcional
├── specs/            # <spec-id>.md
├── decisions/        # NNNN-<slug>.md (criada sob demanda por log_decision)
└── memory/           # <slug>.md (Fase 2)
```

`config.json` é opcional, e todos os campos têm padrão:

```json
{ "maxResponseChars": 20000 }
```

Campos desconhecidos são ignorados. O versionamento do `config.json` fica para depois (PRD Q3): a ausência de versão significa v1.

### 5.1 Garantias do `storage/`
- **Guarda de caminho (NFR-6).** Todo caminho é resolvido com `realpath` e precisa estar dentro da raiz. Para arquivo novo, o `realpath` é feito no diretório pai. Caso contrário, o erro é `PATH_OUTSIDE_ROOT`. Isso cobre `..`, caminhos absolutos e symlinks.
- **Escrita atômica (NFR-5).** Grava em temporário `.<nome>.<pid>.tmp` na mesma pasta e faz `rename`.
- **Edição mínima (NFR-5).** Só a linha alvo muda. O resto do arquivo é preservado byte a byte, incluindo fim de linha (LF/CRLF) e BOM.
- **Criação exclusiva.** Arquivos novos (decisões, memórias) usam a flag `wx`. Em colisão de nome, o próximo número é tentado, até 5 vezes, e depois o erro é `INTERNAL`.
- **Sem detecção de conflito entre processos.** A premissa é um servidor por projeto, e a janela de corrida fica dentro de uma única chamada. Edições concorrentes do usuário aparecem no diff do Git (PRD N5).

## 6. Formatos

### 6.1 Spec (`specs/<id>.md`)

```markdown
---
id: auth-login            # obrigatório; ^[a-z0-9][a-z0-9-]*$; igual ao nome do arquivo
title: Login com e-mail   # obrigatório
status: in-progress       # draft | in-progress | done | deprecated
---

## Contexto
...
## Critérios de aceite
- [x] AC-1: ...
- [ ] AC-2: ...
## Fora de escopo
- ...
```

Regras de parsing:
- **Frontmatter.** É o bloco entre as linhas `---` do início do arquivo, lido com `yaml.parse`. O servidor **nunca reserializa** o frontmatter de uma spec existente.
- **Seções.**
  - Uma seção vai de um cabeçalho `##` até o próximo `##`, e os `###` internos fazem parte dela.
  - O texto antes do primeiro `##` não pertence a nenhuma seção.
  - A chave da seção é o texto do cabeçalho em minúsculas, sem acentos, com espaços trocados por `-`.
  - `get_spec(section)` aceita a chave ou o texto original.
- **Aliases fixos.**
  - `criterios-de-aceite` = `acceptance-criteria`.
  - `fora-de-escopo` = `out-of-scope`.
- **Critérios.**
  - São as linhas da seção de critérios no formato `^\s*[-*] \[( |x|X)\] (AC-\d+):\s*(.+)$`.
  - Os ids são únicos por spec e estáveis. O servidor nunca renumera.
  - Linhas de checkbox sem `AC-n` são ignoradas e geram issue.
- **Fora de escopo.** São os itens de lista da seção correspondente.
- **Spec inválida.** Uma spec inválida não derruba as outras: aparece em `list_specs` com `valid: false` e `issues: string[]`. Ela é inválida quando:
  - falta o frontmatter, `id` ou `title`;
  - o `id` é diferente do nome do arquivo;
  - o `status` está fora do enum;
  - há `AC` duplicado;
  - há cabeçalho `##` duplicado.

  Escrita numa spec inválida é recusada com `INVALID_SPEC`.

### 6.2 Decisão (`decisions/NNNN-<slug>.md`)

Arquivo criado por `log_decision`, com frontmatter gerado por `yaml.stringify` (valores escapados):

```markdown
---
id: "0007"              # string, para o YAML não ler como número
spec_id: auth-login
title: Bloqueio por conta, não por IP
date: 2026-10-21        # data local de criação
status: accepted        # accepted | superseded (superseded é editado por humanos)
---
## Contexto
## Decisão
## Consequências
```

- `NNNN` é o maior número existente + 1, com 4 dígitos.
- O `slug` vem do título: sem acentos, minúsculas, `[a-z0-9-]`, no máximo 50 caracteres.
- Seções vazias (`context` ou `consequences` ausentes) são omitidas.

## 7. Contrato das tools

Convenções:
- A entrada é validada com zod.
- Listagens nunca incluem o corpo.
- Erros saem como `isError: true` com `{ code, message, hint }`.
- A descrição de cada tool tem no máximo 2 frases e diz **quando** usá-la.

### Fase 1

| Tool | Entrada | Saída |
|---|---|---|
| `list_specs` | `status?` | `[{ id, title, status, valid, issues?, criteria: {done, total} }]` |
| `get_spec` | `spec_id`, `section?` | `{ id, title, status, section?, content, truncated? }` |
| `list_open_requirements` | `spec_id?` | `[{ spec_id, ac_id, text }]` (specs inválidas ficam de fora) |
| `set_criterion_status` | `spec_id`, `ac_id`, `done: boolean` | `{ spec_id, ac_id, done, changed, criteria: {done, total} }` |
| `log_decision` | `spec_id`, `title`, `decision`, `context?`, `consequences?` | `{ id, path }` |
| `check_task_against_spec` | `spec_id`, `diff` | `{ spec_id, open_criteria, met_criteria, out_of_scope, diff_summary }` |

- **`get_spec` sem `section`** devolve o corpo inteiro, sem o frontmatter.
- **`set_criterion_status`** é idempotente: se o estado pedido já for o atual, devolve `changed: false` e não grava.
- **`log_decision`** valida que a spec existe (`SPEC_NOT_FOUND`) e cria `decisions/` se a pasta faltar.
- **`check_task_against_spec`** não julga nada.
  - Faz parse do diff unificado em texto, sem depender de `git`, e devolve `diff_summary = { files: [{ path, added, removed, hunks }], totals: { files, added, removed } }`.
  - Devolve também os critérios abertos e atendidos e os itens de "Fora de escopo".
  - Diff vazio, ou sem nenhum cabeçalho `diff --git`/`---`/`+++` reconhecível, gera `INVALID_DIFF`.

### Fase 2 (detalhada na spec correspondente)
- `save_memory(type, title, body, tags?)` grava `memory/<slug>.md`. `type` ∈ `convention | learning | pitfall`.
- `search_memory(query, type?, limit?)` faz busca textual sobre memórias e decisões. O ranking pesa título > tags > corpo, e a tool devolve trechos.
- `list_decisions(spec_id?, from?, to?)`.

### Fase 3 (detalhada na spec correspondente)
- `pack_context(task, budget_tokens?)` seleciona seções de spec e memórias por correspondência de termos. Lista arquivos candidatos por nome e caminho e corta tudo até o orçamento.
- A estimativa de tokens é `ceil(chars / 4)`, até que se decida a PRD Q1.

## 8. Erros

| Código | Quando |
|---|---|
| `NOT_INITIALIZED` | a raiz `SPECWRIGHT_DIR` não existe (hint: criar `.specwright/specs/`) |
| `SPEC_NOT_FOUND` | `spec_id` inexistente |
| `SECTION_NOT_FOUND` | a seção não existe (hint: lista as chaves disponíveis) |
| `CRITERION_NOT_FOUND` | o `ac_id` não existe na spec |
| `INVALID_SPEC` | escrita numa spec inválida (hint: lista as `issues`) |
| `INVALID_DIFF` | diff vazio ou fora do formato unificado |
| `PATH_OUTSIDE_ROOT` | o caminho resolve fora da raiz |
| `INTERNAL` | erro de I/O inesperado; a mensagem não expõe caminho absoluto |

Entrada que viola o schema zod é rejeitada pelo próprio SDK, antes de chegar à tool.

## 9. Casos de borda

Esta seção é a fonte da *Review Focus* de cada plano. O plano escolhe os casos que tocam a sua spec e adiciona um teste para cada um.

- Arquivos com CRLF, com BOM UTF-8, vazios ou só com frontmatter.
- Cabeçalhos com acento, emoji ou espaços duplos; seção pedida com acento (`critérios de aceite`).
- `spec_id` com `../`, maiúsculas, barra ou caminho absoluto.
- Symlink dentro de `specs/` apontando para fora da raiz.
- Spec sem a seção de critérios (`criteria: {done: 0, total: 0}`, sem erro).
- `AC-10` e `AC-1` na mesma spec (o match tem de ser exato, não por prefixo).
- Diff com arquivo renomeado, arquivo binário, arquivo novo ou apagado (`/dev/null`) e hunks múltiplos.
- Diff enorme: o `diff_summary` continua pequeno, porque nunca inclui o conteúdo das linhas.
- Caminho no Windows (`\`) na guarda de caminho.

## 10. Estratégia de testes

O desenvolvimento segue **TDD**: cada `AC-n` de uma spec ganha um teste, escrito antes do código, que precisa falhar pelo motivo esperado antes da implementação. O nome do teste cita o id (`AC-3: ...`).

- **Unitário:** guarda de caminho, escrita atômica, frontmatter e seções, extração de critérios, parser de diff.
- **Integração:** cada tool roda contra uma cópia de `tests/fixtures/<cenário>/` num `tmpdir`. Os testes não leem o `.specwright/` real do repositório, porque ele muda conforme os critérios são marcados.
- **Contrato MCP:** um teste sobe `dist/index.js` via stdio com o cliente do SDK e chama cada tool registrada.
- **NFR mensuráveis em teste:**
  - NFR-3: o JSON de `tools/list` tem no máximo 12.000 caracteres.
  - NFR-7: um fixture gerado com 500 specs é lido no tempo-alvo.
- **Dogfooding:** é um teste manual de fumaça, ao fim de cada spec, com o próprio Specwright apontando para o repositório. Não substitui a suíte.
- **Gate de conclusão:** `npm test` (a suíte inteira) e `tsc --noEmit` verdes, com a saída anexada ao relatório da spec.

## 11. Build e distribuição

- `tsc` gera `dist/`. A entrada é `dist/index.js`, e o campo `bin` permite usar via `npx`.
- O pacote npm se chamará provisoriamente `specwright-mcp`. O nome estava livre em 2026-10-21; revalidar antes de publicar.
- Uso previsto: `claude mcp add specwright -- npx -y specwright-mcp`, com `SPECWRIGHT_DIR` opcional.

## 12. Segurança

- O servidor não usa rede, não executa comandos e não lê fora da raiz (§2, §5.1).
- O conteúdo de specs e memórias é dado, e o servidor nunca o interpreta como instrução.
- O `spec_id` é restrito por regex no schema, antes de qualquer acesso a disco.

## 13. Rastreabilidade

| Requisito | Componente | Spec (Roadmap) |
|---|---|---|
| NFR-9, NFR-10 (base) | `package.json`, `src/index.ts`, CI | 1 `project-foundation` |
| FR-1, FR-2, FR-3, NFR-4, NFR-6, NFR-8 | `storage/paths`, `storage/markdown`, `specs/` | 2 `spec-reading` |
| FR-4, FR-6, NFR-5 | `storage/files`, `specs/` | 3 `acceptance-criteria` |
| FR-7 | `specs/` | 4 `decision-log` |
| FR-5 | `specs/diff` | 5 `check-task` |
| NFR-3, NFR-7 | testes transversais | 2 (base) e revisados em 5 |
| FR-8 a FR-10 | `memory/` | Fase 2 |
| FR-11 | `context/` | Fase 3 |

## 14. Questões em aberto

- **Q1 (decidir na spec 5).** Como o diff chega ao `check_task_against_spec`?
  - Hoje o agente passa o diff como argumento, o que custa os tokens do diff na chamada (tensão com a meta G3).
  - A alternativa é aceitar `base_ref` e o servidor ler o diff do Git. Isso exige `child_process` (proibido em §2) ou uma biblioteca de Git (nova dependência).
  - Recomendação provisória: manter o argumento e medir o custo no dogfooding.
