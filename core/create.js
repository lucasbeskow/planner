const fs = require('node:fs');
const path = require('node:path');
const { TOKEN } = require('./edit');
const {
  ALLOWED_STATUSES,
  ALLOWED_TYPES,
  parseFrontmatter,
  readConfig,
  readEntities,
  validationIssues
} = require('./planner');

// Diretório padrão de cada tipo; precisa estar entre as fontes lidas em config.json.
const TYPE_SOURCES = {
  initiative: 'initiatives',
  task: 'tickets',
  decision: 'decisions',
  spec: 'specs',
  cycle: 'cycles'
};

const DEFAULT_TEMPLATE = `## Objetivo

Descreva o resultado esperado de {{title}}.

## Critérios de aceite

- [ ] critério observável
`;

const CREATE_FIELDS = ['type', 'status', 'priority', 'phase', 'labels', 'depends_on'];
const ID_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/;

function parseCreateAssignment(text) {
  const match = String(text).match(/^([A-Za-z_]\w*)=(.*)$/);
  if (!match) throw new Error(`campo inválido: ${text} (use campo=valor)`);
  const [, field, rawValue] = match;
  if (!CREATE_FIELDS.includes(field)) {
    throw new Error(`campo não aceito em new: ${field} (aceitos: ${CREATE_FIELDS.join(', ')})`);
  }
  if (field === 'labels' || field === 'depends_on') {
    const values = rawValue.split(',').map(value => value.trim()).filter(Boolean);
    for (const value of values) {
      if (!TOKEN.test(value)) throw new Error(`${field} inválido: ${value} (use letras, números, _ ou -)`);
    }
    return [field, values];
  }
  const value = rawValue.trim();
  if (field === 'type' && !ALLOWED_TYPES.includes(value)) {
    throw new Error(`type inválido: ${value || '(vazio)'} (aceitos: ${ALLOWED_TYPES.join(', ')})`);
  }
  if (field === 'status' && !ALLOWED_STATUSES.includes(value)) {
    throw new Error(`status inválido: ${value || '(vazio)'} (aceitos: ${ALLOWED_STATUSES.join(', ')})`);
  }
  if (!TOKEN.test(value)) throw new Error(`${field} inválido: ${value || '(vazio)'} (use letras, números, _ ou -)`);
  return [field, value];
}

// Prefixo de config.json (`idPrefix`) ou o mais usado nos ids existentes. O número é o maior
// existente + 1, com a mesma largura, para que os arquivos continuem ordenados.
function nextId(entities, config) {
  const parsed = entities.map(entity => String(entity.id ?? '').match(ID_PATTERN)).filter(Boolean);
  const counts = parsed.reduce((result, [, prefix]) => result.set(prefix, (result.get(prefix) ?? 0) + 1), new Map());
  const dominant = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  const prefix = config.idPrefix || dominant;
  if (!prefix) throw new Error('não há ids existentes para inferir o prefixo; defina idPrefix em .planner/config.json');
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(prefix)) throw new Error(`idPrefix inválido: ${prefix}`);

  const numbers = parsed.filter(([, itemPrefix]) => itemPrefix === prefix).map(([, , number]) => number);
  const next = Math.max(0, ...numbers.map(Number)) + 1;
  const width = Math.max(3, ...numbers.map(number => number.length));
  return `${prefix}-${String(next).padStart(width, '0')}`;
}

function slugify(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '') || 'item';
}

// O parser não tem escape: títulos que seriam lidos de outra forma vão entre as aspas que não
// aparecem no próprio título.
function yamlTitle(title) {
  const ambiguous = / #|^["'[]|^(true|false|-?\d+(\.\d+)?)$/.test(title);
  if (!ambiguous) return title;
  if (!title.includes('"')) return `"${title}"`;
  if (!title.includes("'")) return `'${title}'`;
  throw new Error('o título não pode ter aspas simples e duplas ao mesmo tempo');
}

