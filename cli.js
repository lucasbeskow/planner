#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { applyCreate, planCreate } = require('./core/create');
const { applyEdit, planEdit } = require('./core/edit');
const { buildIndex, contextFor, readEntities, validate } = require('./core/planner');

const root = path.resolve(process.env.PLANNER_ROOT || process.cwd());
const DEFAULT_SOURCES = ['initiatives', 'tickets', 'specs', 'decisions', 'cycles'];
const rawArguments = process.argv.slice(2);
const isFlag = value => value.startsWith('-');
const flags = new Set(rawArguments.filter(isFlag));
const positional = rawArguments.filter(value => !isFlag(value));
const [command = 'status', argument, ...rest] = positional;

const usage = `Uso: npx planner <comando> [argumento] [--json]

Comandos:
  status                 resumo por status
  init                   inicializa .planner no repositório atual
  list [status]          lista entidades, opcionalmente filtradas
  show <id>              mostra uma entidade
  context <id>           mostra dependências e dependentes
  validate               valida entidades e dependências
  set <id> <campo=valor>...
                         mostra o diff de status, priority ou labels;
                         grava somente com --yes; --force permite
                         transições de status fora do fluxo
  new <título> [campo=valor]...
                         mostra o arquivo de um novo ticket a partir do
                         template; grava somente com --yes
  index                  regenera o índice derivado
  help, -h, --help       mostra esta ajuda

Em set, status segue draft → planned → in_progress → done, com blocked a partir de
in_progress e canceled a partir de qualquer status não final. done exige dependências
concluídas ou canceladas; iniciativas não contam como dependência.
Em new, os campos aceitos são type, status, priority, phase, labels e depends_on
(listas separadas por vírgula). O template vem de .planner/templates/<type>.md,
.planner/templates/default.md ou do padrão embutido.
Em set, labels aceita labels=a,b (substitui), labels+=a e labels-=a.

--json retorna dados estruturados para agentes e scripts.
--yes confirma a gravação dos comandos que alteram arquivos.`;

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

// Sem --yes, set só mostra o diff: nenhuma escrita acontece sem confirmação explícita.
function setCommand() {
  const plan = planEdit(root, argument, rest, { force: flags.has('--force') });
  const write = flags.has('--yes') && plan.changes.length > 0;
  if (write) applyEdit(root, plan);

  if (flags.has('--json')) {
    output({ id: plan.id, file: plan.file, changes: plan.changes, diff: plan.diff, written: write });
  } else if (!plan.changes.length) {
    output(`${plan.id}: nenhuma alteração; os valores já estão aplicados`);
  } else {
    output(`${plan.diff}\n\n${write
      ? `Gravado em ${plan.file}. Rode npx planner index para atualizar a UI.`
      : 'Nenhuma alteração gravada. Repita com --yes para gravar.'}`);
  }
}

function newCommand() {
  const plan = planCreate(root, argument, rest);
  const write = flags.has('--yes');
  if (write) applyCreate(root, plan);

  if (flags.has('--json')) {
    output({ id: plan.id, file: plan.file, template: plan.template, content: plan.content, diff: plan.diff, written: write });
  } else {
    output(`${plan.diff}\n\n${write
      ? `Criado ${plan.id} em ${plan.file}. Rode npx planner index para atualizar a UI.`
      : 'Nenhum arquivo criado. Repita com --yes para criar.'}`);
  }
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
      case 'new':
        newCommand();
        break;
      case 'set':
        setCommand();
        break;
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
