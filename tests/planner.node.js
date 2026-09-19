const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const util = require('node:util');
const { acceptanceProgress, buildIndex, contextFor, parseFrontmatter, readEntities, validate } = require('../core/planner');
const { applyEdit, planEdit } = require('../core/edit');
const { createPlannerServer } = require('../serve');

const root = path.resolve(__dirname, '..');
const cliPath = path.join(root, 'cli.js');
const mcpPath = path.join(root, 'mcp.js');

// Os testes de comportamento usam um conjunto próprio de entidades, para não depender
// da quantidade de tickets versionados nem do branch atual.
const fixtureEntities = {
  'initiatives/FIX-001-iniciativa.md': { id: 'FIX-001', type: 'initiative', status: 'in_progress', dependsOn: [] },
  'tickets/FIX-002-planejado.md': { id: 'FIX-002', type: 'task', status: 'planned', dependsOn: ['FIX-001'] },
  'tickets/FIX-003-concluido.md': { id: 'FIX-003', type: 'task', status: 'done', dependsOn: ['FIX-002'] },
  'tickets/FIX-004-bloqueado.md': { id: 'FIX-004', type: 'task', status: 'blocked', dependsOn: [] }
};

function createFixture(config) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-fixture-'));
  if (config) {
    fs.mkdirSync(path.join(fixtureRoot, '.planner'));
    fs.writeFileSync(path.join(fixtureRoot, '.planner/config.json'), JSON.stringify(config));
  }
  for (const [file, entity] of Object.entries(fixtureEntities)) {
    const filePath = path.join(fixtureRoot, '.planner', file);
    const dependsOn = entity.dependsOn.length ? `depends_on:\n${entity.dependsOn.map(id => `  - ${id}`).join('\n')}` : 'depends_on: []';
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---
id: ${entity.id}
type: ${entity.type}
title: Entidade ${entity.id}
status: ${entity.status}
priority: medium
phase: M0
${dependsOn}
labels:
  - fixture
---

## Objetivo

Descrição de ${entity.id}.
`);
  }
  return fixtureRoot;
}

const fixtureRoot = createFixture();
const configuredFixtureRoot = createFixture({ repository: 'repositorio-fixture', initiative: 'Iniciativa configurada' });
const invalidFixtureRoot = createFixture();
fs.writeFileSync(path.join(invalidFixtureRoot, '.planner/tickets/FIX-005-invalido.md'), `---
id: FIX-005
type: task
title: Entidade inválida
status: planned
depends_on:
  - FIX-999
---
`);
test.after(() => {
  for (const fixture of [fixtureRoot, configuredFixtureRoot, invalidFixtureRoot]) {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

function runCli(...args) {
  return runCliIn(fixtureRoot, ...args);
}

function runCliIn(plannerRoot, ...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PLANNER_ROOT: plannerRoot }
  });
}

function runMcp(messages, plannerRoot = fixtureRoot) {
  const input = `${messages.map(message => JSON.stringify(message)).join('\n')}\n`;
  const processResult = spawnSync(process.execPath, [mcpPath], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: { ...process.env, PLANNER_ROOT: plannerRoot }
  });
  return { ...processResult, responses: processResult.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) };
}

test('lê frontmatter escalar e arrays', () => {
  const parsed = parseFrontmatter(`---\nid: PLN-TEST\nstatus: planned\nlabels:\n  - parser\n  - core\n---\n\n## Objetivo\n\nLer arquivos.`, 'fixture.md');

  assert.equal(parsed.attributes.id, 'PLN-TEST');
  assert.equal(parsed.attributes.status, 'planned');
  assert.deepEqual(parsed.attributes.labels, ['parser', 'core']);
  assert.match(parsed.body, /Ler arquivos/);
});

test('converte tipos escalares e arrays inline do frontmatter', () => {
  const parsed = parseFrontmatter(`---
enabled: true
retries: 3
labels: [core, parser]
quoted: "texto"
---
Conteúdo.`, 'typed.md');

  assert.equal(parsed.attributes.enabled, true);
  assert.equal(parsed.attributes.retries, 3);
  assert.deepEqual(parsed.attributes.labels, ['core', 'parser']);
  assert.equal(parsed.attributes.quoted, 'texto');
  assert.equal(parsed.body, 'Conteúdo.');
});

test('segue o subconjunto de YAML documentado', () => {
  const parsed = parseFrontmatter(`---
# comentário de linha
id: 001 # comentário no fim
url: http://exemplo.com/a#b
zero: 0
decimal: 1.5
labels: ["a, b", c]
empty_inline: []
empty:
block:
- sem recuo
  - "com # dentro"
---
`, 'yaml.md');

  assert.deepEqual(parsed.attributes, {
    id: '001',
    url: 'http://exemplo.com/a#b',
    zero: 0,
    decimal: 1.5,
    labels: ['a, b', 'c'],
    empty_inline: [],
    empty: null,
    block: ['sem recuo', 'com # dentro']
  });
});

test('exige espaço depois dos dois-pontos', () => {
  assert.throws(() => parseFrontmatter('---\nid:PLN-1\n---', 'colado.md'), /colado\.md: linha inválida no frontmatter/);
});

