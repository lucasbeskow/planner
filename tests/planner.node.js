const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildIndex, contextFor, parseFrontmatter, readEntities, validate } = require('../core/planner');

const root = path.resolve(__dirname, '../..');
const cliPath = path.join(root, 'planner/cli.js');

function runCli(...args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd: root, encoding: 'utf8' });
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

test('carrega as entidades versionadas do Planner', () => {
  const entities = readEntities(root);
  assert.equal(entities.length, 10);
  assert.equal(entities.find(entity => entity.id === 'PLN-007').type, 'initiative');
});

test('não encontra erros no conjunto inicial', () => {
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
  const context = contextFor(readEntities(root), 'PLN-009');

  assert.equal(context.dependencies[0].id, 'PLN-008');
  assert.equal(context.dependents.length, 0);
});

test('o índice gerado permanece válido', () => {
  const index = JSON.parse(fs.readFileSync(path.join(root, '.planner/index.json'), 'utf8'));
  assert.equal(index.summary.total, index.tickets.length);
  assert.equal(index.repository.branch, 'planner');
  assert.equal(index.tickets.find(ticket => ticket.id === 'PLN-003').source, '.planner/tickets/PLN-003-ler-markdown.md');
});

test('o índice é uma projeção regenerável dos arquivos Markdown', () => {
  const entities = readEntities(root);
  const index = buildIndex(root, entities);

  assert.equal(index.summary.total, entities.length);
  assert.equal(index.tickets.find(ticket => ticket.id === 'PLN-005').status, 'done');
  assert.equal(index.tickets.find(ticket => ticket.id === 'PLN-005').source, '.planner/tickets/PLN-005-fonte-de-verdade.md');
});

test('o índice contém os dados necessários para o dashboard', () => {
  const index = buildIndex(root, readEntities(root));
  const ticket = index.tickets.find(item => item.id === 'PLN-002');

  assert.ok(index.repository.name);
  assert.ok(index.repository.initiative);
  assert.ok(index.repository.branch);
  assert.deepEqual(Object.keys(index.summary), ['total', 'planned', 'inProgress', 'blocked', 'done']);
  assert.deepEqual(Object.keys(ticket).sort(), ['dependsOn', 'description', 'id', 'labels', 'phase', 'priority', 'source', 'status', 'title', 'type']);
});

test('a CLI expõe saída estruturada para agentes', () => {
  const status = runCli('status', '--json');
  const list = runCli('list', 'planned', '--json');
  const context = runCli('context', 'PLN-009', '--json');

  assert.equal(status.status, 0);
  assert.equal(JSON.parse(status.stdout).total, 10);
  assert.equal(list.status, 0);
  assert.ok(JSON.parse(list.stdout).every(entity => entity.status === 'planned'));
  assert.equal(context.status, 0);
  assert.equal(JSON.parse(context.stdout).entity.id, 'PLN-009');
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
