const { spawnSync } = require('node:child_process');

// Separadores de controle não aparecem em mensagens de commit comuns e evitam ambiguidade com
// quebras de linha do corpo.
const FIELD = '\x1f';
const RECORD = '\x1e';

// Números de pull request citados pelo commit: squash merges (`título (#12)`) e merge commits
// (`Merge pull request #12 from ...`). Só o texto local é lido; nada é consultado na rede.
function pullRequestNumbers(subject) {
  const numbers = [
    ...subject.matchAll(/\(#(\d+)\)\s*$/g),
    ...subject.matchAll(/^Merge pull request #(\d+)\b/g),
    ...subject.matchAll(/^Merge branch .* into .*\(!(\d+)\)/g)
  ].map(match => Number(match[1]));
  return [...new Set(numbers)];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Commits do histórico local que citam o id no assunto ou no corpo. Retorna null quando o Git
// não está disponível ou a raiz não está em um repositório.
function commitsFor(root, id) {
  const result = spawnSync('git', [
    'log',
    '--fixed-strings',
    `--grep=${id}`,
    `--format=%H${FIELD}%an${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`
  ], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;

  // --fixed-strings também casa PLN-01 dentro de PLN-010; a fronteira de palavra filtra isso.
  const mention = new RegExp(`(^|[^\\w-])${escapeRegExp(id)}(?![\\w])`);
  return result.stdout
    .split(RECORD)
    .map(record => record.replace(/^\n/, ''))
    .filter(Boolean)
    .map(record => {
      const [hash, author, date, subject, body = ''] = record.split(FIELD);
      return { hash, shortHash: hash.slice(0, 7), author, date, subject, body: body.trim() };
    })
    .filter(commit => mention.test(`${commit.subject}\n${commit.body}`))
    .map(({ body, ...commit }) => ({ ...commit, pullRequests: pullRequestNumbers(commit.subject) }));
}

module.exports = { commitsFor, pullRequestNumbers };