test('resume a descrição pelo primeiro parágrafo do objetivo', () => {
  const [entity] = readEntities(fixtureRoot);
  const withObjective = createFixture();
  const objectivePath = path.join(withObjective, '.planner/tickets/FIX-002-planejado.md');
  fs.writeFileSync(objectivePath, `---
id: FIX-002
title: Com contexto
---

Introdução antes do objetivo.

## Objetivo

Primeira linha
continua aqui.

Segundo parágrafo.
`);
  const noObjective = createFixture();
  fs.writeFileSync(path.join(noObjective, '.planner/tickets/FIX-002-planejado.md'), '---\nid: FIX-002\ntitle: Sem objetivo\n---\n\n# Título\n\nPrimeiro parágrafo.\n\nSegundo.\n');

  try {
    const described = readEntities(withObjective).find(item => item.id === 'FIX-002');
    assert.equal(entity.description, 'Descrição de FIX-001.');
    assert.equal(described.description, 'Primeira linha continua aqui.');
    assert.match(described.body, /Segundo parágrafo/);
    assert.equal(readEntities(noObjective).find(item => item.id === 'FIX-002').description, 'Primeiro parágrafo.');
  } finally {
    fs.rmSync(withObjective, { recursive: true, force: true });
    fs.rmSync(noObjective, { recursive: true, force: true });
  }
});

test('aceita arquivos sem frontmatter', () => {
  const parsed = parseFrontmatter('## Apenas Markdown\n\nConteúdo.', 'plain.md');

  assert.deepEqual(parsed.attributes, {});
  assert.equal(parsed.body, '## Apenas Markdown\n\nConteúdo.');
});

test('rejeita frontmatter malformado com caminho do arquivo', () => {
  assert.throws(
    () => parseFrontmatter('---\nid: PLN-TEST\n', 'broken.md'),
    /broken\.md: frontmatter não terminou/
  );
  assert.throws(
    () => parseFrontmatter('---\nid: PLN-TEST\nlinha inválida\n---', 'invalid.md'),
    /invalid\.md: linha inválida no frontmatter/
  );
});

test('carrega as entidades de todas as fontes configuradas', () => {
  const entities = readEntities(fixtureRoot);
  const initiative = entities.find(entity => entity.id === 'FIX-001');

  assert.equal(entities.length, Object.keys(fixtureEntities).length);
  assert.equal(initiative.type, 'initiative');
  assert.equal(initiative.filePath, '.planner/initiatives/FIX-001-iniciativa.md');
  assert.deepEqual(entities.find(entity => entity.id === 'FIX-003').dependsOn, ['FIX-002']);
});

test('as entidades versionadas do Planner são válidas', () => {
  assert.deepEqual(validate(readEntities(fixtureRoot)), []);
});

test('detecta ciclos de dependência', () => {
  const errors = validate([
    { id: 'A', title: 'A', type: 'task', status: 'planned', dependsOn: ['B'], filePath: 'a.md' },
    { id: 'B', title: 'B', type: 'task', status: 'planned', dependsOn: ['A'], filePath: 'b.md' }
  ]);

  assert.equal(errors.length, 1);
  assert.match(errors[0], /ciclo de dependências: A -> B -> A/);
});

test('detecta auto-dependência', () => {
  const errors = validate([
    { id: 'A', title: 'A', type: 'task', status: 'planned', dependsOn: ['A'], filePath: 'a.md' }
  ]);

  assert.match(errors[0], /ciclo de dependências: A -> A/);
});

test('detecta dependência que não é uma lista', () => {
  const errors = validate([
    { id: 'A', title: 'A', type: 'task', status: 'planned', dependsOn: 'B', filePath: 'a.md' }
  ]);

  assert.match(errors[0], /depends_on deve ser uma lista/);
});

test('resolve dependências e dependentes no contexto', () => {
  const context = contextFor(readEntities(fixtureRoot), 'FIX-002');

  assert.deepEqual(context.dependencies.map(entity => entity.id), ['FIX-001']);
  assert.deepEqual(context.dependents.map(entity => entity.id), ['FIX-003']);
});

test('o contexto filtra validações pelo id exato', () => {
  const context = contextFor([
    { id: 'PLN-1', title: 'Um', dependsOn: [], filePath: 'a.md' },
    { id: 'PLN-10', title: 'Dez', dependsOn: ['PLN-99'], filePath: 'b.md' }
  ], 'PLN-1');

  assert.deepEqual(context.validation, []);
});

test('o contexto tolera depends_on inválido e reporta o erro', () => {
  const entities = [
    { id: 'A', title: 'A', dependsOn: 'B', filePath: 'a.md' },
    { id: 'B', title: 'B', dependsOn: [], filePath: 'b.md' },
    { id: 'C', title: 'C', dependsOn: ['B'], filePath: 'c.md' }
  ];

  const context = contextFor(entities, 'A');
  assert.deepEqual(context.dependencies, []);
  assert.deepEqual(context.validation, ['A: depends_on deve ser uma lista']);
  assert.deepEqual(contextFor(entities, 'B').dependents.map(entity => entity.id), ['C']);
});

