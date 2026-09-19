const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SOURCES = ['initiatives', 'tickets', 'specs', 'decisions', 'cycles'];

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1).split(',').map(item => parseScalar(item)).filter(item => item !== '');
  }
  return trimmed;
}

function parseFrontmatter(source, filePath) {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { attributes: {}, body: source.trim(), filePath };
  }

  const end = lines.indexOf('---', 1);
  if (end < 0) throw new Error(`${filePath}: frontmatter não terminou com ---`);

  const attributes = {};
  let currentArray;
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && currentArray) {
      currentArray.push(parseScalar(arrayItem[1]));
      continue;
    }
    const field = line.match(/^([A-Za-z_][\w-]*):(?:\s*(.*))?$/);
    if (!field) throw new Error(`${filePath}: linha inválida no frontmatter: ${line}`);
    const [, key, rawValue = ''] = field;
    if (rawValue.trim() === '') {
      attributes[key] = [];
      currentArray = attributes[key];
    } else {
      attributes[key] = parseScalar(rawValue);
      currentArray = null;
    }
  }

  return { attributes, body: lines.slice(end + 1).join('\n').trim(), filePath };
}

function readConfig(root) {
  const configPath = path.join(root, '.planner', 'config.json');
  if (!fs.existsSync(configPath)) return { sources: DEFAULT_SOURCES, index: 'index.json' };
  return { sources: DEFAULT_SOURCES, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
}

function readEntities(root) {
  const plannerRoot = path.join(root, '.planner');
  const config = readConfig(root);
  const files = config.sources.flatMap(source => {
    const directory = path.join(plannerRoot, source);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).filter(file => file.endsWith('.md')).map(file => path.join(directory, file));
  });

  const entities = files.map(filePath => {
    const parsed = parseFrontmatter(fs.readFileSync(filePath, 'utf8'), path.relative(root, filePath));
    return {
      ...parsed.attributes,
      dependsOn: parsed.attributes.depends_on || [],
      description: parsed.body.split('\n').filter(line => line.trim() && !line.startsWith('#')).join(' ').trim(),
      filePath: path.relative(root, filePath)
    };
  });

  // A ordem de readdirSync varia entre sistemas de arquivos; ordenar mantém o índice determinístico.
  const sortKey = entity => String(entity.id ?? entity.filePath);
  return entities.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
}

function validate(entities) {
  const errors = [];
  const ids = new Set();
  const allowedTypes = new Set(['initiative', 'task', 'decision', 'spec', 'cycle']);
  const allowedStatuses = new Set(['draft', 'planned', 'in_progress', 'blocked', 'done', 'canceled']);

  for (const entity of entities) {
    if (!entity.id) errors.push(`${entity.filePath}: id obrigatório`);
    if (!entity.title) errors.push(`${entity.filePath}: title obrigatório`);
    if (ids.has(entity.id)) errors.push(`${entity.filePath}: id duplicado ${entity.id}`);
    ids.add(entity.id);
    if (entity.type && !allowedTypes.has(entity.type)) errors.push(`${entity.filePath}: type inválido ${entity.type}`);
    if (entity.status && !allowedStatuses.has(entity.status)) errors.push(`${entity.filePath}: status inválido ${entity.status}`);
    if (!Array.isArray(entity.dependsOn)) errors.push(`${entity.id || entity.filePath}: depends_on deve ser uma lista`);
  }

  for (const entity of entities) {
    const dependencies = Array.isArray(entity.dependsOn) ? entity.dependsOn : [];
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) errors.push(`${entity.id}: dependência inexistente ${dependency}`);
    }
  }

  const states = new Map();
  const stack = [];
  const cycles = new Set();
  const byId = new Map(entities.map(entity => [entity.id, entity]));

  function visit(id) {
    states.set(id, 'visiting');
    stack.push(id);
    const entity = byId.get(id);
    const dependencies = entity && Array.isArray(entity.dependsOn) ? entity.dependsOn : [];

    for (const dependency of dependencies) {
      if (!byId.has(dependency)) continue;
      if (states.get(dependency) === 'visiting') {
        const start = stack.indexOf(dependency);
        cycles.add([...stack.slice(start), dependency].join(' -> '));
      } else if (states.get(dependency) !== 'visited') {
        visit(dependency);
      }
    }

    stack.pop();
    states.set(id, 'visited');
  }

  for (const entity of entities) {
    if (!states.has(entity.id)) visit(entity.id);
  }

  for (const cycle of cycles) errors.push(`ciclo de dependências: ${cycle}`);

  return errors;
}

function summary(entities) {
  return entities.reduce((result, entity) => {
    result.total += 1;
    const key = entity.status === 'in_progress' ? 'inProgress' : entity.status;
    if (key in result) result[key] += 1;
    return result;
  }, { total: 0, planned: 0, inProgress: 0, blocked: 0, done: 0 });
}

function repositoryName(root, config) {
  if (config.repository) return config.repository;
  const packagePath = path.join(root, 'package.json');
  if (fs.existsSync(packagePath)) {
    const { name } = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (name) return name;
  }
  return path.basename(root);
}

function initiativeTitle(entities, config) {
  if (config.initiative) return config.initiative;
  const initiatives = entities.filter(entity => entity.type === 'initiative');
  const active = initiatives.find(entity => !['done', 'canceled'].includes(entity.status));
  return (active || initiatives[0])?.title || 'Planner';
}

function buildIndex(root, entities) {
  const config = readConfig(root);
  // O branch não entra na projeção versionada: ele mudaria o arquivo conforme o branch que o gerou.
  const repository = {
    name: repositoryName(root, config),
    initiative: initiativeTitle(entities, config)
  };
  return {
    repository,
    summary: summary(entities),
    tickets: entities.map(entity => ({
      id: entity.id,
      type: entity.type,
      title: entity.title,
      description: entity.description,
      status: entity.status,
      priority: entity.priority,
      phase: entity.phase,
      labels: entity.labels || [],
      dependsOn: entity.dependsOn,
      source: entity.filePath
    }))
  };
}

function contextFor(entities, id) {
  const entity = entities.find(item => item.id === id);
  if (!entity) return null;
  return {
    entity,
    dependencies: entity.dependsOn.map(dependency => entities.find(item => item.id === dependency)).filter(Boolean),
    dependents: entities.filter(item => item.dependsOn.includes(id)),
    validation: validate(entities).filter(error => error.startsWith(`${id}:`) || error.includes(id))
  };
}

module.exports = { buildIndex, contextFor, parseFrontmatter, readEntities, summary, validate };
