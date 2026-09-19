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

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 76216
- tokens_cache_read: 1170655
- started_at: 2026-09-19T19:53:09.198Z
- completed_at: 2026-09-19T20:01:57.000Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (19 respostas)
- validation: `npm test` (36 cenários passando), `npx planner validate`, `npx planner index` sem diff
- limitações: renderização da UI verificada por teste do renderizador e por requisição HTTP, sem teste automatizado em navegador; janela compartilhada por PLN-002, PLN-003, PLN-004 e PLN-009, fechados juntos no commit 8bdc9d0: modelo, effort e tokens valem para o conjunto, do início da sessão ao commit
