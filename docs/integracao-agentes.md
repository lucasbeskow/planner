# Integração do Planner com agentes

O Planner oferece uma única fonte de domínio para agentes locais: os arquivos Markdown em
`.planner/`. A CLI e o MCP são adaptadores diferentes sobre o mesmo núcleo, portanto Codex,
Claude Code e outros clientes não precisam manter integrações específicas de dados.

## Contrato compartilhado

| Necessidade | CLI | MCP |
| --- | --- | --- |
| Resumo | `yarn planner status --json` | `planner_status` |
| Listagem | `yarn planner list [status] --json` | `planner_list` |
| Detalhe | `yarn planner show <id> --json` | `planner_show` |
| Contexto | `yarn planner context <id> --json` | `planner_context` |
| Validação | `yarn planner validate` | `planner_validate` |

Os comandos e ferramentas carregam os Markdown atuais. `.planner/index.json` é somente uma
projeção para a UI e não deve ser tratado como fonte de escrita.

## MCP local

O servidor usa stdio e pode ser apontado por um cliente MCP para o comando executado na raiz
do repositório:

```bash
yarn planner:mcp
```

O servidor não expõe criação, edição, execução de shell ou regeneração do índice. Para alterar
o plano, o agente deve editar os arquivos somente quando o usuário autorizar essa mudança,
depois executar `yarn planner validate` e `yarn planner:index`.

## Skill de workflow

A skill reutilizável está em `.planner/skills/planner-workflow/`. Ela documenta a sequência
de consulta, escolha da próxima tarefa, execução em incrementos testáveis e registro de
evidências. O diretório pode ser instalado no mecanismo de skills do agente utilizado, sem
alterar o contrato do Planner.

## Limites do MVP

- estado somente local e versionado;
- sem sincronização com Linear, GitHub ou serviços remotos;
- sem banco de dados;
- sem escrita implícita por chamadas de agente;
- qualquer edição relevante deve resultar em diff revisável.
