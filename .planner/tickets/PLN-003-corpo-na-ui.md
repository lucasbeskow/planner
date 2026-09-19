---
id: PLN-003
type: task
title: Renderizar corpo e critérios de aceite na UI
status: done
priority: high
phase: M0
labels:
  - ui
depends_on:
  - PLN-002
---

## Objetivo

Mostrar no detalhe do ticket o corpo Markdown completo e o progresso dos critérios de aceite.

## Abordagem

A UI busca o arquivo de origem indicado em `source`, sem incluir o corpo no índice. O
renderizador em `markdown.mjs` não tem dependências e escapa todo o texto antes de aplicar
marcação.

## Critérios de aceite

- [x] títulos, listas, checklists, código e links aparecem formatados
- [x] o detalhe mostra `feitos/total` da seção de critérios de aceite
- [x] HTML presente no Markdown é exibido como texto

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
