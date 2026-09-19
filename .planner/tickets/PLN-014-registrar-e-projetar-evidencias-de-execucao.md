---
id: PLN-014
type: task
title: Registrar e projetar evidências de execução
status: done
priority: high
phase: M2
labels:
  - dominio
  - evidencia
depends_on:
  - PLN-010
---

## Objetivo

Transformar o contrato de evidência de fechamento, hoje só de processo, em dado validado e
projetado.

## Contexto

O PRD deixa em aberto se a evidência é uma seção do ticket ou uma entidade `evidence`. Os
tickets desta fixture já usam a seção `## Evidência` com `harness`, `model`, `effort`,
`tokens`, `completed_at` e `validation`.

## Critérios de aceite

- [x] decisão registrada sobre onde a evidência vive
- [x] `planner validate` aponta tickets `done` sem evidência
- [x] a UI mostra a evidência no detalhe do ticket

## Evidência

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 20829
- tokens_cache_read: 2544747
- started_at: 2026-09-19T20:58:48.242Z
- completed_at: 2026-09-19T21:01:52.586Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (12 respostas)
- validation: `npm test` (53 cenários passando, 1 novo cobrindo leitura, avisos e projeção), `npx planner validate` sem avisos na fixture; detalhe conferido no Chrome
- limitações: um ticket guarda uma única evidência; várias execuções exigem rever a decisão PLN-017
