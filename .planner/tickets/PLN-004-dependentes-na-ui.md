---
id: PLN-004
type: task
title: Navegar por dependências e dependentes na UI
status: done
priority: medium
phase: M0
labels:
  - ui
depends_on:
  - PLN-002
---

## Objetivo

Permitir ir de um ticket para as dependências e os dependentes dele sem sair do detalhe.

## Critérios de aceite

- [x] o detalhe lista dependentes calculados a partir do índice
- [x] cada id abre o detalhe da entidade correspondente
- [x] ids ausentes do índice aparecem destacados, sem link

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (36 cenários passando), `npx planner validate`, `npx planner index` sem diff
- limitações: renderização da UI verificada por teste do renderizador e por requisição HTTP, sem teste automatizado em navegador
