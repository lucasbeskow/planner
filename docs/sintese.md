# Planner — síntese da ideia

## Contexto

Este repositório já possui documentação, testes, componentes e planos de evolução, mas o acompanhamento do trabalho acontece fora do código. A intenção é criar um side project que trate planejamento técnico como parte do próprio repositório.

## Ideia central

Construir um sistema de gestão local, inspirado no Linear, com uma experiência de catálogo semelhante ao Storybook:

- roda a partir do repositório;
- lê arquivos versionados;
- apresenta planos, especificações, decisões e tickets em uma UI navegável;
- permite acompanhar estados, dependências e critérios de aceite;
- permanece útil para pessoas e agentes de código;
- não depende inicialmente de servidor, banco externo ou conta SaaS.

## Analogia

O Storybook organiza componentes, estados visuais e cenários de interação.

O Planner deve organizar o ciclo de vida da engenharia:

```text
objetivos → iniciativas → especificações → decisões → tickets → evidências
```

## O que o produto não é

- não é inicialmente um clone completo do Linear;
- não substitui GitHub, GitLab ou Linear remoto;
- não deve criar uma segunda fonte de verdade fora do Git;
- não deve começar com colaboração em tempo real;
- não deve ser acoplado ao bundle de produção da biblioteca.

## Hipótese principal

Um conjunto de arquivos Markdown estruturados, visualizado por uma interface local, pode oferecer boa parte do valor de um sistema de gestão sem retirar o planejamento do fluxo de revisão, diff, branch e pull request.

## Referências encontradas

- Lovelace: planejamento local em Markdown, com issues, documentação, decisões e histórico de agentes.
- Pillar: rastreador de tarefas baseado em arquivos, com CLI e UI local.
- Beaver Backlog: issues Markdown versionadas dentro do repositório.
- Backstage TechDocs: documentação como código integrada a um portal.
- Storybook: referência de catálogo visual, estados e cenários interativos.

## Diferencial pretendido

Combinar docs-as-code, issue tracking local, especificações técnicas, ADRs, grafo de dependências e evidências de implementação em uma experiência voltada para engenharia frontend e agentes de código.

