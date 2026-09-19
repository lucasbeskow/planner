---
id: PLN-018
type: task
title: Coletar evidência de execução do harness
status: done
priority: high
phase: M2
labels:
  - evidencia
  - cli
depends_on:
  - PLN-014
---

## Objetivo

Preencher a seção Evidência com modelo, effort e tokens lidos do harness, em vez de depender de
o agente declarar valores que ele não enxerga.

## Contexto

Os tickets do M1 e do M2 foram fechados com `effort: unknown` e `tokens: unknown`. O Claude Code
grava em `~/.claude/projects/<repo>/<sessão>.jsonl`, por resposta, `effort`, `message.model` e
`message.usage`, que permitem calcular os valores por ticket.

## Critérios de aceite

- [x] `planner evidence <id>` calcula modelo, effort e tokens dos transcripts do Claude Code na janela entre o início (`status=in_progress`) e a conclusão do ticket
- [x] `tokens` soma input, output e criação de cache; `tokens_cache_read` fica separado
- [x] mensagens repetidas no transcript são contadas uma vez
- [x] sem transcript, o comando exige harness, model, effort e tokens explícitos
- [x] mostra o diff e só grava com `--yes`, preservando os demais campos da seção
- [x] tickets já concluídos recebem os valores reais recalculados

## Evidência

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 42256
- tokens_cache_read: 3325336
- started_at: 2026-09-19T21:37:35.121Z
- completed_at: 2026-09-19T21:42:05.662Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (12 respostas)
- validation: `npm test` (57 cenários passando, 2 novos com transcript sintético: janela, deduplicação, comandos ignorados, mesclagem e modo manual); evidência recalculada nos 13 tickets e na decisão já concluídos
- limitações: só o Claude Code tem adaptador; a janela vai do primeiro in_progress ao done, então inclui pausas e trabalho de outros tickets feito no meio
