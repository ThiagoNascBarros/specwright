# ADR-0004 — Armazenamento em Markdown, sem banco

- **Status:** aceita
- **Data:** 2026-10-21

## Contexto
Specs, decisões e memórias precisam ser lidas por humanos e agentes, versionadas e revisadas junto ao código.

## Decisão
Todo estado é **Markdown com frontmatter YAML** em `.specwright/` dentro do repositório, sem banco de dados. Leitura por seção (cabeçalhos) e busca textual simples. **Sem índice nem cache:** os arquivos são relidos a cada chamada, então edições do agente, do usuário ou do próprio servidor aparecem na hora. Como `id` = nome do arquivo, ler uma spec não exige varrer a pasta.

## Alternativas
| Opção | Prós | Contras |
|---|---|---|
| **Markdown no repo** | Legível, revisável via PR, histórico no Git, sem infraestrutura | Busca limitada; escrita exige cuidado para não reformatar |
| SQLite | Consultas e FTS rápidos | Binário opaco no Git; não revisável; migrações |
| Índice vetorial | Busca semântica | Embeddings exigem modelo (conflita com ADR-0003) e infraestrutura |

## Consequências
Escritas devem ser mínimas e atômicas (TRD §5.1). Sem lock entre processos: um servidor por projeto. Listagens leem todos os frontmatters a cada chamada (meta NFR-7); cache ou índice só entram se essa meta falhar na prática.

**Revisão 2026-10-21:** a versão anterior previa índice em memória reconstruído na inicialização. Foi removido porque ficaria desatualizado assim que um arquivo mudasse durante a sessão.
