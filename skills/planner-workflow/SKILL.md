---
name: planner-workflow
description: Use the repository-local Planner to inspect engineering context, choose the next executable task, validate changes, and record evidence in Markdown. Apply when a user asks to continue the Planner, execute the next task, or consult ticket/dependency context.
---

# Planner workflow

Use the Planner files as the source of truth. The generated `.planner/index.json` is a projection and must not be edited manually.

## Consultar contexto

Run these commands from the consumer repository root:

```bash
npx planner status --json
npx planner list planned --json
npx planner context <ID> --json
npx planner validate
```

Before selecting work, inspect the ticket Markdown. Respect `status`, `priority`, `phase`, and `depends_on`. Prefer an existing `in_progress` task when it is executable; otherwise choose the highest-priority unblocked task in the current phase. Do not start blocked work or silently change the planned order when the choice materially affects scope.

## Revisão crítica antes de implementar

Before implementing a relevant increment, review the plan from at least one critical persona:

| Persona | Main question |
| --- | --- |
| Skeptical user | Does this really reduce the time to find and understand the work? |
| Security auditor | Can any file, command, or data be exposed beyond what is needed? |
| Edge-case tester | What happens with invalid frontmatter, cycles, duplicate ids, and a missing index? |
| Maintainer | Does the contract stay simple, deterministic, and easy to migrate? |
| Cost accountant | Does the increment add dependencies, tokens, or scope without clear return? |
| Product reviewer | Are we building observable value or just another projection? |

Answer these questions before advancing:

- Which user problem does this increment solve?
- What is explicitly not being built now?
- How will success be observed without relying on the agent's confidence?
- Which file is the source of truth?
- What is the rollback plan if the change produces invalid data?
- Which harness, model, effort, and token usage will be recorded at closing?

## Executar uma tarefa

1. Read the ticket, its dependencies, and the relevant implementation.
2. Resolve ambiguity with questions; record constraints and acceptance criteria in the ticket. Create new tickets with `npx planner new "<title>" [field=value]...`, review the output, then repeat with `--yes`.
3. Run the critical review above and define a small increment with an observable acceptance condition.
4. Implement only the requested scope and add focused tests.
5. Run relevant project checks and `npx planner validate` when Planner files or relations changed.
6. Update the ticket status and acceptance evidence only after the checks pass. Change `status`, `priority`, and `labels` with `npx planner set <ID> status=done`: review the printed diff, then repeat with `--yes`. If the transition is refused, resolve the listed reasons; use `--force` only when the user explicitly asks to reopen or skip a step. The evidence records `harness`, `model`, `effort`, `tokens`, `completed_at`, and `validation`; use `unknown` or a justification instead of inventing values (see `docs/prd.md`, "Fechamento de tickets").
7. `planner set` and `planner new` regenerate the projection; after manual Markdown edits, run `npx planner index`.
8. Report changed files, checks, evidence, and commit. Leave unresolved ambiguity as an explicit question.

## Limites

- Planner MCP tools are read-only; use the CLI and Markdown files for local execution.
- Do not expose commands that write files through MCP.
- Do not mark a task `done` without satisfying its acceptance criteria.
- Preserve unrelated work in the working tree.
