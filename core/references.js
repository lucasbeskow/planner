const fs = require('node:fs');
const path = require('node:path');

const ID_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-\d+$/;

// Código cercado e inline costuma conter exemplos (`planner show PLN-002`, `[x](y)`), que não são
// referências reais do texto.
function prose(body) {
  return String(body ?? '')
    .replace(/^\s*(```|~~~)[\s\S]*?^\s*\1[^\n]*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

function unique(values) {
  return [...new Set(values)];
}

// Prefixos de id em uso no plano; só menções com esses prefixos contam, para que textos como
// UTF-8 ou ISO-8601 não sejam lidos como referência a entidades.
function idPrefixes(entities) {
  return unique(entities.map(entity => String(entity.id ?? '').match(ID_PATTERN)?.[1]).filter(Boolean));
}

// Referências do corpo de uma entidade, sem acessar a rede: links para arquivos do repositório
// (resolvidos a partir do arquivo da entidade, ou da raiz quando começam com /), menções a ids e
// URLs externas, que são só listadas.
function entityReferences(root, entity, ids, prefixes) {
  const text = prose(entity.body);
  const links = [...text.matchAll(/\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map(match => match[1]);
  const external = unique([
    ...links.filter(href => /^[a-z][a-z0-9+.-]*:/i.test(href)),
    ...[...text.matchAll(/<?(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])/g)].map(match => match[1])
  ]).filter(href => /^https?:\/\//i.test(href)).sort();

  const directory = path.dirname(path.join(root, entity.filePath));
  const files = unique(links.filter(href => !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#')))
    .map(href => {
      const target = decodeURIComponent(href.replace(/[#?].*$/, ''));
      const absolute = target.startsWith('/') ? path.join(root, target) : path.resolve(directory, target);
      return { href, path: path.relative(root, absolute).split(path.sep).join('/'), exists: fs.existsSync(absolute) };
    });

  const mentionPattern = prefixes.length ? new RegExp(`\\b(?:${prefixes.join('|')})-\\d+\\b`, 'g') : null;
  const entities = mentionPattern
    ? unique(text.match(mentionPattern) ?? []).filter(id => id !== entity.id).sort().map(id => ({ id, exists: ids.has(id) }))
    : [];

  return { files, entities, external };
}

function referenceWarnings(references) {
  return [
    ...references.files.filter(file => !file.exists).map(file => `link para arquivo inexistente: ${file.href}`),
    ...references.entities.filter(item => !item.exists).map(item => `menção a entidade inexistente: ${item.id}`)
  ];
}

module.exports = { entityReferences, idPrefixes, referenceWarnings };
