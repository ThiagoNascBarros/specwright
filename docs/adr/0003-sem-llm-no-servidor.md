# ADR-0003 — Sem LLM dentro do servidor

- **Status:** aceita
- **Data:** 2026-10-21

## Contexto
`check_task_against_spec` e `pack_context` parecem pedir julgamento semântico. Poderíamos chamar um modelo no servidor para decidir se o diff atende à spec.

## Decisão
O servidor **não chama nenhum modelo e não exige chave de API**. Ele entrega dados estruturados (critérios, escopo excluído, resumo do diff, trechos selecionados); quem julga é o agente que o chamou.

## Alternativas
| Opção | Prós | Contras |
|---|---|---|
| **Sem LLM** | Zero custo e dependência; determinístico e testável; sem vazamento de código para terceiros | Julgamento depende do agente chamador |
| LLM embutido | Veredito pronto | Chave de API, custo, não determinismo, privacidade, segundo modelo opinando sobre o primeiro |
| LLM opcional (flag) | Flexível | Dobra a superfície de testes e config; foge do escopo inicial |

## Consequências
A qualidade da validação depende de critérios `AC-n` claros. As descrições das tools devem instruir o agente a comparar e reportar lacunas. Pode ser revisitada se o uso real mostrar necessidade.
