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

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 27050
- tokens_cache_read: 1058535
- started_at: 2026-09-19T20:14:13.705Z
- completed_at: 2026-09-19T20:17:00.600Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (8 respostas)
- validation: `npm test` (48 cenários passando, 3 novos para `new`), `npx planner validate`; ticket iniciado e fechado com `npx planner set`
- limitações: o índice não é regenerado pelo `new` (PLN-008); dois `new` simultâneos com títulos diferentes podem gerar o mesmo id, o que `planner validate` reporta como id duplicado
