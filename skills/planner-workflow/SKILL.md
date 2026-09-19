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

## Executar uma tarefa

1. Read the ticket, its dependencies, and the relevant implementation.
2. Define a small increment with an observable acceptance condition.
3. Implement only the requested scope and add focused tests.
4. Run relevant project checks and `npx planner validate` when Planner files or relations changed.
5. Update the ticket status and acceptance evidence only after the checks pass.
6. Regenerate the projection with `npx planner index`.
7. Report changed files, checks, evidence, and commit. Leave unresolved ambiguity as an explicit question.

## Limites

- Planner MCP tools are read-only; use the CLI and Markdown files for local execution.
- Do not expose commands that write files through MCP.
- Do not mark a task `done` without satisfying its acceptance criteria.
- Preserve unrelated work in the working tree.
