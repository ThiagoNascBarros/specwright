---
id: PRD-001
title: Specwright — Product Requirements Document
status: draft
version: 0.2
---

# PRD-001 — Specwright

> Servidor MCP que mantém specs, decisões e memória de projeto como fonte da verdade para agentes de IA e monta o contexto mínimo necessário para cada tarefa.

Este documento responde **o quê** e **por quê**. O **como** está no [TRD-001](02-trd.md).

## 1. Problema

No desenvolvimento agêntico, três dores se repetem:

1. **Deriva da spec:** conforme a sessão avança, o agente se afasta do especificado e ninguém percebe até o code review.
2. **Amnésia entre sessões:** decisões, convenções e armadilhas descobertas se perdem quando o contexto acaba.
3. **Contexto inchado:** para "garantir", o agente lê arquivos demais (ou o PRD inteiro) e gasta tokens com ruído.

## 2. Visão

Um único servidor MCP, em três módulos que compartilham o mesmo armazenamento em Markdown dentro do repositório:

| Módulo | Responsabilidade |
|---|---|
| `specs` | Consulta specs e valida o trabalho do agente contra os critérios de aceite |
| `memory` | Guarda decisões, convenções e aprendizados entre sessões |
| `context` | Monta o contexto mínimo (specs + memória + código relevante) para uma tarefa |

Ciclo que o produto fecha:

```
spec -> código -> validação -> decisão registrada -> spec/memória atualizadas
```

## 3. Usuários

| Usuário | Necessidade |
|---|---|
| **Agente de IA** (Claude Code, outros clientes MCP) | Ler só o trecho de spec necessário, validar o próprio trabalho, registrar decisões e recuperar histórico |
| **Desenvolvedor** | Escrever e revisar specs/decisões em Markdown, no Git, sem ferramenta proprietária |

## 4. Metas e não-metas

**Metas**
- G1. Reduzir a deriva: o agente consegue comparar seu trabalho com critérios de aceite antes de declarar "pronto".
- G2. Persistir decisões e aprendizados de forma legível por humanos e agentes, versionada no Git.
- G3. Reduzir tokens gastos com leitura de contexto (leitura por seção, não por documento).
- G4. Zero dependência externa em runtime: sem chave de API, sem banco, sem serviço.

**Não-metas**
- N1. O servidor **não** chama LLM nem julga conformidade; entrega dados estruturados e o agente decide.
- N2. Não é gerenciador de tarefas/issues nem substitui Jira, Linear ou similares.
- N3. Não gera código nem specs automaticamente.
- N4. Não há banco de dados nem índice vetorial no início.
- N5. Sem interface web, sem multiusuário/concorrência entre máquinas (o Git é o mecanismo de sincronização).

## 5. Requisitos funcionais

Prioridade: **P0** = Fase 1 (núcleo), **P1** = Fase 2, **P2** = Fase 3.

| ID | Requisito | Pri | Fase |
|---|---|---|---|
| FR-1 | Ler specs Markdown com frontmatter (`id`, `title`, `status`) a partir de `.specwright/specs/`, refletindo sempre o estado atual dos arquivos | P0 | 1 |
| FR-2 | `list_specs`: listar specs com id, título e status | P0 | 1 |
| FR-3 | `get_spec`: devolver uma spec inteira ou somente a seção pedida | P0 | 1 |
| FR-4 | `list_open_requirements`: listar critérios de aceite não atendidos, de uma spec ou de todas | P0 | 1 |
| FR-5 | `check_task_against_spec`: receber diff + `spec_id` e devolver critérios, escopo excluído e resumo estruturado das mudanças | P0 | 1 |
| FR-6 | `set_criterion_status`: marcar/desmarcar um critério `AC-n` de uma spec | P0 | 1 |
| FR-7 | `log_decision`: registrar decisão vinculada a uma spec | P0 | 1 |
| FR-8 | `save_memory`: salvar convenção, aprendizado ou armadilha | P1 | 2 |
| FR-9 | `search_memory`: buscar memórias e decisões por tema | P1 | 2 |
| FR-10 | `list_decisions`: listar decisões filtrando por spec ou período | P1 | 2 |
| FR-11 | `pack_context`: dada uma tarefa, devolver seções de spec, memórias e arquivos candidatos dentro de um orçamento de tokens | P2 | 3 |

