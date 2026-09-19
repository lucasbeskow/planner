const fs = require('node:fs');
const path = require('node:path');
const { commitsFor } = require('./git');
const { entityReferences, idPrefixes, referenceWarnings } = require('./references');

const DEFAULT_SOURCES = ['initiatives', 'tickets', 'specs', 'decisions', 'cycles'];
const ALLOWED_TYPES = ['initiative', 'task', 'decision', 'spec', 'cycle'];
const ALLOWED_STATUSES = ['draft', 'planned', 'in_progress', 'blocked', 'done', 'canceled'];

// Subconjunto de YAML aceito no frontmatter (documentado em planner/README.md):
// escalares, listas em bloco, listas inline e comentários com #.
function stripComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#' && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index);
    }
  }
  return value;
}

function splitInlineList(content) {
  const items = [];
  let quote = null;
  let current = '';
  for (const char of content) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  items.push(current);
  return items;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  // Zeros à esquerda indicam identificadores, como 001, e permanecem texto.
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const content = trimmed.slice(1, -1);
    return content.trim() ? splitInlineList(content).map(item => parseScalar(item)) : [];
  }
  return trimmed;
}

function parseFrontmatter(source, filePath) {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { attributes: {}, body: source.trim(), filePath };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) throw new Error(`${filePath}: frontmatter não terminou com ---`);

  const attributes = {};
  let listKey = null;
  for (const line of lines.slice(1, end)) {
    const content = stripComment(line).trimEnd();
    if (!content.trim()) continue;
    const listItem = content.match(/^\s*-\s+(.+)$/);
    if (listItem && listKey) {
      if (!Array.isArray(attributes[listKey])) attributes[listKey] = [];
      attributes[listKey].push(parseScalar(listItem[1]));
      continue;
    }
    const field = content.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (!field) throw new Error(`${filePath}: linha inválida no frontmatter: ${line}`);
    const [, key, rawValue = ''] = field;
    if (rawValue.trim() === '') {
      // Sem valor, a chave é nula até que itens de lista a transformem em lista.
      attributes[key] = null;
      listKey = key;
    } else {
      attributes[key] = parseScalar(rawValue);
      listKey = null;
    }
  }

  return { attributes, body: lines.slice(end + 1).join('\n').trim(), filePath };
}

