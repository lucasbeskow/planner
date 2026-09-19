---
id: PLN-002
type: task
title: Versionar fixture .planner para demonstração manual
status: done
priority: high
phase: M0
labels:
  - fixture
  - docs
depends_on:
  - PLN-001
---

## Objetivo

Ter um diretório `.planner/` versionado que exercite a UI, a CLI e o MCP com dados reais.

## Critérios de aceite

- [x] `npx planner validate` passa na raiz do repositório
- [x] o índice versionado é regenerado sem diff por `npx planner index`
- [x] há tickets em mais de um status, com dependências e dependentes

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (36 cenários passando), `npx planner validate`, `npx planner index` sem diff
- limitações: renderização da UI verificada por teste do renderizador e por requisição HTTP, sem teste automatizado em navegador
