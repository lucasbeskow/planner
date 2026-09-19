---
id: PLN-008
type: task
title: Atualizar o índice após escrita autorizada
status: planned
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

- [ ] escrita e índice ficam consistentes mesmo quando a validação falha
- [ ] nenhuma escrita acontece sem autorização explícita
