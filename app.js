import { escapeHtml, renderMarkdown } from './markdown.mjs';

// Status opcionais só ganham card e coluna quando existe algum item neles.
const STATUS = [
  ['draft', 'Rascunho', { optional: true }],
  ['planned', 'Planejado'],
  ['in_progress', 'Em andamento'],
  ['blocked', 'Bloqueado'],
  ['done', 'Concluído'],
  ['canceled', 'Cancelado', { optional: true }]
];

const statusLabel = new Map(STATUS.map(([key, label]) => [key, label]));
const DOCUMENT_TYPES = new Map([['spec', 'Especificação'], ['decision', 'Decisão']]);

// Sem data no frontmatter, o número do id indica a ordem de criação: maior id, mais recente.
function byRecency(a, b) {
  const number = entity => Number(String(entity.id).match(/(\d+)$/)?.[1] ?? -1);
  return number(b) - number(a) || String(b.id).localeCompare(String(a.id));
}

async function loadBranch() {
  try {
    const response = await fetch('../.git/HEAD');
    if (!response.ok) return null;
    return (await response.text()).match(/^ref: refs\/heads\/(.+)$/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function loadData() {
  const response = await fetch('../.planner/index.json');
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o índice (${response.status})`);
  }
  return response.json();
}

function render(data, branch) {
  const entities = data.tickets;
  const initiatives = entities.filter(entity => entity.type === 'initiative');
  const documents = entities.filter(entity => DOCUMENT_TYPES.has(entity.type)).sort(byRecency);
  const tickets = entities.filter(entity => entity.type !== 'initiative' && !DOCUMENT_TYPES.has(entity.type));
  const byStatus = key => tickets.filter(ticket => ticket.status === key);
  const statuses = STATUS.filter(([key, , options]) => !options?.optional || byStatus(key).length);
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">${escapeHtml(data.repository.name)} / planner</p>
          <h1>${escapeHtml(data.repository.initiative)}</h1>
          ${branch ? `<p class="muted">Branch atual: <code>${escapeHtml(branch)}</code></p>` : ''}
        </div>
        <span class="local-badge">LOCAL · GIT-NATIVE</span>
      </header>

      <section class="summary-grid" aria-label="Resumo dos tickets">
        ${statuses.map(([key, label]) => `
          <article class="summary-card status-${key}">
            <span>${label}</span>
            <strong>${byStatus(key).length}</strong>
          </article>
        `).join('')}
      </section>

      ${initiatives.length ? `
        <section class="initiatives" aria-labelledby="initiatives-heading">
          <h2 id="initiatives-heading">Iniciativas</h2>
          <div class="initiative-list">
            ${initiatives.map(initiative => `
              <button class="initiative" type="button" data-ticket="${escapeHtml(initiative.id)}">
                <span class="ticket-id">${escapeHtml(initiative.id)} · ${escapeHtml(statusLabel.get(initiative.status) ?? initiative.status ?? '')}</span>
                <strong>${escapeHtml(initiative.title)}</strong>
              </button>
            `).join('')}
          </div>
        </section>
      ` : ''}

      ${documents.length ? `
        <section class="documents" aria-labelledby="documents-heading">
          <h2 id="documents-heading">Especificações e decisões</h2>
          <div class="initiative-list">
            ${documents.map(item => `
              <button class="initiative" type="button" data-ticket="${escapeHtml(item.id)}">
                <span class="ticket-id">${escapeHtml(item.id)} · ${DOCUMENT_TYPES.get(item.type)} · ${escapeHtml(statusLabel.get(item.status) ?? item.status ?? '')}</span>
                <strong>${escapeHtml(item.title)}</strong>
                <span class="ticket-description">${escapeHtml(item.description)}</span>
              </button>
            `).join('')}
          </div>
        </section>
      ` : ''}

      <section class="workspace">
        <div class="section-heading">
          <div>
            <p class="eyebrow">leitura e visualização</p>
            <h2>Backlog da iniciativa</h2>
          </div>
          <span class="muted">${tickets.length} tickets indexados</span>
        </div>
        <div class="board" style="--columns: ${statuses.length}">
          ${statuses.map(([key, label]) => `
            <section class="column" aria-labelledby="column-${key}">
              <div class="column-heading">
                <h3 id="column-${key}">${label}</h3>
                <span>${byStatus(key).length}</span>
              </div>
              <div class="ticket-list">
                ${byStatus(key).map(ticketCard).join('') || '<p class="empty">Nenhum item</p>'}
              </div>
            </section>
          `).join('')}
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll('[data-ticket]').forEach(card => {
    card.addEventListener('click', () => showDetails(entities, card.dataset.ticket));
  });
}

function ticketCard(ticket) {
  return `
    <button class="ticket" type="button" data-ticket="${escapeHtml(ticket.id)}">
      <span class="ticket-id">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.type)}</span>
      <strong>${escapeHtml(ticket.title)}</strong>
      <span class="ticket-description">${escapeHtml(ticket.description)}</span>
      <span class="ticket-meta">
        <span>${escapeHtml(ticket.phase)}</span>
        ${ticket.warnings?.length
          ? `<span class="warning-badge" title="${escapeHtml(ticket.warnings.join('; '))}">sem critérios</span>`
          : ticket.acceptance?.total ? `<span>${ticket.acceptance.done}/${ticket.acceptance.total}</span>` : ''}
        <span>${escapeHtml(ticket.priority)}</span>
      </span>
    </button>
  `;
}

// Liga cada id ao próprio detalhe; ids fora do índice aparecem sem link.
function entityLinks(entities, ids, empty) {
  if (!ids.length) return empty;
  return ids.map(id => {
    const entity = entities.find(item => item.id === id);
    if (!entity) return `<span class="missing">${escapeHtml(id)}</span>`;
    return `<button class="entity-link" type="button" data-entity="${escapeHtml(id)}" title="${escapeHtml(entity.title)}">${escapeHtml(id)}</button>`;
  }).join(' ');
}

// O corpo vem do Markdown de origem, não do índice: o índice guarda só a projeção dos campos.
async function loadBody(ticket) {
  if (!ticket.source) return null;
  const response = await fetch(`../${ticket.source.split('/').map(encodeURIComponent).join('/')}`);
  if (!response.ok) throw new Error(`Não foi possível carregar ${ticket.source} (${response.status})`);
  return response.text();
}

function acceptanceLabel(ticket) {
  const warnings = (ticket.warnings ?? []).map(warning => `<span class="warning-badge">${escapeHtml(warning)}</span>`).join(' ');
  if (warnings) return warnings;
  if (!ticket.acceptance) return '—';
  return ticket.acceptance.total ? `${ticket.acceptance.done}/${ticket.acceptance.total} concluídos` : 'Seção sem checklist';
}

function showDetails(entities, id) {
  const ticket = entities.find(entity => entity.id === id);
  if (!ticket) return;
  const dependents = entities.filter(entity => entity.dependsOn.includes(id)).map(entity => entity.id);
  document.querySelector('.details-dialog')?.close();

  const details = document.createElement('dialog');
  details.className = 'details-dialog';
  details.innerHTML = `
    <button class="dialog-close" type="button" aria-label="Fechar">×</button>
    <p class="eyebrow">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.type)}</p>
    <h2>${escapeHtml(ticket.title)}</h2>
    <dl class="details-list">
      <div><dt>Status</dt><dd>${escapeHtml(statusLabel.get(ticket.status) ?? ticket.status ?? '—')}</dd></div>
      <div><dt>Prioridade</dt><dd>${escapeHtml(ticket.priority ?? '—')}</dd></div>
      <div><dt>Fase</dt><dd>${escapeHtml(ticket.phase ?? '—')}</dd></div>
      <div><dt>Labels</dt><dd>${ticket.labels.length ? ticket.labels.map(label => `<span class="label">${escapeHtml(label)}</span>`).join(' ') : '—'}</dd></div>
      <div><dt>Depende de</dt><dd>${entityLinks(entities, ticket.dependsOn, 'Nenhuma dependência')}</dd></div>
      <div><dt>Dependentes</dt><dd>${entityLinks(entities, dependents, 'Nenhum dependente')}</dd></div>
      <div><dt>Critérios de aceite</dt><dd>${acceptanceLabel(ticket)}</dd></div>
      <div><dt>Fonte</dt><dd><code>${escapeHtml(ticket.source || 'índice')}</code></dd></div>
    </dl>
    <article class="ticket-body" aria-live="polite"><p class="muted">Carregando conteúdo…</p></article>
  `;
  details.querySelector('.dialog-close').addEventListener('click', () => details.close());
  details.querySelectorAll('[data-entity]').forEach(link => {
    link.addEventListener('click', () => showDetails(entities, link.dataset.entity));
  });
  details.addEventListener('close', () => details.remove());
  document.body.append(details);
  details.showModal();

  const body = details.querySelector('.ticket-body');
  loadBody(ticket).then(source => {
    if (source === null) {
      body.innerHTML = `<p class="muted">${escapeHtml(ticket.description) || 'Sem conteúdo.'}</p>`;
      return;
    }
    body.innerHTML = renderMarkdown(source) || '<p class="muted">Sem conteúdo.</p>';
  }).catch(error => {
    body.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p><p>${escapeHtml(ticket.description)}</p>`;
  });
}

Promise.all([loadData(), loadBranch()]).then(([data, branch]) => render(data, branch)).catch(error => {
  document.querySelector('#app').innerHTML = `<main class="error"><h1>Planner indisponível</h1><p>${escapeHtml(error.message)}</p><p>Sirva o diretório do repositório por HTTP para carregar o índice local.</p></main>`;
});
