---
id: PLN-001
type: initiative
title: Planner local — do M0 à edição segura
status: in_progress
priority: high
phase: M1
labels:
  - roadmap
depends_on: []
---

## Objetivo

Validar o fluxo local do Planner com uma fixture real e evoluir da leitura (M0) para a edição
segura (M1), mantendo os arquivos Markdown como fonte de verdade.

## Contexto

A definição do produto está em `docs/prd.md`. Este diretório é a fixture
oficial do projeto: o próprio Planner é planejado com o Planner.

## Critérios de aceite

- [x] fixture `.planner/` versionada para demonstração manual
- [x] corpo Markdown e critérios de aceite renderizados na UI
- [x] navegação por dependentes na UI
- [ ] edição de status, prioridade e labels com diff revisável
- [ ] criação de ticket a partir de template
