# Specwright

Servidor MCP (TypeScript, stdio) que mantém specs, decisões e memória de projeto como fonte da verdade para agentes de IA.

## Documentação
- Produto (o quê/por quê): `docs/01-prd.md`
- Técnica (como): `docs/02-trd.md`. As restrições globais estão no **TRD §2** e valem para todo código.
- Ordem das specs e ciclo de trabalho: `docs/03-roadmap.md`
- Decisões de arquitetura: `docs/adr/`
- Specs de desenvolvimento: `.specwright/specs/`
- Planos de implementação: `docs/superpowers/plans/`

## Como trabalhar
- **Uma spec por vez**, seguindo a tabela "Ciclo por spec" do Roadmap: spec → plano → TDD → verificação → fechamento. Cada etapa só começa depois da aprovação humana da anterior.
- **TDD obrigatório:** todo `AC-n` tem um teste que cita o id no nome e que foi visto falhando antes da implementação.
- Nunca escreva em stdout no servidor. O stdout transporta o JSON-RPC; diagnósticos vão para stderr.
- Uma spec só fica pronta com a suíte inteira verde e o CI verde.

## Comandos
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: build e depois a suíte Vitest inteira
- `npm run build`: compila para `dist/`

## Estrutura
- `src/index.ts`: cria o servidor e registra as tools dos módulos
- `src/storage/`: única camada que toca o disco
- `src/specs/`, `src/memory/`, `src/context/`: módulos independentes (TRD §3)
- `tests/contract/`: testes via stdio
- `tests/fixtures/`: fixtures; o Git preserva os bytes (CRLF/BOM)
