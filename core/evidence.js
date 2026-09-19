const fs = require('node:fs');
const path = require('node:path');
const { unifiedDiff } = require('./edit');
const { claudeCodeEvidence } = require('./harness');
const { EVIDENCE_FIELDS, parseEvidence, readEntities } = require('./planner');

// Ordem dos campos na seção; campos desconhecidos já existentes vêm depois, na ordem original.
const FIELD_ORDER = [
  'harness', 'model', 'effort', 'tokens', 'tokens_cache_read', 'started_at', 'completed_at',
  'sessions', 'source', 'validation', 'limitações'
];
const MANUAL_FIELDS = [...FIELD_ORDER, 'start', 'end'];
const HEADING = /^(#{1,6})\s+(evid[êe]ncias?|evidence)\s*$/i;

function parseAssignments(texts) {
  const values = {};
  for (const text of texts) {
    const match = String(text).match(/^([\p{L}_][\p{L}\p{N}_]*)=([\s\S]*)$/u);
    if (!match) throw new Error(`campo inválido: ${text} (use campo=valor)`);
    const field = match[1] === 'limitacoes' ? 'limitações' : match[1];
    if (!MANUAL_FIELDS.includes(field)) throw new Error(`campo não aceito em evidence: ${field} (aceitos: ${MANUAL_FIELDS.join(', ')})`);
    const value = match[2].replace(/\s+/g, ' ').trim();
    if (!value) throw new Error(`${field} vazio`);
    values[field] = value;
  }
  for (const field of ['start', 'end']) {
    if (values[field] === undefined) continue;
    const date = new Date(values[field]);
    if (Number.isNaN(date.getTime())) throw new Error(`${field} não é uma data ISO: ${values[field]}`);
    values[field] = date.toISOString();
  }
  return values;
}

// Substitui a seção Evidência (até o próximo título de mesmo nível ou superior) ou a cria no fim.
function replaceSection(content, evidence) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
  const ordered = [
    ...FIELD_ORDER.filter(field => evidence[field] !== undefined),
    ...Object.keys(evidence).filter(field => !FIELD_ORDER.includes(field))
  ];
  const section = ordered.map(field => `- ${field}: ${evidence[field]}`);

  const start = lines.findIndex(line => HEADING.test(line));
  if (start < 0) return [...lines, '', '## Evidência', '', ...section, ''].join(newline);

  const level = lines[start].match(HEADING)[1].length;
  const next = lines.findIndex((line, index) => index > start && (line.match(/^(#{1,6})\s/)?.[1].length ?? 7) <= level);
  const end = next < 0 ? lines.length : next;
  const tail = next < 0 ? [] : ['', ...lines.slice(end)];
  return [...lines.slice(0, start + 1), '', ...section, ...tail, ''].join(newline);
}

// Calcula a nova seção Evidência sem gravar. Valores informados sobrescrevem os do harness, que
// sobrescrevem os já registrados; `validation` e `limitações` existentes são preservados.
function planEvidence(root, id, assignmentTexts = [], options = {}) {
  if (!id) throw new Error('informe o id da entidade para evidence');
  const manual = parseAssignments(assignmentTexts);
  const entity = readEntities(root).find(item => item.id === id);
  if (!entity) throw new Error(`Entidade não encontrada: ${id}`);

  const { start, end, ...fields } = manual;
  const harness = claudeCodeEvidence(root, id, { start, end, env: options.env, now: options.now });
  const evidence = { ...(entity.evidence ?? {}), ...(harness ?? {}), ...fields };

  const missing = EVIDENCE_FIELDS.filter(field => !evidence[field]);
  if (missing.length) {
    const reason = harness ? '' : 'não há transcript do Claude Code para este repositório; ';
    throw new Error(`${reason}informe ${missing.map(field => `${field}=`).join(' ')} (use unknown quando o valor não existir)`);
  }

  const file = entity.filePath;
  const before = fs.readFileSync(path.join(root, file), 'utf8');
  const after = replaceSection(before, evidence);
  return {
    id,
    file,
    evidence,
    derived: Boolean(harness),
    changed: after !== before,
    diff: unifiedDiff(file, before.replace(/\r\n/g, '\n'), after.replace(/\r\n/g, '\n')),
    before,
    after
  };
}

module.exports = { planEvidence, replaceSection };