test('o contexto inclui ciclos que envolvem a entidade', () => {
  const context = contextFor([
    { id: 'A', title: 'A', dependsOn: ['B'], filePath: 'a.md' },
    { id: 'B', title: 'B', dependsOn: ['A'], filePath: 'b.md' }
  ], 'B');

  assert.deepEqual(context.validation, ['ciclo de dependências: A -> B -> A']);
});

test('o resumo conta todos os status aceitos', () => {
  const statuses = ['draft', 'planned', 'in_progress', 'blocked', 'done', 'canceled'];
  const index = buildIndex(fixtureRoot, statuses.map((status, position) => ({ id: `S-${position}`, status, dependsOn: [] })));

  assert.deepEqual(index.summary, { total: 6, draft: 1, planned: 1, inProgress: 1, blocked: 1, done: 1, canceled: 1 });
});

test('o índice versionado é consistente', () => {
  const index = buildIndex(fixtureRoot, readEntities(fixtureRoot));

  assert.equal(index.summary.total, index.tickets.length);
  assert.ok(index.tickets.every(ticket => fs.existsSync(path.join(fixtureRoot, ticket.source))));
});

test('o índice versionado está atualizado com os arquivos Markdown', () => {
  const committed = buildIndex(fixtureRoot, readEntities(fixtureRoot));
  const generated = JSON.parse(JSON.stringify(buildIndex(fixtureRoot, readEntities(fixtureRoot))));
  const byId = index => new Map(index.tickets.map(ticket => [ticket.id, JSON.stringify(ticket)]));
  const committedTickets = byId(committed);
  const generatedTickets = byId(generated);
  const ids = new Set([...committedTickets.keys(), ...generatedTickets.keys()]);
  const stale = [...ids].filter(id => committedTickets.get(id) !== generatedTickets.get(id)).sort();

  if (!util.isDeepStrictEqual(committed.summary, generated.summary)) stale.push('summary');
  if (!util.isDeepStrictEqual(committed.repository, generated.repository)) stale.push('repository');

  assert.deepEqual(stale, [], `.planner/index.json está desatualizado (${stale.join(', ')}); rode yarn planner:index`);
});

test('o índice é determinístico e não depende do branch atual', () => {
  const index = buildIndex(fixtureRoot, readEntities(fixtureRoot));

  assert.deepEqual(index.tickets.map(ticket => ticket.id), ['FIX-001', 'FIX-002', 'FIX-003', 'FIX-004']);
  assert.equal('branch' in index.repository, false);
});

test('o índice usa o repositório e a iniciativa configurados', () => {
  const index = buildIndex(configuredFixtureRoot, readEntities(configuredFixtureRoot));

  assert.deepEqual(index.repository, { name: 'repositorio-fixture', initiative: 'Iniciativa configurada' });
});

test('sem configuração, o índice usa o package.json e a iniciativa ativa', () => {
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify({ name: 'pacote-fixture' }));
  try {
    const index = buildIndex(fixtureRoot, readEntities(fixtureRoot));
    assert.deepEqual(index.repository, { name: 'pacote-fixture', initiative: 'Entidade FIX-001' });
  } finally {
    fs.rmSync(path.join(fixtureRoot, 'package.json'));
  }
});

test('o índice é uma projeção regenerável dos arquivos Markdown', () => {
  const entities = readEntities(fixtureRoot);
  const index = buildIndex(fixtureRoot, entities);

  assert.equal(index.summary.total, entities.length);
  assert.deepEqual(index.summary, { total: 4, draft: 0, planned: 1, inProgress: 1, blocked: 1, done: 1, canceled: 0 });
  assert.equal(index.tickets.find(ticket => ticket.id === 'FIX-003').status, 'done');
  assert.equal(index.tickets.find(ticket => ticket.id === 'FIX-003').source, '.planner/tickets/FIX-003-concluido.md');
});

test('o índice contém os dados necessários para o dashboard', () => {
  const index = buildIndex(fixtureRoot, readEntities(fixtureRoot));
  const ticket = index.tickets.find(item => item.id === 'FIX-002');

  assert.ok(index.repository.name);
  assert.ok(index.repository.initiative);
  assert.deepEqual(Object.keys(index.summary), ['total', 'draft', 'planned', 'inProgress', 'blocked', 'done', 'canceled']);
  assert.deepEqual(Object.keys(ticket).sort(), ['acceptance', 'dependsOn', 'description', 'id', 'labels', 'phase', 'priority', 'source', 'status', 'title', 'type', 'warnings']);
});

test('a CLI expõe saída estruturada para agentes', () => {
  const status = runCli('status', '--json');
  const list = runCli('list', 'planned', '--json');
  const context = runCli('context', 'FIX-002', '--json');

  assert.equal(status.status, 0);
  assert.equal(JSON.parse(status.stdout).total, Object.keys(fixtureEntities).length);
  assert.equal(list.status, 0);
  assert.deepEqual(JSON.parse(list.stdout).map(entity => entity.id), ['FIX-002']);
  assert.equal(context.status, 0);
  assert.equal(JSON.parse(context.stdout).entity.id, 'FIX-002');
});

