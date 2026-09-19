---
id: PLN-008
type: task
title: Atualizar o índice após escrita autorizada
status: done
priority: medium
phase: M1
labels:
  - indice
  - escrita
depends_on:
  - PLN-005
  - PLN-006
---

## Objetivo

Regenerar `.planner/index.json` na mesma operação que grava uma entidade.

## Critérios de aceite

- [x] escrita e índice ficam consistentes mesmo quando a validação falha
- [x] nenhuma escrita acontece sem autorização explícita

## Evidência

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 15050
- tokens_cache_read: 1190000
- started_at: 2026-09-19T20:22:09.467Z
- completed_at: 2026-09-19T20:24:28.427Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (8 respostas)
- validation: `npm test` (50 cenários passando, 2 novos de índice e rollback), `npx planner validate`; ticket fechado com `npx planner set`, que já atualizou o índice
- limitações: edições manuais do Markdown continuam exigindo `npx planner index`; o rollback cobre falha ao gravar o índice, não queda do processo entre as duas escritas
