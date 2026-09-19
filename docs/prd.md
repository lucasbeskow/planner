# PRD — Planner local de engenharia

Status: `em validação`

Última atualização: `2026-09-19`

Este é o documento único de definição do produto. Ele substitui `proposta.md`, `sintese.md`
e `ice.md`. Está organizado pelo [ICE Framework](https://interloquial.com/ice.html):
**Intent, Constraints, Expectations**. Mudanças de escopo, restrições ou critérios devem ser
feitas aqui. O guia de uso por agentes está em `integracao-agentes.md`, e o processo de
execução de tickets está em `skills/planner-workflow/`.

## 1. Intent — intenção

### Visão

O Planner é um cockpit local de engenharia: a camada visual e operacional entre o
repositório, a especificação e a execução do trabalho. Ele roda a partir do repositório, lê
entidades Markdown versionadas em `.planner/` e oferece uma projeção navegável do
planejamento técnico para pessoas e agentes de código.

A referência de experiência é o Storybook. O Storybook organiza componentes, estados e
cenários. O Planner organiza o ciclo de vida da engenharia:

```text
objetivos → iniciativas → especificações → decisões → tickets → evidências
```

Esse ciclo é a visão completa. O estado atual cobre iniciativas, especificações, decisões,
tickets e ciclos; objetivos e evidências ainda não são tipos de entidade (seção 8).

### Problema

Planos, decisões e tarefas ficam distribuídos entre Markdown, branches, commits, pull requests,
conversas e ferramentas externas. Isso dificulta:

- descobrir o estado atual de uma iniciativa e o próximo trabalho;
- entender dependências;
- saber qual especificação originou uma tarefa;
- recuperar decisões e retomar o trabalho depois de uma pausa;
- fornecer contexto consistente a agentes de código;
- revisar a evolução do plano junto com o código.

### Hipótese

Um conjunto de arquivos Markdown estruturados, visualizado por uma interface local, pode
oferecer boa parte do valor de um sistema de gestão sem retirar o planejamento do fluxo de
revisão, diff, branch e pull request.

### Usuários

| Usuário | Situação | Valor esperado |
| --- | --- | --- |
| Desenvolvedor | Vai iniciar ou retomar uma tarefa | Encontra a próxima tarefa, seu estado, dependências e o arquivo que a originou |
| Tech lead/arquitetura | Revisa uma iniciativa | Entende estado, riscos, decisões e evolução sem reconstruir o histórico |
| Agente de código | Precisa executar trabalho no repositório | Consulta contexto estruturado, relações e validações por CLI ou MCP, sem integração de dados própria |
| Revisor | Avalia uma mudança | Relaciona a implementação ao ticket, à especificação e às evidências |

### Princípios

1. **Git-native** — os arquivos Markdown são a fonte de verdade.
2. **Local-first** — funciona sem serviços externos.
3. **Legível por humanos e agentes** — Markdown e metadados simples.
4. **Projeção, não duplicação** — índice e UI derivam dos arquivos e podem ser reconstruídos.
5. **Compatível com ferramentas existentes** — convive com issues, PRs, commits e Linear.
6. **Progressivo** — começa como leitor e evolui para editor seguro.
7. **Reversível** — toda alteração relevante gera diff compreensível.

### Diferencial

Combinar docs-as-code, issue tracking local, especificações técnicas, ADRs, grafo de
dependências e evidências de implementação em uma experiência voltada para engenharia e
agentes de código.

### Resultado mínimo significativo

Uma pessoa consegue inicializar o Planner em um repositório, abrir uma visão local da
iniciativa, identificar o backlog por status, consultar o contexto de um ticket e validar as
relações sem depender de banco, serviço remoto ou conta SaaS.

## 2. Constraints — restrições

### Produto e escopo

O Planner não é um clone completo do Linear e não substitui GitHub, GitLab, Linear remoto,
ferramentas de revisão ou deploy.

Fora do escopo do MVP:

- editar entidades pela UI, CLI ou MCP;
- impor transições de estado ou executar mudanças de status;
- renderizar o Markdown completo e os critérios de aceite na UI;
- grafo visual de dependências;
- sincronizar automaticamente com Linear, GitHub, GitLab ou outro SaaS;
- editar código, fazer deploy ou executar comandos sem confirmação;
- autenticação, colaboração em tempo real, notificações, editor WYSIWYG ou banco remoto.

### Técnicas

- Node.js `>=22`, sem dependências de runtime além das APIs do Node e do navegador.
- Comandos documentados: `planner init`, `planner-serve` e `planner-mcp`.
- Arquivos lidos em UTF-8, com finais de linha LF ou CRLF.
- Índice determinístico, regenerável e independente do branch atual.
- UI estática que consome `.planner/index.json` por HTTP local.
- CLI e MCP usam o mesmo núcleo de domínio.
- Persistência inicial no Git; banco local só se busca e indexação justificarem o custo.
- O Planner fica em pacote próprio e não entra no bundle de produção do repositório consumidor.

### Domínio

Tipos aceitos:

```text
initiative | task | decision | spec | cycle
```

Status aceitos:

```text
draft | planned | in_progress | blocked | done | canceled
```

- Toda entidade tem `id` único e `title`.
- `depends_on` é uma lista; dependências inexistentes e ciclos, incluindo auto-dependência,
  são inválidos.
- O índice nunca é fonte de escrita.

O runtime valida os valores de status, mas não implementa uma máquina de transições. O fluxo
abaixo é orientação de processo:

```text
draft → planned → in_progress → done
                    ↓      ↑
                   blocked
     (qualquer estado não final) → canceled
```

A iniciativa ativa é a primeira entidade `initiative` que não esteja `done` ou `canceled`; sem
ela, usa-se a primeira iniciativa encontrada. O nome do repositório vem de
`.planner/config.json`, do `package.json` ou do nome do diretório, nessa ordem.

### Segurança e reversibilidade

- O servidor HTTP escuta somente em `127.0.0.1` e expõe apenas a UI, `.planner/` e
  `.git/HEAD`; métodos diferentes de `GET`/`HEAD` e traversal de diretórios são rejeitados.
- O MCP é somente leitura: não cria, edita, executa shell nem regenera o índice.
- Nenhum comando é executado pela UI ou pelo MCP sem consentimento explícito.
- Toda alteração futura de entidades deve gerar diff compreensível e revisável.
- Erros de validação indicam o arquivo ou id afetado; a CLI retorna código diferente de zero.

## 3. Estado atual

O repositório entrega o runtime reutilizável `planner` e versiona uma instância `.planner/`
própria, que planeja o próprio Planner e serve de fixture para demonstração manual. Os testes
automatizados criam fixtures temporárias e verificam apenas que a instância versionada é válida
e que o índice dela está atualizado.

### Arquitetura

```text
arquivos Markdown em .planner/
             │
             ▼
       core/planner.js
        ┌────┼─────┐
        ▼    ▼     ▼
      CLI   MCP    índice JSON
                     │
                     ▼
                    UI
```

- `core/planner.js` concentra parser, leitura, resumo, projeção, contexto e validação;
- `cli.js` oferece consulta, inicialização e regeneração do índice;
- `mcp.js` adapta o mesmo domínio ao protocolo MCP por stdio;
- `serve.js` serve a UI e os arquivos mínimos necessários para a leitura local;
- `app.js` renderiza a projeção, o branch atual e o painel de detalhes no navegador;
- `markdown.mjs` renderiza o corpo Markdown do detalhe, sem dependências, escapando HTML;
- `tests/planner.node.js` verifica os contratos observáveis.

### Requisitos funcionais

#### RF01 — Inicialização e descoberta

`planner init` cria `.planner/`, as fontes padrão (`initiatives`, `tickets`, `specs`,
`decisions`, `cycles`), `config.json` e o índice inicial, sem sobrescrever configuração
existente. A leitura ocorre na raiz atual ou na raiz indicada por `PLANNER_ROOT`; não há busca
ascendente por um repositório.

#### RF02 — Projeção e dashboard

O índice contém nome do repositório, iniciativa, resumo por status e entidades projetadas com
descrição resumida, labels, prioridade, fase, dependências e caminho do arquivo fonte. A UI
mostra contadores, iniciativas e tickets agrupados por status, omitindo colunas opcionais sem
itens.

#### RF03 — Entidades e formato

O frontmatter aceita escalares, listas em bloco, listas inline, booleanos, números, strings
entre aspas e comentários. Objetos aninhados, textos multilinha e âncoras não fazem parte do
contrato. O formato detalhado está no `README.md`.

Campos do domínio: `id`, `type`, `title`, `status`, `priority`, `phase`, `labels` e
`depends_on`. `depends_on` é exposto como `dependsOn` nas saídas estruturadas.

#### RF04 — Consulta de detalhes

`planner show <id>` e `planner_show` retornam metadados, corpo Markdown, descrição resumida e
caminho do arquivo fonte. A UI abre um painel com metadados, labels, dependências, dependentes
e fonte, e renderiza o corpo buscando o Markdown de origem. Quando há seção `Critérios de aceite`,
o painel mostra quantos itens do checklist estão concluídos. O corpo não entra no índice.

#### RF05 — Relações

`planner context <id>` e `planner_context` retornam a entidade, suas dependências, seus
dependentes e as validações relacionadas. A UI lista dependências e dependentes como links que
abrem o detalhe da entidade; ids ausentes do índice aparecem destacados. Não há grafo visual.

#### RF06 — Fonte de verdade

Arquivos Markdown versionados são a fonte de escrita e de domínio. `.planner/index.json` é uma
projeção regenerável e não deve ser editado manualmente.

#### RF07 — Validação

`planner validate` e `planner_validate` detectam id ou título ausente, ids duplicados, tipos e
status inválidos, `depends_on` que não seja lista, dependências inexistentes e ciclos.

#### RF08 — Integração com agentes

CLI e MCP retornam contratos equivalentes:

| Necessidade | CLI | MCP | Saída |
| --- | --- | --- | --- |
| Resumo | `planner status --json` | `planner_status` | Iniciativa e contadores por status |
| Listagem | `planner list [status] --json` | `planner_list` | Entidades filtráveis por status |
| Detalhe | `planner show <id> --json` | `planner_show` | Metadados, corpo e fonte |
| Contexto | `planner context <id> --json` | `planner_context` | Entidade, dependências, dependentes e validações |
| Validação | `planner validate --json` | `planner_validate` | `valid`, erros e total de entidades |

## 4. Expectations — expectativas

### Experiência esperada

1. O usuário executa `npx planner init` sem perder configuração existente.
2. O comando cria as fontes padrão e um índice inicial regenerável.
3. `npx planner-serve` disponibiliza a UI em `http://localhost:4400/planner/`.
4. A UI mostra repositório, branch atual, iniciativa, contadores e tickets agrupados por status.
5. Ao abrir um ticket, o usuário vê título, tipo, status, prioridade, fase, labels,
   dependências, dependentes, progresso dos critérios de aceite, corpo e arquivo fonte.
6. Pela CLI ou MCP, o usuário obtém o corpo completo, dependências, dependentes e validações.
7. `planner validate` aponta ids duplicados, campos ausentes, referências quebradas e ciclos.
8. Depois de editar os Markdown, `planner index` reproduz a projeção sem intervenção manual.

### Critérios de aceite do M0

- [x] o pacote inicializa um repositório sem apagar configuração existente;
- [x] o dashboard é servido localmente sem serviço remoto;
- [x] o índice é regenerável e determinístico a partir dos Markdown;
- [x] tickets aparecem agrupados por status;
- [x] detalhes estruturados incluem dependências, labels, metadados e fonte;
- [x] CLI e MCP expõem consultas equivalentes, incluindo dependentes;
- [x] ids duplicados, dependências ausentes e ciclos são reportados;
- [x] o MCP não expõe escrita, execução de shell ou regeneração do índice;
- [x] o servidor HTTP rejeita métodos não suportados e tentativas de escapar do diretório;
- [x] fixture `.planner/` versionada para demonstração manual;
- [x] corpo Markdown e critérios de aceite renderizados na UI;
- [x] navegação por dependentes ou grafo de relações na UI;
- [x] teste de integração do servidor HTTP passando em ambientes que permitem bind local.

### Como validar

```bash
npm test
npx planner init
npx planner validate --json
npx planner index
npx planner-serve
npx planner-mcp
```

`npm test` cobre 36 cenários automatizados. Em ambientes restritos, o cenário que abre um
socket local pode falhar com `EPERM` por limitação do ambiente, sem indicar falha da regra de
roteamento testada.

### Fechamento de tickets

Um ticket só é marcado como `done` quando os critérios de aceite aplicáveis estiverem
verificados e a evidência de execução estiver registrada com:

- `harness`: ferramenta ou ambiente de execução utilizado;
- `model`: modelo usado pelo agente, quando houver;
- `effort`: configuração de esforço/raciocínio do modelo, por exemplo `medium`, `high` ou
  `xhigh` (não representa esforço humano estimado);
- `tokens`: total de tokens gastos na execução, quando disponível;
- `completed_at`: data e hora do fechamento;
- `validation`: comandos, testes ou verificações executados;
- limitações conhecidas, quando houver.

A evidência fica no Markdown versionado do ticket ou em uma entidade referenciada por ele.
Valores indisponíveis não devem ser inventados: usar `unknown` ou registrar a justificativa.
Este contrato ainda é de processo: o runtime não valida nem projeta esses campos.

## 5. Roadmap

### M1 — edição segura

- alterar status, prioridade e labels com diff revisável;
- criar ticket a partir de template;
- validar transições antes de salvar;
- atualizar o índice automaticamente após escrita autorizada.

### M2 — contexto de engenharia

- mostrar grafo visual de dependências;
- listar especificações e decisões recentes na UI;
- validar links, critérios de aceite e referências externas;
- apontar tickets sem critérios de aceite;
- relacionar ticket, commit e pull request;
- registrar e projetar evidências de execução.

### M3 — integrações opcionais

- sincronização explícita com Linear e GitHub/GitLab;
- comentários e revisão remota;
- múltiplos repositórios;
- persistência adicional somente se a busca justificar.

## 6. Riscos

- duplicar funcionalidades já existentes em Linear/GitHub e aumentar o escopo;
- transformar o índice em uma segunda fonte de verdade;
- permitir que a edição automática gere diffs difíceis de revisar;
- criar um formato proprietário difícil de migrar;
- confundir falha de ambiente (por exemplo, bind local bloqueado) com falha funcional;
- ampliar o MVP antes de validar o fluxo local com uma fixture real.

## 7. Métricas de validação

Ainda não há instrumentação no produto. Quando houver uso real, acompanhar:

- tempo para encontrar a próxima tarefa;
- tempo para entender o contexto de um ticket;
- quantidade de decisões recuperáveis sem histórico de conversa;
- quantidade de arquivos necessários para retomar uma iniciativa;
- tempo de inicialização local;
- número de dependências novas introduzidas;
- quantidade de erros de validação encontrados antes do commit;
- distribuição de `effort`, `harness` e `model` por ticket concluído;
- tokens médios e totais por ticket concluído;
- tempo entre o início da execução e o fechamento do ticket.

## 8. Decisões em aberto

- Evidência de execução: seção no ticket ou entidade `evidence` separada?
- Objetivos: tipo `objective` próprio ou campo da iniciativa?
- Como normalizar tokens quando harnesses reportam métricas incompatíveis?
- Quais campos de execução entram no índice e quais ficam apenas no detalhe?
- Como representar tickets concluídos antes da adoção do contrato de evidências?

## 9. Referências

- [ICE Framework](https://interloquial.com/ice.html): método usado para estruturar este documento.
- Lovelace: planejamento local em Markdown, com issues, documentação, decisões e histórico de agentes.
- Pillar: rastreador de tarefas baseado em arquivos, com CLI e UI local.
- Beaver Backlog: issues Markdown versionadas dentro do repositório.
- Backstage TechDocs: documentação como código integrada a um portal.
- Storybook: referência de catálogo visual, estados e cenários interativos.
