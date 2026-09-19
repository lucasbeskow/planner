const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const util = require('node:util');
const { buildIndex, contextFor, parseFrontmatter, readEntities, validate } = require('../core/planner');
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
  assert.deepEqual(Object.keys(ticket).sort(), ['dependsOn', 'description', 'id', 'labels', 'phase', 'priority', 'source', 'status', 'title', 'type']);
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
  assert.deepEqual(JSON.parse(valid.stdout), { valid: true, errors: [], total: 4 });
  assert.equal(invalid.status, 1);
  assert.deepEqual(JSON.parse(invalid.stdout), { valid: false, errors: ['FIX-005: dependência inexistente FIX-999'], total: 5 });
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
  const { acceptanceProgress, renderMarkdown } = await import('../markdown.mjs');
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
