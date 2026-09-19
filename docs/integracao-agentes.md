# Integração do Planner com agentes

Guia de uso. A definição do produto, incluindo contratos e restrições, está em `prd.md`.

O Planner oferece uma única fonte de domínio para agentes locais: os arquivos Markdown em
`.planner/`. A CLI e o MCP são adaptadores diferentes sobre o mesmo núcleo, portanto Codex,
Claude Code e outros clientes não precisam manter integrações específicas de dados.

## Contrato compartilhado

| Necessidade | CLI | MCP |
| --- | --- | --- |
| Resumo | `npx planner status --json` | `planner_status` |
| Listagem | `npx planner list [status] --json` | `planner_list` |
| Detalhe | `npx planner show <id> --json` | `planner_show` |
| Contexto (inclui commits locais que citam o id) | `npx planner context <id> --json` | `planner_context` |
| Validação | `npx planner validate --json` | `planner_validate` |

Os comandos e ferramentas carregam os Markdown atuais. `.planner/index.json` é somente uma
projeção para a UI e não deve ser tratado como fonte de escrita.

## MCP local

O servidor usa stdio e pode ser apontado por um cliente MCP para o comando executado na raiz
do repositório:

```bash
npx planner-mcp
```

O servidor não expõe criação, edição, execução de shell ou regeneração do índice. Para alterar
o plano, o agente deve editar os arquivos somente quando o usuário autorizar essa mudança,
depois executar `npx planner validate` e `npx planner index`. `planner set` e `planner new`
já regeneram o índice na mesma escrita.

Para status, prioridade e labels, prefira a CLI, que mostra o diff antes de gravar:

```bash
npx planner set PLN-005 status=in_progress labels+=ui   # só mostra o diff
npx planner set PLN-005 status=in_progress labels+=ui --yes
```

Para registrar trabalho novo, gere o ticket pelo template em vez de escrever o frontmatter:

```bash
npx planner new "Título do ticket" priority=high depends_on=PLN-005   # só mostra o arquivo
npx planner new "Título do ticket" priority=high depends_on=PLN-005 --yes
```

Ao concluir, registre a evidência lida do harness em vez de escrevê-la à mão:

```bash
npx planner evidence PLN-005 validation="npm test (57 cenários)"         # só mostra o diff
npx planner evidence PLN-005 validation="npm test (57 cenários)" --yes
npx planner set PLN-005 status=done --yes
```

No Claude Code, modelo, effort e tokens vêm dos transcripts locais, na janela entre
`status=in_progress` e a conclusão. Em outros harnesses, informe `harness=`, `model=`,
`effort=`, `tokens=` e `completed_at=`.

Transições fora do fluxo, como concluir um ticket com dependências abertas, são recusadas com
os motivos. Use `--force` somente quando o usuário pedir para reabrir ou pular uma etapa.

## Skill de workflow

A skill reutilizável está em `skills/planner-workflow/`. Ela documenta a sequência
de consulta, escolha da próxima tarefa, revisão crítica, execução em incrementos testáveis e
registro de evidências. O diretório pode ser instalado no mecanismo de skills do agente utilizado, sem
alterar o contrato do Planner.

## Limites do MVP

- estado somente local e versionado;
- sem sincronização com Linear, GitHub ou serviços remotos;
- sem banco de dados;
- sem escrita implícita por chamadas de agente;
- qualquer edição relevante deve resultar em diff revisável.
