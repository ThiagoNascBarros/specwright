# ADR-0002 — Stack: TypeScript com SDK oficial de MCP

- **Status:** aceita
- **Data:** 2026-10-21

## Contexto
O rascunho listava "Python ou Dotnet" e "Node.js" ao mesmo tempo, enquanto a estrutura de pastas já usava `src/index.ts`. Era preciso escolher uma stack.

## Decisão
**TypeScript** sobre Node.js ≥ 22, com o SDK oficial **v2** `@modelcontextprotocol/server` (2.3.x em 2026-10-21) e `zod` v4 para validar entradas. Transporte stdio.

O pacote antigo `@modelcontextprotocol/sdk` (1.x) continua publicado, mas a v2 separa os pacotes por papel (`server`, `client`, `core`) e é a linha atual. O teste de contrato usa `@modelcontextprotocol/client` como dependência de desenvolvimento.

## Alternativas
| Opção | Prós | Contras |
|---|---|---|
| **TypeScript** | SDK mais maduro; distribuição via `npx` sem runtime extra para quem já usa Node; tipos para contratos das tools | Exige Node instalado |
| Python (FastMCP) | Código enxuto; `uvx`/`pipx` | Distribuição menos uniforme; fora da estrutura já desenhada |
| .NET | SDK C# oficial; integra ao ecossistema .NET | Binário maior; menos comum para ferramentas de agente |

## Consequências
Build com `tsc`, testes com Vitest, pacote npm com `bin`. Quem não tem Node precisa instalá-lo (Node ≥ 22).
