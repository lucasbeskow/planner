---
id: PLN-016
type: task
title: Mostrar grafo visual de dependências
status: done
priority: low
phase: M2
labels:
  - ui
depends_on:
  - PLN-010
---

## Objetivo

Visualizar dependências e dependentes como grafo, para achar caminhos bloqueados.

## Critérios de aceite

- [x] a UI desenha o grafo da iniciativa sem dependências externas
- [x] ciclos e dependências inexistentes aparecem destacados

## Evidência

- harness: Claude Code
- model: claude-opus-5
- effort: unknown
- tokens: unknown
- completed_at: 2026-09-19
- validation: `npm test` (55 cenários passando, 1 novo para layout, destaque e escape do grafo); grafo conferido no Chrome com a fixture versionada e com uma fixture temporária com ciclo e dependência inexistente, incluindo clique no nó
- limitações: com muitas entidades o grafo cresce na vertical e as arestas se cruzam; não há filtro por iniciativa
