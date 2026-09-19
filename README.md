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
yarn planner validate --json
```

Para conectar um agente compatível com MCP, use o comando local por stdio:

```bash
yarn planner:mcp
```

O servidor expõe somente as ferramentas `planner_status`, `planner_list`, `planner_show`,
`planner_context` e `planner_validate`. A configuração do cliente deve apontar para o
comando acima na raiz deste repositório.

O guia de integração está em `planner/docs/integracao-agentes.md`. O workflow reutilizável dos agentes está em `.planner/skills/planner-workflow/`. Ele pode
ser empacotado ou instalado no diretório de skills do agente escolhido.

Cada ticket exibido pela UI informa também o caminho do arquivo que originou os dados.

Para abrir a UI, rode o servidor local e acesse `http://localhost:4400/planner/`:

```bash
yarn planner:serve
```

O servidor escuta só em `127.0.0.1` e expõe apenas `planner/`, `.planner/` e `.git/HEAD`. A porta
pode ser alterada com `PLANNER_PORT`. A leitura do índice usa `fetch` e não funciona via `file://`.

## Configuração

`.planner/config.json` define as fontes lidas e os dados exibidos no cabeçalho:

- `sources`: diretórios de `.planner/` com entidades Markdown;
- `repository`: nome do repositório; sem ele, o Planner usa o `name` do `package.json`;
- `initiative`: título exibido na UI; sem ele, o Planner usa a primeira iniciativa ativa.

A CLI e o MCP aceitam `PLANNER_ROOT` para ler outro repositório.

## Formato do frontmatter

O parser aceita um subconjunto de YAML, sem dependências:

- `chave: valor`, com espaço depois dos dois-pontos;
- `true` e `false` viram booleanos;
- números viram números, exceto quando têm zeros à esquerda, como `001`, que permanecem texto;
- valores entre aspas simples ou duplas permanecem texto;
- listas em bloco, com itens `- valor` nas linhas seguintes à chave;
- listas inline, como `[core, "a, b"]`; vírgulas entre aspas não separam itens;
- chave sem valor e sem itens resulta em `null`;
- `#` inicia um comentário quando aparece no começo da linha ou depois de um espaço, fora de aspas.

Objetos aninhados, textos em várias linhas e âncoras não são aceitos. Linhas fora desse formato
geram erro com o caminho do arquivo.

A descrição exibida nos cards é o primeiro parágrafo da seção `Objetivo` ou, sem ela, do corpo.
O corpo completo fica disponível em `yarn planner show <id>`.

## Próximos passos

As próximas evoluções do Planner são operações de edição segura, criação de tickets por
template e integrações opcionais com serviços externos.
