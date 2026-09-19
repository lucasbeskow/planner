---
id: PLN-009
type: decision
title: O .planner do próprio repositório é a fixture oficial
status: done
priority: medium
phase: M0
labels:
  - fixture
depends_on:
  - PLN-002
---

## Contexto

O PRD deixava em aberto qual fixture valida a experiência completa. Os testes automatizados já
geram fixtures temporárias próprias e não dependem de dados versionados.

## Decisão

O diretório `.planner/` na raiz deste repositório é a fixture de demonstração manual. Ele
planeja o próprio Planner, então se mantém atualizado pelo uso.

## Consequências

- a demonstração manual usa `npx planner-serve` na raiz do repositório;
- mudanças no formato precisam migrar também estes arquivos.

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (36 cenários passando), `npx planner validate`, `npx planner index` sem diff
- limitações: renderização da UI verificada por teste do renderizador e por requisição HTTP, sem teste automatizado em navegador
