---
id: PLN-006
type: task
title: Criar ticket a partir de template
status: done
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

- [x] o template padrão inclui Objetivo e Critérios de aceite
- [x] o id gerado não colide com ids existentes
- [x] o repositório pode sobrescrever o template em `.planner/templates/`

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (48 cenários passando, 3 novos para `new`), `npx planner validate`; ticket iniciado e fechado com `npx planner set`
- limitações: o índice não é regenerado pelo `new` (PLN-008); dois `new` simultâneos com títulos diferentes podem gerar o mesmo id, o que `planner validate` reporta como id duplicado
