---
id: PLN-015
type: task
title: Relacionar ticket, commit e pull request
status: planned
priority: medium
phase: M2
labels:
  - git
depends_on:
  - PLN-010
---

## Objetivo

Ligar cada ticket aos commits e pull requests que o implementam, usando apenas o Git local.

## Critérios de aceite

- [ ] commits que citam o id do ticket aparecem em `planner context`
- [ ] nenhuma chamada de rede é necessária
