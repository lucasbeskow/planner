# Planner local

Primeiro protótipo do sistema de gestão local do repositório.

## Objetivo

Renderizar uma visão de acompanhamento a partir de um índice local, sem adicionar dependências ao pacote dos Web Components.

## Estado atual

O protótipo é uma UI estática. O índice `.planner/index.json` é uma projeção gerada a partir dos arquivos Markdown versionados e valida:

- organização visual;
- modelo de status;
- leitura de iniciativas e tickets;
- navegação entre resumo e detalhes;
- visualização de dependências.

Para regenerar o índice depois de editar uma entidade:

```bash
yarn planner:index
```

Cada ticket exibido pela UI informa também o caminho do arquivo que originou os dados.

Para testar, sirva a raiz do repositório por HTTP e abra `/planner/`. A leitura do índice usa `fetch` e não funciona corretamente via `file://`.

## Próximos passos

1. substituir a fixture por parser de Markdown;
2. validar frontmatter e relações;
3. gerar o índice automaticamente;
4. adicionar testes próprios do Planner;
5. definir o comando local de inicialização.
