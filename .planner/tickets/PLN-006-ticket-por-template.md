---
id: PLN-006
type: task
title: Criar ticket a partir de template
status: planned
priority: medium
phase: M1
labels:
  - cli
  - escrita
depends_on:
  - PLN-001
---

## Objetivo

Criar tickets com frontmatter válido, próximo id livre e seções padrão.

## Critérios de aceite

- [ ] o template padrão inclui Objetivo e Critérios de aceite
- [ ] o id gerado não colide com ids existentes
- [ ] o repositório pode sobrescrever o template em `.planner/templates/`
