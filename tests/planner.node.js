const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildIndex, contextFor, parseFrontmatter, readEntities, validate } = require('../core/planner');

const root = path.resolve(__dirname, '../..');
const cliPath = path.join(root, 'planner/cli.js');
const mcpPath = path.join(root, 'planner/mcp.js');

// Os testes de comportamento usam um conjunto próprio de entidades, para não depender
// da quantidade de tickets versionados nem do branch atual.
const fixtureEntities = {
  'initiatives/FIX-001-iniciativa.md': { id: 'FIX-001', type: 'initiative', status: 'in_progress', dependsOn: [] },
  'tickets/FIX-002-planejado.md': { id: 'FIX-002', type: 'task', status: 'planned', dependsOn: ['FIX-001'] },
  'tickets/FIX-003-concluido.md': { id: 'FIX-003', type: 'task', status: 'done', dependsOn: ['FIX-002'] },
  'tickets/FIX-004-bloqueado.md': { id: 'FIX-004', type: 'task', status: 'blocked', dependsOn: [] }
};

function createFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-fixture-'));
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
test.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

function runCli(...args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PLANNER_ROOT: fixtureRoot }
  });
}

function runMcp(messages) {
  const input = `${messages.map(message => JSON.stringify(message)).join('\n')}\n`;
  const processResult = spawnSync(process.execPath, [mcpPath], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: { ...process.env, PLANNER_ROOT: fixtureRoot }
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
  assert.deepEqual(validate(readEntities(root)), []);
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

test('o índice versionado é consistente', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, '.planner/index.json'), 'utf8'));

  assert.equal(index.summary.total, index.tickets.length);
  assert.ok(index.tickets.every(ticket => fs.existsSync(path.join(root, ticket.source))));
});

test('o índice é uma projeção regenerável dos arquivos Markdown', () => {
  const entities = readEntities(fixtureRoot);
  const index = buildIndex(fixtureRoot, entities);

  assert.equal(index.summary.total, entities.length);
  assert.deepEqual(index.summary, { total: 4, planned: 1, inProgress: 1, blocked: 1, done: 1 });
  assert.equal(index.tickets.find(ticket => ticket.id === 'FIX-003').status, 'done');
  assert.equal(index.tickets.find(ticket => ticket.id === 'FIX-003').source, '.planner/tickets/FIX-003-concluido.md');
});

test('o índice contém os dados necessários para o dashboard', () => {
  const index = buildIndex(fixtureRoot, readEntities(fixtureRoot));
  const ticket = index.tickets.find(item => item.id === 'FIX-002');

  assert.ok(index.repository.name);
  assert.ok(index.repository.initiative);
  assert.ok(index.repository.branch);
  assert.deepEqual(Object.keys(index.summary), ['total', 'planned', 'inProgress', 'blocked', 'done']);
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

test('a CLI oferece ajuda e erros acionáveis', () => {
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

test('CLI e MCP retornam o mesmo contrato de domínio', () => {
  const cliStatus = JSON.parse(runCli('status', '--json').stdout);
  const mcp = runMcp([
    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'planner_status', arguments: {} } }
  ]);
  const mcpStatus = JSON.parse(mcp.responses[0].result.content[0].text);

  assert.deepEqual(mcpStatus, cliStatus);
});
