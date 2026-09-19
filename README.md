# Planner local

Primeiro protótipo do sistema de gestão local do repositório.

## Objetivo

Renderizar uma visão de acompanhamento a partir de um índice local, sem adicionar dependências ao pacote dos Web Components.

## Estado atual

O protótipo é uma UI estática. O índice `.planner/index.json` é uma projeção gerada a partir dos arquivos Markdown versionados e oferece:

- resumo da iniciativa e contadores por status;
- organização visual dos tickets em colunas;
- navegação entre resumo e detalhes;
- visualização de dependências, labels e fonte Markdown;
- mensagem orientativa quando o índice não pode ser carregado.

Para regenerar o índice depois de editar uma entidade:

```bash
yarn planner:index
```

Cada ticket exibido pela UI informa também o caminho do arquivo que originou os dados.

Para testar, sirva a raiz do repositório por HTTP e abra `/planner/`. A leitura do índice usa `fetch` e não funciona corretamente via `file://`.

## Próximos passos

1. definir a CLI semântica do Planner;
2. expor uma integração local somente leitura para agentes;
3. criar a skill de workflow do Planner.
