---
id: PLN-005
type: task
title: Alterar status, prioridade e labels com diff revisável
status: done
priority: high
phase: M1
labels:
  - cli
  - escrita
depends_on:
  - PLN-001
---

## Objetivo

Oferecer um comando que altera campos do frontmatter preservando o restante do arquivo e mostra
o diff antes de gravar.

## Critérios de aceite

- [x] `planner set <id> status=<valor>` mostra o diff e só grava com confirmação
- [x] campos e comentários não alterados permanecem idênticos
- [x] valores inválidos são rejeitados antes da escrita

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (42 cenários passando, 6 novos para `set` e `applyEdit`), `npx planner validate`; este ticket foi fechado com `npx planner set PLN-005 status=done --yes`
- limitações: o índice não é regenerado pelo `set` (PLN-008); transições não são validadas (PLN-007)