test('a CLI valida com saída estruturada', () => {
  const valid = runCli('validate', '--json');
  const invalid = runCliIn(invalidFixtureRoot, 'validate', '--json');
  const invalidText = runCliIn(invalidFixtureRoot, 'validate');

  assert.equal(valid.status, 0);
  const missing = id => `${id}: sem seção Critérios de aceite`;
  assert.deepEqual(JSON.parse(valid.stdout), {
    valid: true,
    errors: [],
    warnings: [missing('FIX-002'), missing('FIX-003'), missing('FIX-004')],
    total: 4
  });
  assert.equal(invalid.status, 1);
  assert.deepEqual(JSON.parse(invalid.stdout), {
    valid: false,
    errors: ['FIX-005: dependência inexistente FIX-999'],
    warnings: [missing('FIX-002'), missing('FIX-003'), missing('FIX-004'), missing('FIX-005')],
    total: 5
  });
  assert.equal(invalidText.status, 1);
  assert.match(invalidText.stderr, /✗ FIX-005: dependência inexistente FIX-999/);
});

test('a CLI mostra o corpo completo em show', () => {
  const show = runCli('show', 'FIX-002');

  assert.equal(show.status, 0);
  assert.match(show.stdout, /## Objetivo\n\nDescrição de FIX-002\./);
});

test('a CLI oferece ajuda e erros acionáveis', () => {
  const shortHelp = runCli('-h');
  assert.equal(shortHelp.status, 0);
  assert.match(shortHelp.stdout, /^Uso: npx planner/);

  const help = runCli('--help');
  const missing = runCli('show');
  const unknown = runCli('nao-existe');

  assert.equal(help.status, 0);
  assert.match(help.stdout, /status|context|validate/);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /informe o id da entidade/);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /comando desconhecido/);
});

test('a CLI inicializa um repositório sem sobrescrever configuração existente', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-init-'));

  try {
    const first = runCliIn(target, 'init', '--json');
    assert.equal(first.status, 0);
    const result = JSON.parse(first.stdout);
    assert.equal(result.entities, 0);
    assert.ok(result.created.includes('.planner/config.json'));
    assert.ok(fs.existsSync(path.join(target, '.planner/tickets')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, '.planner/index.json'))).summary.total, 0);

    const configPath = path.join(target, '.planner/config.json');
    fs.writeFileSync(configPath, JSON.stringify({ sources: ['tickets'], index: 'index.json', repository: 'minha-app' }));
    const second = runCliIn(target, 'init', '--json');

    assert.equal(second.status, 0);
    assert.equal(JSON.parse(fs.readFileSync(configPath)).repository, 'minha-app');
    assert.deepEqual(JSON.parse(second.stdout).created, ['.planner/index.json']);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('o servidor MCP expõe ferramentas somente leitura', () => {
  const mcp = runMcp([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'planner_status', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'planner_context', arguments: { id: 'FIX-002' } } }
  ]);

  assert.equal(mcp.status, 0);
  assert.equal(mcp.responses.length, 4);
  assert.equal(mcp.responses[0].result.serverInfo.name, 'planner-local');
  assert.deepEqual(mcp.responses[1].result.tools.map(tool => tool.name), [
    'planner_status',
    'planner_list',
    'planner_show',
    'planner_context',
    'planner_validate'
  ]);
  assert.equal(JSON.parse(mcp.responses[2].result.content[0].text).total, Object.keys(fixtureEntities).length);
  assert.equal(JSON.parse(mcp.responses[3].result.content[0].text).entity.id, 'FIX-002');
});

test('o servidor MCP responde ping e ignora notificações', () => {
  const mcp = runMcp([
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } },
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'metodo/desconhecido' },
    { jsonrpc: '2.0', id: 2, method: 'metodo/desconhecido' }
  ]);

  assert.equal(mcp.status, 0);
  assert.deepEqual(mcp.responses.map(response => response.id), [1, 2]);
  assert.deepEqual(mcp.responses[0].result, {});
  assert.equal(mcp.responses[1].error.code, -32601);
});

test('CLI e MCP retornam a mesma validação', () => {
  for (const plannerRoot of [fixtureRoot, invalidFixtureRoot]) {
    const cliValidation = JSON.parse(runCliIn(plannerRoot, 'validate', '--json').stdout);
    const mcp = runMcp([
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planner_validate', arguments: {} } }
    ], plannerRoot);

    assert.deepEqual(JSON.parse(mcp.responses[0].result.content[0].text), cliValidation);
  }
});

test('o servidor local expõe somente a UI, o Planner e o branch', async () => {
  fs.mkdirSync(path.join(fixtureRoot, 'planner'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, '.git'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'planner/index.html'), '<main></main>');
  fs.writeFileSync(path.join(fixtureRoot, '.git/HEAD'), 'ref: refs/heads/fixture\n');
  fs.writeFileSync(path.join(fixtureRoot, '.git/config'), '[core]');
  fs.writeFileSync(path.join(fixtureRoot, 'segredo.txt'), 'não expor');

  const server = createPlannerServer(fixtureRoot);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (pathname, options) => fetch(`${base}${pathname}`, { redirect: 'manual', ...options });

  try {
    assert.equal((await get('/')).headers.get('location'), '/planner/');
    assert.equal(await (await get('/planner/')).text(), '<main></main>');
    assert.equal((await get('/.planner/tickets/FIX-002-planejado.md')).status, 200);
    assert.equal(await (await get('/.git/HEAD')).text(), 'ref: refs/heads/fixture\n');
    assert.equal((await get('/.git/config')).status, 404);
    assert.equal((await get('/segredo.txt')).status, 404);
    assert.equal((await get('/planner/%2e%2e/segredo.txt')).status, 404);
    assert.equal((await get('/planner/', { method: 'POST' })).status, 405);
  } finally {
    server.close();
    for (const file of ['planner', '.git', 'segredo.txt']) fs.rmSync(path.join(fixtureRoot, file), { recursive: true, force: true });
  }
});

