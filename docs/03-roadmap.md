---
id: RM-001
title: Specwright — Roadmap
status: draft
version: 0.2
implements: TRD-001
---

# RM-001 — Roadmap

Ordem de entrega das specs de desenvolvimento. Este documento **não é** um plano de implementação: cada spec ganha o seu plano no momento em que for desenvolvida.

## Ciclo por spec

Uma spec por vez. A próxima só começa quando a anterior está concluída.

| # | Etapa | Artefato | Skill superpowers | Gate |
|---|---|---|---|---|
| 1 | Escrever a spec | `.specwright/specs/<id>.md` (formato do [TRD §6.1](02-trd.md)) | `brainstorming` | você aprova a spec |
| 2 | Plano de implementação | `docs/superpowers/plans/AAAA-MM-DD-<id>.md` | `writing-plans` | você aprova o plano e escolhe o modo de execução |
| 3 | Implementar | código + testes, numa branch | `test-driven-development`, mais `subagent-driven-development` ou `executing-plans` | cada `AC-n` tem teste que falhou antes de passar |
| 4 | Verificar | saída de `npm test` e `tsc --noEmit` | `verification-before-completion` | suíte inteira verde, com evidência |
| 5 | Fechar | critérios marcados, decisões registradas, merge | `finishing-a-development-branch` | spec com `status: done` |

**Definição de pronto de uma spec**
1. Todos os `AC-n` estão cobertos por um teste que cita o id e foi visto falhando antes da implementação.
2. `npm test` (a suíte inteira) e `tsc --noEmit` estão verdes, e a saída foi anexada ao fechamento.
3. Os critérios estão marcados na spec. A partir da spec 3 isso é feito com `set_criterion_status`; nas specs 1 e 2, à mão.
4. As decisões relevantes estão registradas. A partir da spec 4 isso é feito com `log_decision`; antes dela, como ADR em `docs/adr/`.
5. O dogfooding de fumaça foi executado (TRD §10), a partir da spec 2.
6. O CI da branch está verde.

## Fase 1: núcleo de specs

A spec 1 é a fundação: repositório, estrutura, build, CI e um servidor que sobe sem tools. Da spec 2 em diante, cada spec é uma fatia vertical: ao terminar, o servidor tem tools novas e utilizáveis por um agente.

| # | Spec id | Entrega | Requisitos | Status |
|---|---|---|---|---|
| 1 | `project-foundation` | Repositório GitHub, estrutura de pastas do TRD §3, `package.json`, `tsconfig`, CI, servidor stdio sem tools e teste de contrato | NFR-9, NFR-10 | [ ] |
| 2 | `spec-reading` | `config.ts`, `errors.ts`, `storage/paths` e `storage/markdown`, parser de spec e as tools `list_specs` e `get_spec` | FR-1, FR-2, FR-3, NFR-3, NFR-4, NFR-6, NFR-7, NFR-8 | [ ] |
| 3 | `acceptance-criteria` | `storage/files` (escrita atômica, edição mínima), `list_open_requirements` e `set_criterion_status` | FR-4, FR-6, NFR-5 | [ ] |
| 4 | `decision-log` | Criação exclusiva de arquivo e `log_decision` | FR-7 | [ ] |
| 5 | `check-task` | Parser de diff e `check_task_against_spec`; decidir a TRD Q1 | FR-5 | [ ] |

**Pronto da Fase 1:** as 5 specs com `status: done`, mais um ciclo completo executado no próprio repositório (PRD §7, Fase 1) e o README de instalação.

## Fase 2: memória de projeto

| Spec id | Entrega | Requisitos |
|---|---|---|
| `memory` | `save_memory` e `search_memory` (sobre memórias e decisões) | FR-8, FR-9 |
| `decision-list` | `list_decisions` | FR-10 |

Termina quando a métrica de sucesso da Fase 2 (PRD §7) é demonstrada.

## Fase 3: Context Packer

| Spec id | Entrega | Requisitos |
|---|---|---|
| `context-pack` | Orçamento de tokens e `pack_context` | FR-11 |

Antes de começar, decidir a PRD Q1 (tokenizador).

## Marcos de documentação
- [x] PRD-001 (v0.2)
- [x] TRD-001 (v0.2)
- [x] ADR-0001 a ADR-0005
- [x] RM-001 (v0.2)
- [ ] Spec 1 `project-foundation` (em revisão)
