---
id: PLN-014
type: task
title: Registrar e projetar evidências de execução
status: planned
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

- [ ] decisão registrada sobre onde a evidência vive
- [ ] `planner validate` aponta tickets `done` sem evidência
- [ ] a UI mostra a evidência no detalhe do ticket
