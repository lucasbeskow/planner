---
id: PLN-011
type: task
title: Apontar tickets sem critérios de aceite
status: done
priority: high
phase: M2
labels:
  - validacao
depends_on:
  - PLN-010
---

## Objetivo

Mostrar quais tickets não têm critérios de aceite verificáveis, antes que alguém comece ou
feche o trabalho.

## Critérios de aceite

- [x] `planner validate` avisa sobre tasks sem seção `Critérios de aceite` ou sem itens de checklist
- [x] o aviso não torna o plano inválido nem muda o código de saída
- [x] o índice projeta o progresso dos critérios e a UI destaca tickets sem critérios
- [x] tickets `draft` e `canceled` não geram aviso

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (51 cenários passando, 1 novo cobrindo avisos na CLI, no MCP e no índice), `npx planner validate`; UI conferida no Chrome (progresso nos cards e no detalhe)
- limitações: o destaque visual de ticket sem critérios foi verificado só por teste do índice, porque a fixture versionada não tem tickets sem critérios
