---
id: PLN-007
type: task
title: Validar transições de status antes de salvar
status: planned
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

- [ ] a regra de transição é declarada em um único lugar do core
- [ ] a CLI explica por que a transição foi recusada
