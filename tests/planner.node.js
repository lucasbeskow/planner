const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { buildIndex, contextFor, parseFrontmatter, readEntities, validate } = require('../core/planner');

const root = path.resolve(__dirname, '../..');

test('lê frontmatter escalar e arrays', () => {
  const parsed = parseFrontmatter(`---\nid: PLN-TEST\nstatus: planned\nlabels:\n  - parser\n  - core\n---\n\n## Objetivo\n\nLer arquivos.`, 'fixture.md');

  assert.equal(parsed.attributes.id, 'PLN-TEST');
  assert.equal(parsed.attributes.status, 'planned');
  assert.deepEqual(parsed.attributes.labels, ['parser', 'core']);
  assert.match(parsed.body, /Ler arquivos/);
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
