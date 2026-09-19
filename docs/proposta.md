# Planner — proposta do produto

## Nome provisório

`Planner`

## Posicionamento

Um cockpit local de engenharia: a camada visual e operacional entre o repositório, a especificação e a execução do trabalho.

## Princípios

1. **Git-native** — os arquivos são a fonte de verdade.
2. **Local-first** — deve funcionar sem serviços externos.
3. **Legível por humanos e agentes** — Markdown e metadados simples.
4. **Projeção, não duplicação** — a UI deriva dos arquivos e pode ser reconstruída.
5. **Compatível com ferramentas existentes** — links para issues, PRs, commits e Linear.
6. **Progressivo** — começa como leitor e evolui para editor e executor.
7. **Reversível** — toda ação relevante deve gerar diff compreensível.

## Modelo conceitual

```text
Repository
├── initiatives
├── specs
├── decisions
├── tickets
├── cycles
├── evidence
└── index
```

Cada entidade possui metadados comuns:

```yaml
id: F1-002
type: task
title: Corrigir retry de 401
status: planned
priority: high
phase: F1
depends_on:
  - F0-001
labels:
  - architecture
```

## Experiência inicial

O usuário executa uma única interface local e encontra:

- resumo da iniciativa atual;
- contadores por estado;
- board de tickets;
- lista de especificações;
- decisões recentes;
- dependências e bloqueios;
- link para o arquivo fonte;
- indicação do branch e commit atual.

## Roadmap de produto

### M0 — leitura e visualização

- carregar um índice local;
- mostrar dashboard;
- mostrar tickets agrupados por status;
- abrir detalhes;
- exibir dependências.

### M1 — edição segura

- alterar status;
- editar prioridade e labels;
- criar ticket a partir de template;
- salvar alterações como arquivos Markdown;
- validar frontmatter.

### M2 — engenharia assistida

- validar links e dependências;
- apontar tickets sem critérios de aceite;
- relacionar ticket, commit e PR;
- gerar checklist de execução;
- oferecer contexto estruturado para agentes;
- disponibilizar uma CLI semântica;
- expor MCP local somente leitura;
- distribuir skills de workflow para Codex e Claude Code.

### M3 — integrações opcionais

- sincronização com Linear;
- GitHub/GitLab;
- MCP;
- comentários e revisão remota;
- múltiplos repositórios.

## Decisões técnicas iniciais

- O planner fica em diretórios próprios e não entra no bundle dos componentes.
- A primeira UI será estática e sem dependências novas.
- O índice inicial será JSON gerado ou mantido junto dos arquivos de planejamento.
- O formato final das entidades será Markdown com frontmatter YAML.
- A persistência inicial será Git; banco local só será considerado quando a busca e a indexação justificarem.

## Fora de escopo do primeiro incremento

- autenticação;
- colaboração em tempo real;
- notificações;
- banco remoto;
- sincronização bidirecional com Linear;
- editor WYSIWYG;
- execução arbitrária de comandos pela UI.