## 6. Requisitos não funcionais

| ID | Requisito | Alvo |
|---|---|---|
| NFR-1 | Sem LLM e sem chave de API no servidor | 0 chamadas a modelos |
| NFR-2 | Superfície enxuta de tools | ≤ 10 tools no total |
| NFR-3 | Custo de contexto das tools | JSON de `tools/list` ≤ 12.000 caracteres (≈ 3.000 tokens); descrição de cada tool ≤ 2 frases |
| NFR-4 | Respostas econômicas em tokens | `get_spec` por seção; listagens sem corpo; resposta truncada acima de `maxResponseChars` (padrão 20.000) |
| NFR-5 | Escrita segura e diffs limpos | escrita atômica; só a linha/arquivo necessário é alterado; nenhum reformat do Markdown do usuário |
| NFR-6 | Segurança de caminho | nenhuma leitura/escrita fora de `SPECWRIGHT_DIR` (anti path traversal, anti symlink-escape) |
| NFR-7 | Desempenho (projeto com 500 specs, disco local) | `list_specs` e `list_open_requirements` < 500 ms; demais tools < 200 ms; `pack_context` fora da meta |
| NFR-8 | Erros acionáveis | erro estruturado com código e dica de correção, nunca stack trace cru |
| NFR-9 | Portabilidade | Node.js ≥ 22 (LTS ativa ou de manutenção); Linux, macOS, Windows; transporte stdio |
| NFR-10 | Qualidade | desenvolvimento em TDD: todo `AC-n` tem um teste que cita o id e foi visto falhando antes da implementação; suíte inteira verde para concluir uma spec |

## 7. Métricas de sucesso

| Fase | Sinal de sucesso |
|---|---|
| 1 | Dogfooding: na spec `check-task`, um agente executa o ciclo `get_spec` (por seção) → implementar → `check_task_against_spec` → `set_criterion_status` → `log_decision` sem abrir o PRD nem o TRD inteiros |
| 2 | Uma decisão registrada numa sessão é recuperada via `search_memory` numa sessão nova sem reler arquivos |
| 3 | `pack_context` entrega contexto dentro do orçamento configurado e o agente conclui a tarefa sem leituras adicionais amplas |

## 8. Escopo por fase

- **Fase 1 — Núcleo de specs:** FR-1 a FR-7.
- **Fase 2 — Memória de projeto:** FR-8 a FR-10, reaproveitando `storage/` da Fase 1.
- **Fase 3 — Context Packer:** FR-11, com orçamento de tokens configurável.

Ordem das specs de desenvolvimento em [Roadmap](03-roadmap.md).

## 9. Dependências e premissas

- Cliente MCP com suporte a stdio (ex.: Claude Code).
- O projeto-alvo usa Git (não obrigatório, mas é o mecanismo de histórico e revisão).
- O agente é responsável por julgar conformidade; a qualidade do `check_task_against_spec` depende de specs com critérios claros e verificáveis.

## 10. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Specs mal escritas (critérios vagos) tornam a validação inútil | Alto | Formato com ids estáveis `AC-n`; guia de escrita de specs; lint de spec como evolução futura |
| Agente ignora a validação | Médio | Descrições das tools orientam o uso; instrução recomendada para `CLAUDE.md` |
| Edição manual e do servidor conflitando no mesmo arquivo | Médio | Arquivos relidos a cada chamada; edição mínima e atômica; Git mostra o diff |
| Cliente inicia o servidor fora da raiz do projeto | Médio | `SPECWRIGHT_DIR` absoluto documentado no README; erro `NOT_INITIALIZED` com dica |
| Excesso de tools consome contexto | Médio | Limite NFR-2/NFR-3 como critério de revisão |
| Busca textual insuficiente na Fase 2/3 | Baixo | Índice mais sofisticado só com necessidade comprovada |

## 11. Questões em aberto

- Q1. Formato do orçamento de tokens do `pack_context` (estimativa por caracteres ou tokenizador real). Decidir na Fase 3.
- Q2. Licença do projeto (a definir antes da primeira publicação).
- Q3. Política de versão do `config.json` e migração de specs entre versões do formato.
