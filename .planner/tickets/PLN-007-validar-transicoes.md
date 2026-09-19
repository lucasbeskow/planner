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

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (45 cenários passando, 3 novos de transição), `npx planner validate`; ticket iniciado e fechado com `npx planner set`
- limitações: iniciar um ticket com dependências abertas continua permitido; edições manuais do Markdown não passam pelas regras
