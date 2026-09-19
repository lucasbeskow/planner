# PRD — Planner local de engenharia

Status: `draft`

## 1. Visão

O Planner é uma aplicação local embarcada no repositório que transforma arquivos de planejamento e especificação em uma interface navegável de acompanhamento técnico.

## 2. Problema

Planos, decisões e tarefas ficam distribuídos entre Markdown, branches, commits, pull requests e ferramentas externas. Isso dificulta:

- descobrir o estado atual de uma iniciativa;
- entender dependências;
- saber qual especificação originou uma tarefa;
- retomar o trabalho depois de uma pausa;
- fornecer contexto consistente a agentes de código;
- revisar a evolução junto com o código.

## 3. Usuários

### Desenvolvedor

Quer saber o próximo trabalho, seus critérios de aceite e os arquivos relacionados.

### Tech lead/arquitetura

Quer acompanhar decisões, dependências, riscos e evolução técnica.

### Agente de código

Precisa encontrar contexto estruturado, estado atual, restrições e comandos de validação.

### Revisor

Quer entender por que uma alteração existe e quais critérios precisam ser verificados.

## 4. Objetivos do MVP

- permitir iniciar o Planner em um repositório;
- apresentar uma visão geral da iniciativa;
- listar tickets por status;
- abrir detalhes de cada ticket;
- exibir dependências;
- manter os dados em arquivos versionáveis;
- permitir reconstruir a visão sem banco externo.

## 5. Não objetivos do MVP

- competir com todos os recursos do Linear;
- substituir GitHub/GitLab;
- editar código;
- fazer deploy;
- executar comandos sem confirmação;
- sincronizar automaticamente com um SaaS.

## 6. Requisitos funcionais

### RF01 — Descoberta

O sistema deve localizar a configuração do Planner a partir da raiz do repositório.

### RF02 — Dashboard

O sistema deve mostrar iniciativa, progresso, contadores por status e itens bloqueados.

### RF03 — Tickets

O sistema deve listar tickets com id, título, tipo, status, prioridade, labels e fase.

### RF04 — Detalhes

O sistema deve permitir abrir o Markdown completo de uma entidade.

### RF05 — Relações

O sistema deve mostrar dependências e referências entre entidades.

### RF06 — Fonte de verdade

O sistema não deve exigir banco externo para ler e navegar pelos dados.

### RF07 — Validação

O sistema deve apontar entidades inválidas, ids duplicados e dependências inexistentes.

## 7. Requisitos não funcionais

- funcionar localmente;
- iniciar com um comando documentado;
- não adicionar dependências ao bundle de produção;
- operar com arquivos UTF-8 e LF;
- ser acessível por teclado;
- ter interface responsiva;
- gerar erros acionáveis;
- não executar comandos do sistema sem consentimento explícito.

## 8. Formato inicial de entidade

```md
---
id: F1-002
type: task
title: Corrigir retry de 401
status: planned
priority: high
phase: F1
depends_on:
  - F0-001
labels:
  - architecture
---

## Contexto

Descrição do problema.

## Critérios de aceite

- [ ] primeiro request usa o token inicial;
- [ ] retry usa o token renovado;
- [ ] segundo 401 não gera loop.
```

## 9. Estados iniciais

```text
draft → planned → in_progress → blocked → done
                         ↓
                      canceled
```

Transições inválidas devem gerar aviso antes de salvar.

## 10. MVP técnico

### Entregas

- [ ] diretório `.planner/` com configuração e índice;
- [ ] diretório `planner/` com UI estática;
- [ ] dashboard inicial;
- [ ] board de tickets;
- [ ] painel de detalhes;
- [ ] visualização de dependências;
- [ ] documentação de inicialização;
- [ ] fixture de dados baseada no plano arquitetural atual.

### Critérios de aceite do MVP

- [ ] uma pessoa consegue abrir o dashboard sem serviços remotos;
- [ ] o dashboard mostra pelo menos uma iniciativa e quatro tickets;
- [ ] tickets aparecem agrupados por status;
- [ ] detalhes exibem critérios de aceite;
- [ ] dependências são visíveis;
- [ ] dados permanecem legíveis em arquivos do repositório;
- [ ] `yarn lint` e `yarn test.spec` existentes continuam passando;
- [ ] nenhum arquivo do planner é incluído acidentalmente no pacote de produção.

## 11. Riscos

- duplicar funcionalidades já existentes em Linear/Lovelace/Pillar;
- criar um formato proprietário difícil de migrar;
- misturar ferramenta de desenvolvimento com código distribuído;
- ampliar o MVP antes de validar o fluxo local;
- permitir que a UI se torne uma segunda fonte de verdade.

## 12. Métricas de validação

- tempo para encontrar a próxima tarefa;
- tempo para entender o contexto de um ticket;
- quantidade de decisões recuperáveis sem histórico de conversa;
- quantidade de arquivos necessários para retomar uma iniciativa;
- tempo de inicialização local;
- número de dependências novas introduzidas.

