---
id: PLN-009
type: decision
title: O .planner do próprio repositório é a fixture oficial
status: done
priority: medium
phase: M0
labels:
  - fixture
depends_on:
  - PLN-002
---

## Contexto

O PRD deixava em aberto qual fixture valida a experiência completa. Os testes automatizados já
geram fixtures temporárias próprias e não dependem de dados versionados.

## Decisão

O diretório `.planner/` na raiz deste repositório é a fixture de demonstração manual. Ele
planeja o próprio Planner, então se mantém atualizado pelo uso.

## Consequências

- a demonstração manual usa `npx planner-serve` na raiz do repositório;
- mudanças no formato precisam migrar também estes arquivos.

## Evidência

- harness: Claude Code 2.1.278
- model: claude-opus-5
- effort: medium
- tokens: 76216
- tokens_cache_read: 1170655
- started_at: 2026-09-19T19:53:09.198Z
- completed_at: 2026-09-19T20:01:57.000Z
- sessions: e5c917b0-63f6-412d-a178-80348d1f850e
- source: transcripts do Claude Code (19 respostas)
- validation: `npm test` (36 cenários passando), `npx planner validate`, `npx planner index` sem diff
- limitações: renderização da UI verificada por teste do renderizador e por requisição HTTP, sem teste automatizado em navegador; janela compartilhada por PLN-002, PLN-003, PLN-004 e PLN-009, fechados juntos no commit 8bdc9d0: modelo, effort e tokens valem para o conjunto, do início da sessão ao commit
