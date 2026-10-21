# ADR-0005 — Tool dedicada para marcar critérios (`set_criterion_status`)

- **Status:** aceita
- **Data:** 2026-10-21

## Contexto
`list_open_requirements` depende dos checkboxes `[ ]`/`[x]`, mas o rascunho inicial não tinha nenhuma tool que os alterasse, deixando o ciclo spec → validação → spec atualizada incompleto.

## Decisão
Adicionar `set_criterion_status(spec_id, ac_id, done)`. É a 6ª tool da Fase 1, e com ela o total do produto chega a 10, o teto do NFR-2 do PRD. O servidor troca apenas o caractere do checkbox da linha do `AC-n`, de forma atômica e idempotente.

## Alternativas
| Opção | Prós | Contras |
|---|---|---|
| **Tool dedicada** | Responsabilidade única; ciclo fecha no MCP; fácil de testar | Consome uma das 10 tools |
| Humano edita o arquivo | Mais simples e seguro | Ciclo fica manual; agente não consegue registrar progresso |
| `check_task_against_spec` marca sozinho | Menos tools | Mistura leitura e escrita; efeito colateral inesperado numa tool de consulta |

## Consequências
Orçamento de tools fica esgotado (10/10): nova tool exige remover ou fundir outra. Escrita em spec exige a infraestrutura de edição mínima do `storage/`.
