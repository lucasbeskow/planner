# Planner local

Primeiro protótipo do sistema de gestão local do repositório.

## Objetivo

Renderizar uma visão de acompanhamento a partir de um índice local, sem adicionar dependências ao pacote dos Web Components.

## Estado atual

O protótipo é uma UI estática. Ele usa `.planner/index.json` como fixture inicial e valida:

- organização visual;
- modelo de status;
- leitura de iniciativas e tickets;
- navegação entre resumo e detalhes;
- visualização de dependências.

Para testar, sirva a raiz do repositório por HTTP e abra `/planner/`. A leitura do índice usa `fetch` e não funciona corretamente via `file://`.

## Próximos passos

1. substituir a fixture por parser de Markdown;
2. validar frontmatter e relações;
3. gerar o índice automaticamente;
4. adicionar testes próprios do Planner;
5. definir o comando local de inicialização.

