const fs = require('node:fs');
const path = require('node:path');
const { ALLOWED_STATUSES, parseFrontmatter, readEntities, stripComment, validationIssues } = require('./planner');
const { transitionIssues } = require('./transitions');

const EDITABLE_FIELDS = ['status', 'priority', 'labels'];
// Prioridade e labels não têm vocabulário fechado; exigir um token simples evita valores que
// precisariam de aspas ou quebrariam o subconjunto de YAML aceito pelo parser.
const TOKEN = /^[\p{L}\p{N}_-]+$/u;

// Aceita `campo=valor`, e para labels também `labels+=valor` e `labels-=valor`, com vírgulas.
function parseAssignment(text) {
  const match = String(text).match(/^([A-Za-z_]\w*)(\+=|-=|=)(.*)$/);
  if (!match) throw new Error(`alteração inválida: ${text} (use campo=valor)`);
  const [, field, operator, rawValue] = match;
  if (!EDITABLE_FIELDS.includes(field)) {
    throw new Error(`campo não editável: ${field} (editáveis: ${EDITABLE_FIELDS.join(', ')})`);
  }
  if (field !== 'labels' && operator !== '=') throw new Error(`${field} aceita apenas =`);

  if (field === 'labels') {
    const values = rawValue.split(',').map(value => value.trim()).filter(Boolean);
    for (const value of values) {
      if (!TOKEN.test(value)) throw new Error(`label inválida: ${value} (use letras, números, _ ou -)`);
    }
    return { field, operator, values };
  }

  const value = rawValue.trim();
  if (field === 'status' && !ALLOWED_STATUSES.includes(value)) {
    throw new Error(`status inválido: ${value || '(vazio)'} (aceitos: ${ALLOWED_STATUSES.join(', ')})`);
  }
  if (field === 'priority' && !TOKEN.test(value)) {
    throw new Error(`prioridade inválida: ${value || '(vazio)'} (use letras, números, _ ou -)`);
  }
  return { field, operator, value };
}

function nextLabels(current, assignment) {
  const labels = Array.isArray(current) ? current.map(String) : [];
  if (assignment.operator === '=') return [...new Set(assignment.values)];
  if (assignment.operator === '+=') return [...new Set([...labels, ...assignment.values])];
  return labels.filter(label => !assignment.values.includes(label));
}

// Comentário no fim da linha (` # ...`), preservado quando o valor muda.
function trailingComment(line) {
  const content = stripComment(line);
  return line.slice(content.length).length ? ` ${line.slice(content.length).trim()}` : '';
}

function frontmatterBounds(lines, filePath) {
  if (lines[0]?.trim() !== '---') throw new Error(`${filePath}: arquivo sem frontmatter`);
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) throw new Error(`${filePath}: frontmatter não terminou com ---`);
  return end;
}

const fieldLine = field => new RegExp(`^${field}:(\\s|$)`);
const blockItem = /^\s*-\s+/;

// Troca só as linhas do campo alterado; o restante do arquivo, inclusive comentários e ordem
// das chaves, permanece idêntico.
function setScalar(lines, end, field, value) {
  const index = lines.slice(1, end).findIndex(line => fieldLine(field).test(line)) + 1;
  if (index === 0) {
    lines.splice(end, 0, `${field}: ${value}`);
    return;
  }
  lines[index] = `${field}: ${value}${trailingComment(lines[index])}`;
}

function setList(lines, end, field, values) {
  const index = lines.slice(1, end).findIndex(line => fieldLine(field).test(line)) + 1;
  if (index === 0) {
    lines.splice(end, 0, ...(values.length ? [`${field}:`, ...values.map(value => `  - ${value}`)] : [`${field}: []`]));
    return;
  }

  const comment = trailingComment(lines[index]);
  const inline = stripComment(lines[index]).slice(field.length + 1).trim();
  let last = index;
  if (!inline) while (last + 1 < end && blockItem.test(lines[last + 1])) last += 1;

  let replacement;
  if (!values.length) {
    replacement = [`${field}: []${comment}`];
  } else if (inline) {
    replacement = [`${field}: [${values.join(', ')}]${comment}`];
  } else {
    const indent = last > index ? lines[index + 1].match(/^\s*/)[0] : '  ';
    replacement = [`${field}:${comment}`, ...values.map(value => `${indent}- ${value}`)];
  }
  lines.splice(index, last - index + 1, ...replacement);
}

