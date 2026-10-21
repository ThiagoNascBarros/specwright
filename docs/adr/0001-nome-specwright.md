# ADR-0001 — Nome do projeto: Specwright

- **Status:** aceita
- **Data:** 2026-10-21

## Contexto
O nome provisório "Spec Guardian MCP" era descritivo, mas genérico e longo. Precisamos de um nome curto, memorável e disponível como pacote npm.

## Decisão
Adotar **Specwright** ("wright" = artesão, como em playwright): quem trabalha a spec. Pasta `.specwright/`, variável `SPECWRIGHT_DIR`, pacote `specwright-mcp`.

## Alternativas
| Opção | Prós | Contras |
|---|---|---|
| **Specwright** | Diz o que faz, evoca ofício, livre no npm | Menos óbvio que "guardian" |
| Lodestar | Estrela-guia, livre no npm | Abstrato, não remete a specs |
| Cairn | Boa metáfora de memória/decisões | `cairn-mcp` já existe no npm |
| Plumb | Prumo = alinhamento com a spec | `plumb-mcp` já existe no npm |
| Spec Guardian | Descritivo | Longo e genérico |

## Consequências
Renomear referências do rascunho (`.spec-guardian` → `.specwright`). Disponibilidade no npm deve ser revalidada antes da publicação.
