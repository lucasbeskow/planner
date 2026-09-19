---
id: PLN-007
type: task
title: Validar transições de status antes de salvar
status: done
priority: medium
phase: M1
labels:
  - dominio
  - escrita
depends_on:
  - PLN-005
---

## Objetivo

Impedir transições incoerentes, como concluir um ticket com dependências abertas.

## Critérios de aceite

- [x] a regra de transição é declarada em um único lugar do core
- [x] a CLI explica por que a transição foi recusada

## Evidência

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 13326
- tokens_cache_read: 476311
- started_at: 2026-09-19T20:10:11.196Z
- completed_at: 2026-09-19T20:11:46.257Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (4 respostas)
- validation: `npm test` (45 cenários passando, 3 novos de transição), `npx planner validate`; ticket iniciado e fechado com `npx planner set`
- limitações: iniciar um ticket com dependências abertas continua permitido; edições manuais do Markdown não passam pelas regras
