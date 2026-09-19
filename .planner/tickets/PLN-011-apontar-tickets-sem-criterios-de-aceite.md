---
id: PLN-011
type: task
title: Apontar tickets sem critérios de aceite
status: planned
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

- [ ] `planner validate` avisa sobre tasks sem seção `Critérios de aceite` ou sem itens de checklist
- [ ] o aviso não torna o plano inválido nem muda o código de saída
- [ ] o índice projeta o progresso dos critérios e a UI destaca tickets sem critérios
- [ ] tickets `draft` e `canceled` não geram aviso
