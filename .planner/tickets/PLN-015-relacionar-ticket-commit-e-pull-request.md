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

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 11219
- tokens_cache_read: 889221
- started_at: 2026-09-19T21:08:52.967Z
- completed_at: 2026-09-19T21:10:36.213Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (4 respostas)
- validation: `npm test` (54 cenários passando, 1 novo com repositório Git temporário, CLI e MCP); `npx planner context PLN-005 --json` lista o commit 8b91c2a
- limitações: só relaciona commits que citam o id; PRs aparecem apenas quando o número está no assunto do commit
