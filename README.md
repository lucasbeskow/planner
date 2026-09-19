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

A CLI também pode ser usada por agentes e scripts:

```bash
yarn planner help
yarn planner status --json
yarn planner list planned --json
yarn planner show PLN-002 --json
yarn planner context PLN-009 --json
yarn planner validate
```

Para conectar um agente compatível com MCP, use o comando local por stdio:

```bash
yarn planner:mcp
```

O servidor expõe somente as ferramentas `planner_status`, `planner_list`, `planner_show`,
`planner_context` e `planner_validate`. A configuração do cliente deve apontar para o
comando acima na raiz deste repositório.

O guia de integração está em `docs/planner/integracao-agentes.md`. O workflow reutilizável dos agentes está em `.planner/skills/planner-workflow/`. Ele pode
ser empacotado ou instalado no diretório de skills do agente escolhido.

Cada ticket exibido pela UI informa também o caminho do arquivo que originou os dados.

Para testar, sirva a raiz do repositório por HTTP e abra `/planner/`. A leitura do índice usa `fetch` e não funciona corretamente via `file://`.

## Próximos passos

As próximas evoluções do Planner são operações de edição segura, criação de tickets por
template e integrações opcionais com serviços externos.
