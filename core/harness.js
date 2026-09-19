const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Adaptador do Claude Code. Cada resposta do assistente fica nos transcripts do projeto
// (`<config>/projects/<raiz codificada>/*.jsonl`) com `effort`, `message.model` e
// `message.usage`. Só esses arquivos locais são lidos; nada é enviado a lugar nenhum.
function claudeCodeProjectDir(root, env = process.env) {
  const configDir = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(configDir, 'projects', path.resolve(root).replace(/[^A-Za-z0-9]/g, '-'));
}

function jsonlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonlFiles(entryPath);
    return entry.name.endsWith('.jsonl') ? [entryPath] : [];
  });
}

function readRecords(directory) {
  return jsonlFiles(directory).flatMap(file => fs.readFileSync(file, 'utf8').split('\n').flatMap(line => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Mudanças de status feitas pelo agente com `planner set <id> status=<x> --yes`. Só contam
// comandos que o próprio Planner executou na raiz: trechos com PLANNER_ROOT apontam para outro
// plano e textos citados em heredocs ou documentação não começam um segmento de comando.
function statusChanges(records, id) {
  const results = new Map();
  for (const record of records) {
    if (record.type !== 'user') continue;
    for (const block of record.message?.content ?? []) {
      if (block?.type === 'tool_result') results.set(block.tool_use_id, block);
    }
  }

  const command = new RegExp(
    `^\\s*(?:npx\\s+planner|planner|node\\s+\\S*cli\\.js)\\s+set\\s+${escapeRegExp(id)}\\s+(?:[^\\n]*\\s)?status=(\\w+)(?=\\s|$)[^\\n]*--yes`
  );
  const changes = [];
  for (const record of records) {
    if (record.type !== 'assistant') continue;
    for (const block of record.message?.content ?? []) {
      if (block?.type !== 'tool_use' || typeof block.input?.command !== 'string') continue;
      const result = results.get(block.id);
      const output = JSON.stringify(result?.content ?? '');
      if (result?.is_error || !/Gravado em/.test(output)) continue;
      for (const segment of block.input.command.split(/&&|\|\||;|\n/)) {
        const match = segment.match(command);
        if (match) changes.push({ status: match[1], at: record.timestamp });
      }
    }
  }
  return changes.sort((a, b) => a.at.localeCompare(b.at));
}

// Janela de trabalho do ticket: do primeiro `in_progress` ao último `done`, ou até agora.
function workWindow(records, id, now) {
  const changes = statusChanges(records, id);
  const started = changes.find(change => change.status === 'in_progress');
  const finished = [...changes].reverse().find(change => change.status === 'done');
  return { start: started?.at ?? null, end: finished?.at ?? now };
}

const unique = values => [...new Set(values.filter(Boolean))];

// Soma o consumo das respostas dentro da janela. O transcript repete a mesma mensagem em uma
// linha por bloco de conteúdo, com o mesmo usage; contar cada `message.id` uma vez evita somar
// o mesmo consumo várias vezes. Leitura de cache fica separada porque domina o total.
function usageBetween(records, start, end) {
  const messages = new Map();
  for (const record of records) {
    if (record.type !== 'assistant' || !record.message?.usage || !record.timestamp) continue;
    if (record.timestamp < start || record.timestamp > end) continue;
    const key = record.message.id ?? record.uuid;
    if (!messages.has(key)) messages.set(key, record);
  }

  const selected = [...messages.values()];
  const sum = field => selected.reduce((total, record) => total + (Number(record.message.usage[field]) || 0), 0);
  return {
    messages: selected.length,
    models: unique(selected.map(record => record.message.model).filter(model => !model.startsWith('<'))).sort(),
    efforts: unique(selected.map(record => record.effort)).sort(),
    versions: unique(selected.map(record => record.version)).sort(),
    sessions: unique(selected.map(record => record.sessionId)).sort(),
    tokens: sum('input_tokens') + sum('output_tokens') + sum('cache_creation_input_tokens'),
    tokensCacheRead: sum('cache_read_input_tokens')
  };
}

// Evidência derivada do Claude Code, ou null quando não há transcript com respostas na janela.
function claudeCodeEvidence(root, id, { start, end, env = process.env, now = new Date().toISOString() } = {}) {
  const directory = claudeCodeProjectDir(root, env);
  const records = readRecords(directory);
  if (!records.length) return null;

  const window = workWindow(records, id, now);
  const from = start ?? window.start;
  const to = end ?? window.end;
  if (!from) {
    throw new Error(`não encontrei o início de ${id} (planner set ${id} status=in_progress --yes) nos transcripts do Claude Code; informe start=<data ISO>`);
  }
  if (from > to) throw new Error(`início ${from} depois do fim ${to}`);

  const usage = usageBetween(records, from, to);
  if (!usage.messages) return null;
  return {
    harness: `Claude Code${usage.versions.length ? ` ${usage.versions.join(', ')}` : ''}`,
    model: usage.models.join(', ') || 'unknown',
    effort: usage.efforts.join(', ') || 'unknown',
    tokens: String(usage.tokens),
    tokens_cache_read: String(usage.tokensCacheRead),
    started_at: from,
    completed_at: to,
    sessions: usage.sessions.join(', '),
    source: `transcripts do Claude Code (${usage.messages} respostas)`
  };
}

module.exports = { claudeCodeEvidence, claudeCodeProjectDir, statusChanges, usageBetween, workWindow };
