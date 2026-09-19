# Planner local

Sistema de gestão local de engenharia, executado a partir do repositório consumidor.

## Objetivo

Renderizar uma visão de acompanhamento a partir de arquivos Markdown locais, sem exigir banco ou serviço remoto.

## Instalação local

O pacote ainda não é publicado em registry. Para usá-lo, instale a partir de um clone local
deste repositório. É preciso ter Node.js `>=22`.

1. Clone o Planner em um diretório da máquina:

   ```bash
   git clone https://github.com/lucasbeskow/planner.git ~/code/planner
   ```

2. Na raiz do repositório consumidor, instale o pacote apontando para esse diretório:

   ```bash
   npm install --save-dev ~/code/planner
   ```

   O npm cria um link simbólico em `node_modules/planner` e registra a dependência
   como `file:` no `package.json`. Alterações no clone do Planner valem na hora, sem reinstalar.
   O caminho gravado é relativo à máquina: quem clonar o repositório consumidor precisa do
   Planner no mesmo caminho ou precisa reinstalar com o próprio caminho.

3. Inicialize e confira a instalação:

   ```bash
   npx planner init
   npx planner validate
   ```

Para usar sem alterar o `package.json` do consumidor, crie um link global:

```bash
cd ~/code/planner && npm link
cd <repositorio-consumidor> && npm link planner
```

## Estado atual

O protótipo é uma UI estática. O índice `.planner/index.json` é uma projeção gerada a partir dos arquivos Markdown versionados e oferece:

- resumo da iniciativa e contadores por status;
- organização visual dos tickets em colunas;
- navegação entre resumo e detalhes;
- detalhe com corpo Markdown renderizado e progresso dos critérios de aceite;
- navegação entre dependências e dependentes;
- progresso dos critérios de aceite nos cards e destaque para tickets sem critérios;
- visualização de labels e fonte Markdown;
- mensagem orientativa quando o índice não pode ser carregado.

Para regenerar o índice depois de editar uma entidade à mão:

```bash
npx planner index
```

Para preparar uma aplicação consumidora pela primeira vez:

```bash
npx planner init
```

O comando cria `.planner/`, as fontes padrão, `config.json` e o índice inicial. Ele preserva
configurações existentes e pode ser executado novamente com segurança.

A CLI também pode ser usada por agentes e scripts:

```bash
npx planner help
npx planner status --json
npx planner list planned --json
npx planner show PLN-002 --json
npx planner context PLN-009 --json
npx planner validate --json
```

Para alterar `status`, `priority` ou `labels` sem editar o arquivo à mão:

```bash
npx planner set PLN-005 status=in_progress priority=high labels+=ui
npx planner set PLN-005 status=in_progress priority=high labels+=ui --yes
```

Sem `--yes`, o comando só mostra o diff. Com `--yes`, grava somente as linhas alteradas e
preserva comentários, ordem das chaves e corpo. `set` e `new` regeneram o índice na mesma
operação; se o índice não puder ser gravado, a entidade volta ao estado anterior.

Para criar um ticket a partir do template:

```bash
npx planner new "Exportar relatório" priority=high labels=ui depends_on=PLN-003
npx planner new "Exportar relatório" priority=high labels=ui depends_on=PLN-003 --yes
```

O id é o próximo livre do prefixo em uso (ou de `idPrefix`). O corpo vem de
`.planner/templates/<type>.md`, de `.planner/templates/default.md` ou do template padrão, com
`Objetivo` e `Critérios de aceite`. Templates contêm só o corpo e aceitam `{{id}}`, `{{title}}`
e `{{type}}`.

Mudanças de status seguem `draft → planned → in_progress → done`, com `blocked` a partir de
`in_progress` e `canceled` a partir de qualquer status não final. `done` exige dependências
concluídas ou canceladas. Quando a transição é recusada, a CLI lista os motivos; `--force`
permite reabrir ou pular etapas.

Para conectar um agente compatível com MCP, use o comando local por stdio:

```bash
npx planner-mcp
```

O servidor expõe somente as ferramentas `planner_status`, `planner_list`, `planner_show`,
`planner_context` e `planner_validate`. A configuração do cliente deve apontar para o
comando acima na raiz deste repositório.

A definição do produto (visão, restrições, requisitos e roadmap) está em `docs/prd.md`, fonte
única do projeto. O guia de integração está em `docs/integracao-agentes.md`. O workflow reutilizável dos agentes está em `skills/planner-workflow/`. Ele pode
ser empacotado ou instalado no diretório de skills do agente escolhido.

Cada ticket exibido pela UI informa também o caminho do arquivo que originou os dados.

Para abrir a UI, rode o servidor local e acesse `http://localhost:4400/planner/`:

```bash
npx planner-serve
```

O servidor escuta só em `127.0.0.1` e expõe apenas `planner/`, `.planner/` e `.git/HEAD`. A porta
pode ser alterada com `PLANNER_PORT`. A leitura do índice usa `fetch` e não funciona via `file://`.

## Configuração

`.planner/config.json` define as fontes lidas e os dados exibidos no cabeçalho:

- `sources`: diretórios de `.planner/` com entidades Markdown;
- `repository`: nome do repositório; sem ele, o Planner usa o `name` do `package.json`;
- `initiative`: título exibido na UI; sem ele, o Planner usa a primeira iniciativa ativa;
- `idPrefix`: prefixo dos ids criados por `planner new`; sem ele, o Planner usa o mais frequente.

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
O corpo completo fica disponível em `npx planner show <id>` e no detalhe da UI.

O diretório `.planner/` deste repositório é a fixture de demonstração: rode `npx planner-serve`
na raiz para ver a UI com o planejamento do próprio Planner.

## Próximos passos

As próximas evoluções do Planner são atualização do índice na mesma operação de escrita e integrações opcionais com
serviços externos. Os itens estão em `.planner/tickets/`.
