---
id: PLN-017
type: decision
title: Evidência de execução fica em seção do ticket
status: done
priority: medium
phase: M2
labels:
  - evidencia
depends_on:
  - PLN-014
---

## Contexto

O PRD deixava em aberto se a evidência de execução seria uma seção do ticket ou uma entidade
`evidence` separada, e como tratar tickets concluídos antes do contrato. Os tickets desta
fixture já registravam a evidência em uma seção `## Evidência` com itens `- campo: valor`.

## Decisão

A evidência fica na seção `## Evidência` (ou `Evidence`) do próprio ticket, com os campos
`harness`, `model`, `effort`, `tokens`, `completed_at` e `validation`, e campos livres como
`limitações`. O runtime lê a seção, avisa quando uma task `done` não tem a seção ou algum dos
campos, e projeta no índice só os campos curtos (`harness`, `model`, `effort`, `tokens`,
`completed_at`).

Tickets concluídos antes do contrato recebem aviso, não erro. Para registrar que a informação
não existe, basta preencher os campos com `unknown`.

## Consequências

- a evidência é revisada no mesmo diff que fecha o ticket, sem arquivo extra;
- não há tipo novo no domínio nem migração dos tickets existentes;
- `validation` e limitações ficam só no Markdown, para manter o índice pequeno;
- se uma execução precisar de várias evidências, a decisão deve ser revista.
