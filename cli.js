#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildIndex, contextFor, readEntities, validate } = require('./core/planner');

const root = path.resolve(process.env.PLANNER_ROOT || path.join(__dirname, '..'));
const rawArguments = process.argv.slice(2);
const flags = new Set(rawArguments.filter(value => value.startsWith('--')));
const positional = rawArguments.filter(value => !value.startsWith('--'));
const [command = 'status', argument] = positional;

const usage = `Uso: yarn planner <comando> [argumento] [--json]

Comandos:
  status                 resumo por status
  list [status]          lista entidades, opcionalmente filtradas
  show <id>              mostra uma entidade
  context <id>           mostra dependências e dependentes
  validate               valida entidades e dependências
  index                  regenera o índice derivado
  help                   mostra esta ajuda

--json retorna dados estruturados para agentes e scripts.`;

function output(value) {
  if (flags.has('--json')) console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

function indexCommand() {
  const entities = readEntities(root);
  const index = buildIndex(root, entities);
  fs.writeFileSync(path.join(root, '.planner', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  output(`Índice atualizado: ${entities.length} entidades`);
}

if (flags.has('--help') || flags.has('-h') || command === 'help') {
  console.log(usage);
} else {
  try {
    const entities = readEntities(root);

    switch (command) {
      case 'status':
        output(buildIndex(root, entities).summary);
        break;
      case 'list': {
        const filtered = argument ? entities.filter(entity => entity.status === argument) : entities;
        output(flags.has('--json') ? filtered : filtered.map(entity => `${entity.id} [${entity.status}] ${entity.title}`).join('\n'));
        break;
      }
      case 'show': {
        if (!argument) throw new Error('informe o id da entidade para show');
        const entity = entities.find(item => item.id === argument);
        if (!entity) throw new Error(`Entidade não encontrada: ${argument}`);
        output(flags.has('--json') ? entity : `${entity.id}\n${entity.title}\n\n${entity.description}\n\nArquivo: ${entity.filePath}`);
        break;
      }
      case 'context': {
        if (!argument) throw new Error('informe o id da entidade para context');
        const context = contextFor(entities, argument);
        if (!context) throw new Error(`Entidade não encontrada: ${argument}`);
        output(flags.has('--json') ? context : JSON.stringify(context, null, 2));
        break;
      }
      case 'validate': {
        const errors = validate(entities);
        if (errors.length) {
          console.error(errors.map(error => `✗ ${error}`).join('\n'));
          process.exitCode = 1;
        } else {
          output(`✓ ${entities.length} entidades válidas`);
        }
        break;
      }
      case 'index':
        indexCommand();
        break;
      default:
        throw new Error(`comando desconhecido: ${command}\n\n${usage}`);
    }
  } catch (error) {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
  }
}
