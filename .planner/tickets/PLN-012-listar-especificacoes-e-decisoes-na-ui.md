---
id: PLN-012
type: task
title: Listar especificações e decisões na UI
status: done
priority: medium
phase: M2
labels:
  - ui
depends_on:
  - PLN-010
---

## Objetivo

Tornar especificações e decisões recentes visíveis na UI, fora do quadro de tickets.

## Critérios de aceite

- [x] a UI lista `spec` e `decision` em uma seção própria, das mais recentes para as mais antigas
- [x] cada item abre o mesmo painel de detalhe dos tickets

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: UI conferida no Chrome (seção com PLN-009 fora do quadro, detalhe aberto pelo card); `npm test` (52 cenários passando), `npx planner validate`
- limitações: "recente" é o maior número de id, porque o frontmatter não tem data; sem teste automatizado de navegador