test('CLI e MCP retornam o mesmo contrato de domínio', () => {
  const cliStatus = JSON.parse(runCli('status', '--json').stdout);
  const mcp = runMcp([
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planner_status', arguments: {} } }
  ]);
  const mcpStatus = JSON.parse(mcp.responses[0].result.content[0].text);

  assert.deepEqual(mcpStatus, cliStatus);
});

test('renderiza Markdown do detalhe escapando HTML', async () => {
  const { renderMarkdown } = await import('../markdown.mjs');
  const source = `---
id: FIX-010
---

## Objetivo

Texto com **negrito**, \`código <b>\` e [link](https://exemplo.com).

<script>alert(1)</script>

[perigoso](javascript:alert(1))

\`\`\`js
const a = '<b>';
\`\`\`

## Critérios de aceite

- [x] feito
- [ ] pendente
  continuação

## Notas

- [ ] fora dos critérios
`;
  const html = renderMarkdown(source);

  assert.doesNotMatch(html, /id: FIX-010/);
  assert.match(html, /<h2>Objetivo<\/h2>/);
  assert.match(html, /<strong>negrito<\/strong>/);
  assert.match(html, /<code>código &lt;b&gt;<\/code>/);
  assert.match(html, /<a href="https:\/\/exemplo.com" target="_blank" rel="noreferrer">link<\/a>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|href="javascript/);
  assert.match(html, /<pre><code class="language-js">const a = &#039;&lt;b&gt;&#039;;<\/code><\/pre>/);
  assert.match(html, /<li class="task done"><input type="checkbox" disabled checked> feito<\/li>/);
  assert.match(html, /<li class="task"><input type="checkbox" disabled> pendente continuação<\/li>/);
  assert.deepEqual(acceptanceProgress(source), { done: 1, total: 2 });
  assert.equal(acceptanceProgress('## Objetivo\n\nSem critérios.'), null);
});

test('a fixture versionada é válida e o índice está atualizado', () => {
  const entities = readEntities(root);
  assert.deepEqual(validate(entities), []);
  const versioned = JSON.parse(fs.readFileSync(path.join(root, '.planner/index.json'), 'utf8'));
  assert.deepEqual(versioned, buildIndex(root, entities));
});

function createEditFixture(content) {
  const editRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-edit-'));
  const filePath = path.join(editRoot, '.planner/tickets/EDT-001.md');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { editRoot, filePath };
}

const editableTicket = `---
id: EDT-001 # id estável
type: task
title: Ticket editável
status: planned # revisar na daily
priority: medium
labels:
    - cli
    - escrita
depends_on: []
---

## Objetivo

Corpo intacto.
`;

test('set mostra o diff e não grava sem --yes', () => {
  const { editRoot, filePath } = createEditFixture(editableTicket);
  try {
    const result = runCliIn(editRoot, 'set', 'EDT-001', 'status=in_progress', 'labels-=cli');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^-status: planned # revisar na daily$/m);
    assert.match(result.stdout, /^\+status: in_progress # revisar na daily$/m);
    assert.match(result.stdout, /^-    - cli$/m);
    assert.match(result.stdout, /Nenhuma alteração gravada/);
    assert.equal(fs.readFileSync(filePath, 'utf8'), editableTicket);
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

test('set --yes altera só os campos pedidos e preserva o restante do arquivo', () => {
  const { editRoot, filePath } = createEditFixture(editableTicket);
  try {
    const result = runCliIn(editRoot, 'set', 'EDT-001', 'status=in_progress', 'priority=high', 'labels+=ui,cli', '--yes', '--json');
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.written, true);
    assert.deepEqual(output.changes, [
      { field: 'status', before: 'planned', after: 'in_progress' },
      { field: 'priority', before: 'medium', after: 'high' },
      { field: 'labels', before: ['cli', 'escrita'], after: ['cli', 'escrita', 'ui'] }
    ]);
    assert.equal(fs.readFileSync(filePath, 'utf8'), editableTicket
      .replace('status: planned # revisar na daily', 'status: in_progress # revisar na daily')
      .replace('priority: medium', 'priority: high')
      .replace('    - escrita\n', '    - escrita\n    - ui\n'));
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

test('set mantém listas inline, CRLF e insere campos ausentes', () => {
  const content = '---\r\nid: EDT-001\r\ntitle: Inline\r\nstatus: planned\r\nlabels: [a, b] # tags\r\n---\r\nCorpo.\r\n';
  const { editRoot, filePath } = createEditFixture(content);
  try {
    const result = runCliIn(editRoot, 'set', 'EDT-001', 'labels=c', 'priority=low', '--yes');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(filePath, 'utf8'),
      '---\r\nid: EDT-001\r\ntitle: Inline\r\nstatus: planned\r\nlabels: [c] # tags\r\npriority: low\r\n---\r\nCorpo.\r\n'
    );
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

test('set rejeita valores inválidos antes de escrever', () => {
  const { editRoot, filePath } = createEditFixture(editableTicket);
  try {
    const cases = [
      [['EDT-001', 'status=feito'], /status inválido: feito/],
      [['EDT-001', 'priority=muito alta'], /prioridade inválida/],
      [['EDT-001', 'labels+=a:b'], /label inválida: a:b/],
      [['EDT-001', 'title=Outro'], /campo não editável: title/],
      [['EDT-001', 'status+=done'], /status aceita apenas =/],
      [['EDT-001'], /informe ao menos uma alteração/],
      [['EDT-999', 'status=done'], /Entidade não encontrada: EDT-999/]
    ];
    for (const [args, message] of cases) {
      const result = runCliIn(editRoot, 'set', ...args, '--yes');
      assert.equal(result.status, 1, args.join(' '));
      assert.match(result.stderr, message);
    }
    assert.equal(fs.readFileSync(filePath, 'utf8'), editableTicket);
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

test('set sem mudança efetiva não toca o arquivo', () => {
  const { editRoot } = createEditFixture(editableTicket);
  try {
    const result = runCliIn(editRoot, 'set', 'EDT-001', 'status=planned', 'labels+=ui', 'labels-=ui', '--yes');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /nenhuma alteração/);
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

test('applyEdit recusa gravar quando o arquivo mudou depois do diff', () => {
  const { editRoot, filePath } = createEditFixture(editableTicket);
  try {
    const plan = planEdit(editRoot, 'EDT-001', ['status=in_progress']);
    fs.appendFileSync(filePath, 'Edição concorrente.\n');
    assert.throws(() => applyEdit(editRoot, plan), /mudou desde que o diff foi calculado/);
    assert.match(fs.readFileSync(filePath, 'utf8'), /status: planned/);
  } finally {
    fs.rmSync(editRoot, { recursive: true, force: true });
  }
});

function createTransitionFixture() {
  const transitionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-transition-'));
  const entities = [
    ['initiatives/TRN-001.md', 'TRN-001', 'initiative', 'in_progress', []],
    ['tickets/TRN-002.md', 'TRN-002', 'task', 'in_progress', []],
    ['tickets/TRN-003.md', 'TRN-003', 'task', 'in_progress', ['TRN-001', 'TRN-002']],
    ['tickets/TRN-004.md', 'TRN-004', 'task', 'done', []],
    ['tickets/TRN-005.md', 'TRN-005', 'task', 'planned', []],
    ['tickets/TRN-006.md', 'TRN-006', 'task', 'in_progress', ['TRN-001', 'TRN-004', 'TRN-007']],
    ['tickets/TRN-007.md', 'TRN-007', 'task', 'canceled', []]
  ];
  for (const [file, id, type, status, dependsOn] of entities) {
    const filePath = path.join(transitionRoot, '.planner', file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: ${status}\ndepends_on: [${dependsOn.join(', ')}]\n---\n`);
  }
  return transitionRoot;
}

test('set recusa transições fora do fluxo e explica o motivo', () => {
  const transitionRoot = createTransitionFixture();
  try {
    const cases = [
      [['TRN-005', 'status=done'], /transição planned → done não permitida \(a partir de planned: in_progress, canceled\)/],
      [['TRN-004', 'status=in_progress'], /TRN-004: done é um status final; use --force para reabrir/],
      [['TRN-007', 'status=planned'], /TRN-007: canceled é um status final/],
      [['TRN-003', 'status=done'], /TRN-003: não pode ser concluído com dependências abertas: TRN-002 \[in_progress\]/]
    ];
    for (const [args, message] of cases) {
      const result = runCliIn(transitionRoot, 'set', ...args, '--yes');
      assert.equal(result.status, 1, args.join(' '));
      assert.match(result.stderr, /transição recusada:/);
      assert.match(result.stderr, message);
    }
    assert.match(fs.readFileSync(path.join(transitionRoot, '.planner/tickets/TRN-004.md'), 'utf8'), /status: done/);
  } finally {
    fs.rmSync(transitionRoot, { recursive: true, force: true });
  }
});

test('set aceita transições do fluxo e ignora iniciativas como dependência', () => {
  const transitionRoot = createTransitionFixture();
  try {
    for (const args of [['TRN-005', 'status=in_progress'], ['TRN-002', 'status=blocked'], ['TRN-006', 'status=done'], ['TRN-003', 'status=canceled']]) {
      const result = runCliIn(transitionRoot, 'set', ...args, '--yes');
      assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
    }
  } finally {
    fs.rmSync(transitionRoot, { recursive: true, force: true });
  }
});

test('set --force permite reabrir, mas não ignora valores inválidos', () => {
  const transitionRoot = createTransitionFixture();
  try {
    const reopened = runCliIn(transitionRoot, 'set', 'TRN-004', 'status=in_progress', '--force', '--yes');
    assert.equal(reopened.status, 0, reopened.stderr);
    assert.match(fs.readFileSync(path.join(transitionRoot, '.planner/tickets/TRN-004.md'), 'utf8'), /status: in_progress/);

    const invalid = runCliIn(transitionRoot, 'set', 'TRN-004', 'status=feito', '--force', '--yes');
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /status inválido: feito/);
  } finally {
    fs.rmSync(transitionRoot, { recursive: true, force: true });
  }
});

test('new mostra o arquivo e só cria com --yes, com o próximo id livre', () => {
  const newRoot = createFixture();
  try {
    const preview = runCliIn(newRoot, 'new', 'Exportar relatório', 'labels=ui', 'depends_on=FIX-002', 'phase=M1');
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /^\+\+\+ b\/\.planner\/tickets\/FIX-005-exportar-relatorio\.md$/m);
    assert.match(preview.stdout, /Nenhum arquivo criado/);
    assert.equal(fs.existsSync(path.join(newRoot, '.planner/tickets/FIX-005-exportar-relatorio.md')), false);

    const created = JSON.parse(runCliIn(newRoot, 'new', 'Exportar relatório', 'labels=ui', 'depends_on=FIX-002', 'phase=M1', '--yes', '--json').stdout);
    assert.equal(created.id, 'FIX-005');
    assert.equal(created.written, true);
    assert.equal(fs.readFileSync(path.join(newRoot, created.file), 'utf8'), `---
id: FIX-005
type: task
title: Exportar relatório
status: planned
priority: medium
phase: M1
labels:
  - ui
depends_on:
  - FIX-002
---

## Objetivo

Descreva o resultado esperado de Exportar relatório.

## Critérios de aceite

- [ ] critério observável
`);
    assert.equal(runCliIn(newRoot, 'validate').status, 0);

    const next = JSON.parse(runCliIn(newRoot, 'new', 'Outro', '--json').stdout);
    assert.equal(next.id, 'FIX-006');
  } finally {
    fs.rmSync(newRoot, { recursive: true, force: true });
  }
});

test('new usa template do repositório por tipo e protege títulos ambíguos', () => {
  const newRoot = createFixture({ idPrefix: 'ADR', sources: ['initiatives', 'tickets', 'decisions'] });
  try {
    fs.mkdirSync(path.join(newRoot, '.planner/templates'));
    fs.writeFileSync(path.join(newRoot, '.planner/templates/decision.md'), '## Contexto\n\n{{id}}: {{title}} ({{type}})\n');
    const result = runCliIn(newRoot, 'new', 'Usar SQLite? # talvez', 'type=decision', '--yes', '--json');
    assert.equal(result.status, 0, result.stderr);
    const created = JSON.parse(result.stdout);
    assert.equal(created.id, 'ADR-001');
    assert.equal(created.file, '.planner/decisions/ADR-001-usar-sqlite-talvez.md');
    assert.equal(created.template, '.planner/templates/decision.md');
    const content = fs.readFileSync(path.join(newRoot, created.file), 'utf8');
    assert.match(content, /^title: "Usar SQLite\? # talvez"$/m);
    assert.match(content, /^ADR-001: Usar SQLite\? # talvez \(decision\)$/m);
    assert.equal(JSON.parse(runCliIn(newRoot, 'show', 'ADR-001', '--json').stdout).title, 'Usar SQLite? # talvez');
  } finally {
    fs.rmSync(newRoot, { recursive: true, force: true });
  }
});

test('new rejeita campos inválidos antes de criar arquivos', () => {
  const newRoot = createFixture({ sources: ['initiatives', 'tickets'] });
  try {
    const cases = [
      [[], /informe o título/],
      [['Título', 'type=bug'], /type inválido: bug/],
      [['Título', 'status=feito'], /status inválido: feito/],
      [['Título', 'priority=muito alta'], /priority inválido/],
      [['Título', 'title=Outro'], /campo não aceito em new: title/],
      [['Título', 'depends_on=FIX-999'], /dependência inexistente FIX-999/],
      [['Título', 'type=spec'], /o diretório specs não está entre as fontes/],
      [['"Aspas" e \'b\''], /aspas simples e duplas/]
    ];
    const before = fs.readdirSync(path.join(newRoot, '.planner/tickets'));
    for (const [args, message] of cases) {
      const result = runCliIn(newRoot, 'new', ...args, '--yes');
      assert.equal(result.status, 1, args.join(' '));
      assert.match(result.stderr, message);
    }
    assert.deepEqual(fs.readdirSync(path.join(newRoot, '.planner/tickets')), before);
  } finally {
    fs.rmSync(newRoot, { recursive: true, force: true });
  }
});

test('set e new atualizam o índice na mesma escrita, e só com --yes', () => {
  const writeRoot = createFixture();
  const indexPath = path.join(writeRoot, '.planner/index.json');
  const indexedStatus = id => JSON.parse(fs.readFileSync(indexPath, 'utf8')).tickets.find(ticket => ticket.id === id)?.status;
  try {
    assert.equal(runCliIn(writeRoot, 'index').status, 0);
    const initial = fs.readFileSync(indexPath, 'utf8');

    assert.equal(runCliIn(writeRoot, 'set', 'FIX-002', 'status=in_progress').status, 0);
    assert.equal(runCliIn(writeRoot, 'new', 'Sem confirmação').status, 0);
    assert.equal(runCliIn(writeRoot, 'set', 'FIX-002', 'status=done', '--yes').status, 1);
    assert.equal(fs.readFileSync(indexPath, 'utf8'), initial);

    const edited = JSON.parse(runCliIn(writeRoot, 'set', 'FIX-002', 'status=in_progress', '--yes', '--json').stdout);
    assert.equal(edited.indexed, true);
    assert.equal(indexedStatus('FIX-002'), 'in_progress');

    const created = JSON.parse(runCliIn(writeRoot, 'new', 'Novo', '--yes', '--json').stdout);
    assert.equal(created.indexed, true);
    assert.equal(indexedStatus(created.id), 'planned');
    assert.deepEqual(JSON.parse(fs.readFileSync(indexPath, 'utf8')), JSON.parse(JSON.stringify(buildIndex(writeRoot, readEntities(writeRoot)))));
    assert.deepEqual(fs.readdirSync(path.join(writeRoot, '.planner')).filter(file => file.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(writeRoot, { recursive: true, force: true });
  }
});

test('falha ao gravar o índice desfaz a escrita da entidade', () => {
  const writeRoot = createFixture();
  const ticketPath = path.join(writeRoot, '.planner/tickets/FIX-002-planejado.md');
  try {
    // Um diretório no lugar do índice faz o rename falhar depois que a entidade foi gravada.
    fs.mkdirSync(path.join(writeRoot, '.planner/index.json/bloqueio'), { recursive: true });
    const original = fs.readFileSync(ticketPath, 'utf8');

    const edited = runCliIn(writeRoot, 'set', 'FIX-002', 'status=in_progress', '--yes');
    assert.equal(edited.status, 1);
    assert.match(edited.stderr, /não foi possível atualizar o índice; \.planner\/tickets\/FIX-002-planejado\.md foi restaurado/);
    assert.equal(fs.readFileSync(ticketPath, 'utf8'), original);

    const before = fs.readdirSync(path.join(writeRoot, '.planner/tickets'));
    const created = runCliIn(writeRoot, 'new', 'Não fica', '--yes');
    assert.equal(created.status, 1);
    assert.match(created.stderr, /não foi possível atualizar o índice; .* foi removido/);
    assert.deepEqual(fs.readdirSync(path.join(writeRoot, '.planner/tickets')), before);
    assert.deepEqual(fs.readdirSync(path.join(writeRoot, '.planner')).filter(file => file.endsWith('.tmp')), []);
  } finally {
    fs.rmSync(writeRoot, { recursive: true, force: true });
  }
});

test('validate avisa sobre tasks sem critérios de aceite sem invalidar o plano', () => {
  const warnRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-warn-'));
  const write = (file, frontmatter, body) => {
    const filePath = path.join(warnRoot, '.planner', file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `---\n${frontmatter}\ndepends_on: []\n---\n\n${body}\n`);
  };
  try {
    write('tickets/WRN-001.md', 'id: WRN-001\ntype: task\ntitle: Completo\nstatus: planned', '## Critérios de aceite\n\n- [x] um\n- [ ] dois');
    write('tickets/WRN-002.md', 'id: WRN-002\ntype: task\ntitle: Sem seção\nstatus: in_progress', '## Objetivo\n\nTexto.');
    write('tickets/WRN-003.md', 'id: WRN-003\ntype: task\ntitle: Sem checklist\nstatus: blocked', '### Critérios de aceite\n\nTexto solto.\n\n## Notas\n\n- [ ] fora');
    write('tickets/WRN-004.md', 'id: WRN-004\ntype: task\ntitle: Rascunho\nstatus: draft', '');
    write('tickets/WRN-005.md', 'id: WRN-005\ntype: task\ntitle: Cancelado\nstatus: canceled', '');
    write('decisions/WRN-006.md', 'id: WRN-006\ntype: decision\ntitle: Decisão\nstatus: done', '## Decisão\n\nTexto.');

    const json = runCliIn(warnRoot, 'validate', '--json');
    assert.equal(json.status, 0);
    assert.deepEqual(JSON.parse(json.stdout).warnings, [
      'WRN-002: sem seção Critérios de aceite',
      'WRN-003: Critérios de aceite sem itens de checklist'
    ]);

    const text = runCliIn(warnRoot, 'validate');
    assert.equal(text.status, 0);
    assert.match(text.stdout, /✓ 6 entidades válidas/);
    assert.match(text.stderr, /⚠ WRN-002: sem seção Critérios de aceite/);

    const index = buildIndex(warnRoot, readEntities(warnRoot));
    const byId = id => index.tickets.find(ticket => ticket.id === id);
    assert.deepEqual(byId('WRN-001').acceptance, { done: 1, total: 2 });
    assert.deepEqual(byId('WRN-001').warnings, []);
    assert.equal(byId('WRN-002').acceptance, null);
    assert.deepEqual(byId('WRN-003').acceptance, { done: 0, total: 0 });
    assert.deepEqual(byId('WRN-003').warnings, ['Critérios de aceite sem itens de checklist']);

    const mcp = runMcp([{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planner_validate', arguments: {} } }], warnRoot);
    assert.deepEqual(JSON.parse(mcp.responses[0].result.content[0].text), JSON.parse(json.stdout));
  } finally {
    fs.rmSync(warnRoot, { recursive: true, force: true });
  }
});
