---
id: PLN-005
type: task
title: Alterar status, prioridade e labels com diff revisável
status: planned
priority: high
phase: M1
labels:
  - cli
  - escrita
depends_on:
  - PLN-001
---

## Objetivo

Oferecer um comando que altera campos do frontmatter preservando o restante do arquivo e mostra
o diff antes de gravar.

## Critérios de aceite

- [ ] `planner set <id> status=<valor>` mostra o diff e só grava com confirmação
- [ ] campos e comentários não alterados permanecem idênticos
- [ ] valores inválidos são rejeitados antes da escrita