// Resumo exibido nos cards: o primeiro parágrafo da seção Objetivo ou, sem ela, do corpo.
function summarize(body) {
  const blocks = body.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const objective = blocks.findIndex(block => /^#{1,6}\s+objetivo\s*$/i.test(block));
  const candidates = objective >= 0 ? blocks.slice(objective + 1) : blocks;
  const paragraph = candidates.find(block => !block.startsWith('#') && !block.startsWith('```'));
  return paragraph ? paragraph.split('\n').map(line => line.trim()).join(' ') : '';
}

// Linhas de uma seção do corpo, até o próximo título de mesmo nível ou superior; null sem seção.
function sectionLines(body, title) {
  const lines = String(body ?? '').split(/\r?\n/);
  const start = lines.findIndex(line => title.test(line.replace(/^#{1,6}\s+/, '').trim()) && /^#{1,6}\s/.test(line));
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  const end = lines.findIndex((line, index) => index > start && (line.match(/^(#{1,6})\s/)?.[1].length ?? 7) <= level);
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

// Progresso do checklist da seção de critérios de aceite; null quando a seção não existe.
function acceptanceProgress(body) {
  const lines = sectionLines(body, /^crit[ée]rios de aceite/i);
  if (!lines) return null;
  let total = 0;
  let done = 0;
  for (const line of lines) {
    const task = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/);
    if (task) {
      total += 1;
      if (task[1] !== ' ') done += 1;
    }
  }
  return { done, total };
}

// Campos exigidos pelo contrato de fechamento (PRD, "Fechamento de tickets"). `unknown` é um
// valor aceito: o que falta é o campo, não a informação.
const EVIDENCE_FIELDS = ['harness', 'model', 'effort', 'tokens', 'completed_at', 'validation'];

// Evidência de execução: itens `- campo: valor` da seção Evidência do ticket; null sem seção.
function parseEvidence(body) {
  const lines = sectionLines(body, /^(evid[êe]ncias?|evidence)$/i);
  if (!lines) return null;
  const evidence = {};
  for (const line of lines) {
    const item = line.match(/^\s*[-*+]\s+([\p{L}_][\p{L}\p{N}_ -]*?)\s*:\s+(.+)$/u);
    if (item) evidence[item[1].trim().toLowerCase().replace(/\s+/g, '_')] = item[2].trim();
  }
  return evidence;
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
      dependsOn: parsed.attributes.depends_on ?? [],
      description: summarize(parsed.body),
      acceptance: acceptanceProgress(parsed.body),
      evidence: parseEvidence(parsed.body),
      body: parsed.body,
      filePath: path.relative(root, filePath)
    };
  });

  // A ordem de readdirSync varia entre sistemas de arquivos; ordenar mantém o índice determinístico.
  const sortKey = entity => String(entity.id ?? entity.filePath);
  entities.sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));

  // Referências dependem do plano inteiro (ids e prefixos existentes), por isso vêm depois da leitura.
  const ids = new Set(entities.map(entity => entity.id));
  const prefixes = idPrefixes(entities);
  for (const entity of entities) entity.references = entityReferences(root, entity, ids, prefixes);
  return entities;
}

// Cada problema guarda os ids envolvidos, para que o contexto de uma entidade filtre por
// comparação exata em vez de procurar o id dentro da mensagem.
function validationIssues(entities) {
  const issues = [];
  const report = (entityIds, message) => issues.push({ ids: entityIds.filter(Boolean), message });
  const ids = new Set();
  const allowedTypes = new Set(ALLOWED_TYPES);
  const allowedStatuses = new Set(ALLOWED_STATUSES);

  for (const entity of entities) {
    if (!entity.id) report([], `${entity.filePath}: id obrigatório`);
    if (!entity.title) report([entity.id], `${entity.filePath}: title obrigatório`);
    if (ids.has(entity.id)) report([entity.id], `${entity.filePath}: id duplicado ${entity.id}`);
    ids.add(entity.id);
    if (entity.type && !allowedTypes.has(entity.type)) report([entity.id], `${entity.filePath}: type inválido ${entity.type}`);
    if (entity.status && !allowedStatuses.has(entity.status)) report([entity.id], `${entity.filePath}: status inválido ${entity.status}`);
    if (!Array.isArray(entity.dependsOn)) report([entity.id], `${entity.id || entity.filePath}: depends_on deve ser uma lista`);
  }

  for (const entity of entities) {
    const dependencies = Array.isArray(entity.dependsOn) ? entity.dependsOn : [];
    for (const dependency of dependencies) {
      if (!ids.has(dependency)) report([entity.id], `${entity.id}: dependência inexistente ${dependency}`);
    }
  }

  const states = new Map();
  const stack = [];
  const cycles = new Map();
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
        const cycle = [...stack.slice(start), dependency];
        cycles.set(cycle.join(' -> '), cycle);
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

  for (const [label, cycle] of cycles) report([...new Set(cycle)], `ciclo de dependências: ${label}`);

  return issues;
}

function validate(entities) {
  return validationIssues(entities).map(issue => issue.message);
}

// Avisos apontam lacunas de processo sem invalidar o plano. Só tasks em andamento ou
// planejadas precisam de critérios; rascunhos e cancelados ficam de fora.
function acceptanceWarnings(entity) {
  if (entity.type !== 'task' || ['draft', 'canceled'].includes(entity.status)) return [];
  if (!entity.acceptance) return ['sem seção Critérios de aceite'];
  if (!entity.acceptance.total) return ['Critérios de aceite sem itens de checklist'];
  return [];
}

// Tickets concluídos antes do contrato também recebem aviso, não erro: completar a seção com
// `unknown` basta para registrar que a informação não existe.
function evidenceWarnings(entity) {
  if (entity.type !== 'task' || entity.status !== 'done') return [];
  if (!entity.evidence) return ['concluído sem seção Evidência'];
  const missing = EVIDENCE_FIELDS.filter(field => !entity.evidence[field]);
  return missing.length ? [`Evidência sem ${missing.join(', ')}`] : [];
}

function entityWarnings(entity) {
  return [...acceptanceWarnings(entity), ...evidenceWarnings(entity), ...(entity.references ? referenceWarnings(entity.references) : [])];
}

function warnings(entities) {
  return entities.flatMap(entity => entityWarnings(entity).map(message => `${entity.id}: ${message}`));
}

function validationReport(entities) {
  const errors = validate(entities);
  return { valid: errors.length === 0, errors, warnings: warnings(entities), total: entities.length };
}

function summary(entities) {
  return entities.reduce((result, entity) => {
    result.total += 1;
    const key = entity.status === 'in_progress' ? 'inProgress' : entity.status;
    if (key in result) result[key] += 1;
    return result;
  }, { total: 0, draft: 0, planned: 0, inProgress: 0, blocked: 0, done: 0, canceled: 0 });
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

// O índice leva só os campos curtos da evidência; validação e limitações ficam no Markdown.
function projectEvidence(evidence) {
  if (!evidence) return null;
  const fields = ['harness', 'model', 'effort', 'tokens', 'completed_at'];
  return Object.fromEntries(fields.filter(field => evidence[field]).map(field => [field, evidence[field]]));
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
      acceptance: entity.acceptance ?? null,
      evidence: projectEvidence(entity.evidence),
      warnings: entityWarnings(entity),
      source: entity.filePath
    }))
  };
}

// Grava o índice em arquivo temporário e renomeia: quem lê nunca vê um JSON pela metade.
function writeIndex(root, entities = readEntities(root)) {
  const index = buildIndex(root, entities);
  const indexPath = path.join(root, '.planner', 'index.json');
  const temporaryPath = `${indexPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(index, null, 2)}\n`);
  try {
    fs.renameSync(temporaryPath, indexPath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  return index;
}

// Com `root`, o contexto inclui os commits locais que citam o id (null sem Git).
function contextFor(entities, id, root) {
  const entity = entities.find(item => item.id === id);
  if (!entity) return null;
  const dependsOn = item => (Array.isArray(item.dependsOn) ? item.dependsOn : []);
  return {
    entity,
    dependencies: dependsOn(entity).map(dependency => entities.find(item => item.id === dependency)).filter(Boolean),
    dependents: entities.filter(item => dependsOn(item).includes(id)),
    validation: validationIssues(entities).filter(issue => issue.ids.includes(id)).map(issue => issue.message),
    warnings: entityWarnings(entity),
    ...(root ? { commits: commitsFor(root, id) } : {})
  };
}

module.exports = {
  ALLOWED_STATUSES,
  EVIDENCE_FIELDS,
  acceptanceProgress,
  ALLOWED_TYPES,
  buildIndex,
  contextFor,
  parseEvidence,
  parseFrontmatter,
  parseScalar,
  readConfig,
  readEntities,
  stripComment,
  summary,
  validate,
  validationIssues,
  validationReport,
  warnings,
  writeIndex
};
