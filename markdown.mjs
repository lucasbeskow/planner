// Renderizador Markdown mínimo para o detalhe dos tickets, sem dependências. Cobre o que as
// entidades usam: títulos, parágrafos, listas, checklists, citações, blocos de código, código
// inline, negrito, itálico e links. Todo texto é escapado antes de receber marcação.

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function stripFrontmatter(source) {
  const match = String(source).match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return (match ? source.slice(match[0].length) : source).trim();
}

// Só http(s), mailto e caminhos relativos viram links; o resto fica como texto.
function safeHref(href) {
  return /^(https?:|mailto:|#|\.{0,2}\/|[\w-]+(\/|\.md|$))/i.test(href) ? href : null;
}

function inline(text) {
  const codes = [];
  let html = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  html = html
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, href) => {
      const safe = safeHref(href.replaceAll('&amp;', '&'));
      return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noreferrer">${label}</a>` : match;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => `<code>${codes[index]}</code>`);
}

const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function renderMarkdown(source) {
  const lines = stripFrontmatter(source).split(/\r?\n/);
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*(```|~~~)\s*([\w-]*)/);
    if (fence) {
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(fence[1])) body.push(lines[index++]);
      index += 1;
      const language = fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : '';
      html.push(`<pre><code${language}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (heading) {
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quote.push(lines[index++].trimStart().replace(/^>\s?/, ''));
      }
      html.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    if (listItem.test(line)) {
      const ordered = /^\d/.test(line.match(listItem)[2]);
      const items = [];
      while (index < lines.length && lines[index].trim()) {
        const item = lines[index].match(listItem);
        if (item) items.push(item[3]);
        else if (items.length) items[items.length - 1] += ` ${lines[index].trim()}`;
        index += 1;
      }
      const rendered = items.map(item => {
        const task = item.match(/^\[([ xX])\]\s+(.*)$/);
        if (!task) return `<li>${inline(item)}</li>`;
        const checked = task[1] !== ' ';
        return `<li class="task${checked ? ' done' : ''}"><input type="checkbox" disabled${checked ? ' checked' : ''}> ${inline(task[2])}</li>`;
      });
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${rendered.join('')}</${tag}>`);
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length && lines[index].trim()
      && !/^(#{1,6}\s|\s*(```|~~~)|\s*>)/.test(lines[index]) && !listItem.test(lines[index])
    ) {
      paragraph.push(lines[index++].trim());
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return html.join('\n');
}

