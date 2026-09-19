---
id: PLN-013
type: task
title: Validar links e referências externas
status: done
priority: medium
phase: M2
labels:
  - validacao
depends_on:
  - PLN-010
---

## Objetivo

Detectar links quebrados nos corpos das entidades sem depender de rede.

## Critérios de aceite

- [x] links relativos para arquivos inexistentes são reportados com o arquivo de origem
- [x] menções a ids de entidades inexistentes são reportadas
- [x] URLs externas são listadas, mas não acessadas

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (52 cenários passando, 1 novo cobrindo links relativos, absolutos, quebrados, âncoras, menções, URLs e trechos de código), `npx planner validate`
- limitações: links quebrados e menções inexistentes são avisos, não erros; a UI ainda não resolve links relativos do corpo para abrir o arquivo