function readTemplate(root, type) {
  const directory = path.join(root, '.planner', 'templates');
  for (const name of [`${type}.md`, 'default.md']) {
    const templatePath = path.join(directory, name);
    if (fs.existsSync(templatePath)) {
      return { source: path.relative(root, templatePath), content: fs.readFileSync(templatePath, 'utf8') };
    }
  }
  return { source: null, content: DEFAULT_TEMPLATE };
}

// Calcula o arquivo sem gravar nada; applyCreate grava o conteúdo revisado.
function planCreate(root, title, assignmentTexts = []) {
  const cleanTitle = String(title ?? '').trim();
  if (!cleanTitle) throw new Error('informe o título: planner new "<título>" [campo=valor...]');
  if (/[\r\n]/.test(cleanTitle)) throw new Error('o título deve ter uma única linha');

  const fields = { type: 'task', status: 'planned', priority: 'medium', phase: null, labels: [], depends_on: [] };
  for (const [field, value] of assignmentTexts.map(parseCreateAssignment)) fields[field] = value;

  const config = readConfig(root);
  const source = TYPE_SOURCES[fields.type];
  if (!config.sources.includes(source)) {
    throw new Error(`o diretório ${source} não está entre as fontes de .planner/config.json`);
  }

  const entities = readEntities(root);
  const id = nextId(entities, config);
  const file = path.join('.planner', source, `${id}-${slugify(cleanTitle)}.md`).split(path.sep).join('/');
  if (fs.existsSync(path.join(root, file))) throw new Error(`${file} já existe`);

  const template = readTemplate(root, fields.type);
  if (template.content.trimStart().startsWith('---')) {
    throw new Error(`${template.source}: o template contém só o corpo; o frontmatter é gerado pelo Planner`);
  }
  const body = template.content
    .replace(/\{\{\s*id\s*\}\}/g, id)
    .replace(/\{\{\s*title\s*\}\}/g, cleanTitle)
    .replace(/\{\{\s*type\s*\}\}/g, fields.type)
    .trim();

  const list = (key, values) => (values.length ? [`${key}:`, ...values.map(value => `  - ${value}`)] : [`${key}: []`]);
  const content = [
    '---',
    `id: ${id}`,
    `type: ${fields.type}`,
    `title: ${yamlTitle(cleanTitle)}`,
    `status: ${fields.status}`,
    `priority: ${fields.priority}`,
    ...(fields.phase ? [`phase: ${fields.phase}`] : []),
    ...list('labels', fields.labels),
    ...list('depends_on', fields.depends_on),
    '---',
    '',
    body,
    ''
  ].join('\n');

  // O arquivo gerado precisa ser lido de volta com os mesmos valores e não pode deixar o plano
  // com problemas de validação novos, como dependência inexistente.
  const attributes = parseFrontmatter(content, file).attributes;
  if (attributes.id !== id || attributes.title !== cleanTitle) {
    throw new Error(`não foi possível gerar um frontmatter válido para o título ${cleanTitle}`);
  }
  const entity = { ...attributes, dependsOn: attributes.depends_on ?? [], filePath: file };
  const known = new Set(validationIssues(entities).map(issue => issue.message));
  const introduced = validationIssues([...entities, entity]).map(issue => issue.message).filter(message => !known.has(message));
  if (introduced.length) throw new Error(`o novo ticket deixaria o plano inválido: ${introduced.join('; ')}`);

  return {
    id,
    file,
    template: template.source,
    content,
    diff: [`--- /dev/null`, `+++ b/${file}`, `@@ -0,0 +1,${content.split('\n').length - 1} @@`,
      ...content.split('\n').slice(0, -1).map(line => `+${line}`)].join('\n')
  };
}

// `wx` falha se o arquivo surgir entre o plano e a escrita, em vez de sobrescrevê-lo.
function applyCreate(root, plan) {
  if (readEntities(root).some(entity => entity.id === plan.id)) {
    throw new Error(`${plan.id} passou a existir depois do plano; execute o comando novamente`);
  }
  const absolutePath = path.join(root, plan.file);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  try {
    fs.writeFileSync(absolutePath, plan.content, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`${plan.file} já existe; execute o comando novamente`);
    throw error;
  }
}

module.exports = { DEFAULT_TEMPLATE, applyCreate, nextId, planCreate, slugify };