// Diff de linhas por maior subsequência comum; os arquivos de entidade são pequenos.
function unifiedDiff(filePath, before, after, context = 3) {
  const a = before.split('\n');
  const b = after.split('\n');
  const lengths = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const operations = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      operations.push({ type: ' ', text: a[i], i: i++, j: j++ });
    } else if (i < a.length && (j === b.length || lengths[i + 1][j] >= lengths[i][j + 1])) {
      operations.push({ type: '-', text: a[i], i: i++, j });
    } else {
      operations.push({ type: '+', text: b[j], i, j: j++ });
    }
  }

  const changed = operations.map((operation, index) => (operation.type === ' ' ? -1 : index)).filter(index => index >= 0);
  if (!changed.length) return '';

  const hunks = [];
  for (const index of changed) {
    const start = Math.max(0, index - context);
    const stop = Math.min(operations.length - 1, index + context);
    const previous = hunks[hunks.length - 1];
    if (previous && start <= previous.stop + 1) previous.stop = Math.max(previous.stop, stop);
    else hunks.push({ start, stop });
  }

  const output = [`--- a/${filePath}`, `+++ b/${filePath}`];
  for (const { start, stop } of hunks) {
    const slice = operations.slice(start, stop + 1);
    const oldCount = slice.filter(operation => operation.type !== '+').length;
    const newCount = slice.filter(operation => operation.type !== '-').length;
    output.push(`@@ -${slice[0].i + (oldCount ? 1 : 0)},${oldCount} +${slice[0].j + (newCount ? 1 : 0)},${newCount} @@`);
    output.push(...slice.map(operation => `${operation.type}${operation.text}`));
  }
  return output.join('\n');
}

// Calcula a edição sem gravar nada. A escrita só acontece em applyEdit, com o plano revisado.
// `force` ignora as regras de transição de status, nunca a validação do plano.
function planEdit(root, id, assignmentTexts, { force = false } = {}) {
  if (!id) throw new Error('informe o id da entidade para set');
  if (!assignmentTexts.length) throw new Error('informe ao menos uma alteração, como status=done');
  const assignments = assignmentTexts.map(parseAssignment);

  const entities = readEntities(root);
  const entity = entities.find(item => item.id === id);
  if (!entity) throw new Error(`Entidade não encontrada: ${id}`);

  const absolutePath = path.join(root, entity.filePath);
  const before = fs.readFileSync(absolutePath, 'utf8');
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  const lines = before.split(/\r?\n/);
  frontmatterBounds(lines, entity.filePath);

  // Escalares são comparados como texto: `priority: 1` no arquivo equivale a priority=1.
  const values = {
    status: entity.status == null ? null : String(entity.status),
    priority: entity.priority == null ? null : String(entity.priority),
    labels: Array.isArray(entity.labels) ? entity.labels.map(String) : []
  };
  const changes = [];
  for (const assignment of assignments) {
    const previous = values[assignment.field];
    const next = assignment.field === 'labels' ? nextLabels(previous, assignment) : assignment.value;
    values[assignment.field] = next;
    const existing = changes.find(change => change.field === assignment.field);
    if (existing) existing.after = next;
    else changes.push({ field: assignment.field, before: previous, after: next });
  }
  // Uma alteração que volta ao valor original, como labels+=x labels-=x, não toca o arquivo.
  const effective = changes.filter(change => JSON.stringify(change.before) !== JSON.stringify(change.after));

  for (const change of effective) {
    const currentEnd = frontmatterBounds(lines, entity.filePath);
    if (change.field === 'labels') setList(lines, currentEnd, 'labels', change.after);
    else setScalar(lines, currentEnd, change.field, change.after);
  }

  const after = lines.join(newline);
  const plan = {
    id,
    file: entity.filePath,
    changes: effective,
    diff: unifiedDiff(entity.filePath, before.replace(/\r\n/g, '\n'), after.replace(/\r\n/g, '\n')),
    before,
    after
  };

  const statusChange = effective.find(change => change.field === 'status');
  if (statusChange && !force) {
    const refused = transitionIssues(entities, entity, statusChange.after);
    if (refused.length) throw new Error(`transição recusada:\n${refused.map(reason => `  - ${reason}`).join('\n')}`);
  }

  // Rejeita a edição se ela introduzir problemas de validação que ainda não existiam.
  if (effective.length) {
    const edited = entities.map(item => (item.id === id ? { ...item, ...values } : item));
    const known = new Set(validationIssues(entities).map(issue => issue.message));
    const introduced = validationIssues(edited).map(issue => issue.message).filter(message => !known.has(message));
    if (introduced.length) throw new Error(`a alteração deixaria o plano inválido: ${introduced.join('; ')}`);
  }

  // Confere que o arquivo gerado continua legível e com os valores pretendidos.
  const reparsed = parseFrontmatter(after, entity.filePath).attributes;
  for (const change of effective) {
    const actual = change.field === 'labels' ? (reparsed.labels ?? []).map(String) : String(reparsed[change.field]);
    if (JSON.stringify(actual) !== JSON.stringify(change.after)) {
      throw new Error(`${entity.filePath}: não foi possível editar ${change.field} preservando o arquivo`);
    }
  }

  return plan;
}

// Grava somente se o arquivo não mudou desde o plano, para não sobrescrever edições concorrentes.
function applyEdit(root, plan) {
  const absolutePath = path.join(root, plan.file);
  if (fs.readFileSync(absolutePath, 'utf8') !== plan.before) {
    throw new Error(`${plan.file} mudou desde que o diff foi calculado; execute o comando novamente`);
  }
  fs.writeFileSync(absolutePath, plan.after);
}

module.exports = { EDITABLE_FIELDS, TOKEN, applyEdit, parseAssignment, planEdit, unifiedDiff };
