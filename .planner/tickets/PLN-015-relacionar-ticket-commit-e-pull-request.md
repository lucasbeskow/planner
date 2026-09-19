---
id: PLN-015
type: task
title: Relacionar ticket, commit e pull request
status: done
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

- [x] commits que citam o id do ticket aparecem em `planner context`
- [x] nenhuma chamada de rede é necessária

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (54 cenários passando, 1 novo com repositório Git temporário, CLI e MCP); `npx planner context PLN-005 --json` lista o commit 8b91c2a
- limitações: só relaciona commits que citam o id; PRs aparecem apenas quando o número está no assunto do commit
