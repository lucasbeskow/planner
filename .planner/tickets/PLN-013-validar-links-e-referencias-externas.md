---
id: PLN-013
type: task
title: Validar links e referências externas
status: planned
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

- [ ] links relativos para arquivos inexistentes são reportados com o arquivo de origem
- [ ] menções a ids de entidades inexistentes são reportadas
- [ ] URLs externas são listadas, mas não acessadas
