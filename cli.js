#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { buildIndex, contextFor, readEntities, validate } = require('./core/planner');

const root = path.resolve(process.env.PLANNER_ROOT || process.cwd());
const DEFAULT_SOURCES = ['initiatives', 'tickets', 'specs', 'decisions', 'cycles'];
const rawArguments = process.argv.slice(2);
const isFlag = value => value.startsWith('-');
const flags = new Set(rawArguments.filter(isFlag));
const positional = rawArguments.filter(value => !isFlag(value));
const [command = 'status', argument] = positional;

const usage = `Uso: npx planner <comando> [argumento] [--json]

Comandos:
  status                 resumo por status
  init                   inicializa .planner no repositório atual
  list [status]          lista entidades, opcionalmente filtradas
  show <id>              mostra uma entidade
  context <id>           mostra dependências e dependentes
  validate               valida entidades e dependências
  index                  regenera o índice derivado
  help, -h, --help       mostra esta ajuda

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

function initCommand() {
  const plannerRoot = path.join(root, '.planner');
  const created = [];
  fs.mkdirSync(plannerRoot, { recursive: true });

  for (const source of DEFAULT_SOURCES) {
    const directory = path.join(plannerRoot, source);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      created.push(path.relative(root, directory));
    }
  }

  const configPath = path.join(plannerRoot, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify({ sources: DEFAULT_SOURCES, index: 'index.json' }, null, 2)}\n`);
    created.push(path.relative(root, configPath));
  }

  const entities = readEntities(root);
  const errors = validate(entities);
  if (errors.length) throw new Error(`não foi possível inicializar: ${errors.join('; ')}`);

  const indexPath = path.join(plannerRoot, 'index.json');
  fs.writeFileSync(indexPath, `${JSON.stringify(buildIndex(root, entities), null, 2)}\n`);
  if (!created.includes(path.relative(root, indexPath))) created.push(path.relative(root, indexPath));

  output(flags.has('--json')
    ? { root, created, entities: entities.length }
    : `Planner inicializado em ${path.relative(process.cwd(), plannerRoot) || '.planner'} (${entities.length} entidades)`);
}

if (flags.has('--help') || flags.has('-h') || command === 'help') {
  console.log(usage);
} else {
  try {
    const entities = readEntities(root);

    switch (command) {
      case 'init':
        initCommand();
        break;
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
        output(flags.has('--json') ? entity : `${entity.id}\n${entity.title}\n\n${entity.body}\n\nArquivo: ${entity.filePath}`);
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
        if (errors.length) process.exitCode = 1;
        if (flags.has('--json')) {
          output({ valid: errors.length === 0, errors, total: entities.length });
        } else if (errors.length) {
          console.error(errors.map(error => `✗ ${error}`).join('\n'));
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
