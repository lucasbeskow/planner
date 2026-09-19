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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render(data, branch) {
  const entities = data.tickets;
  const initiatives = entities.filter(entity => entity.type === 'initiative');
  const tickets = entities.filter(entity => entity.type !== 'initiative');
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

      <section class="workspace">
        <div class="section-heading">
          <div>
            <p class="eyebrow">M0 · leitura e visualização</p>
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
    card.addEventListener('click', () => showDetails(entities.find(entity => entity.id === card.dataset.ticket)));
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
        <span>${escapeHtml(ticket.priority)}</span>
      </span>
    </button>
  `;
}

function showDetails(ticket) {
  const details = document.createElement('dialog');
  details.className = 'details-dialog';
  details.innerHTML = `
    <button class="dialog-close" type="button" aria-label="Fechar">×</button>
    <p class="eyebrow">${escapeHtml(ticket.id)} · ${escapeHtml(ticket.type)}</p>
    <h2>${escapeHtml(ticket.title)}</h2>
    <p>${escapeHtml(ticket.description)}</p>
    <dl class="details-list">
      <div><dt>Status</dt><dd>${escapeHtml(statusLabel.get(ticket.status) ?? ticket.status ?? '—')}</dd></div>
      <div><dt>Prioridade</dt><dd>${escapeHtml(ticket.priority ?? '—')}</dd></div>
      <div><dt>Fase</dt><dd>${escapeHtml(ticket.phase ?? '—')}</dd></div>
      <div><dt>Labels</dt><dd>${ticket.labels.length ? ticket.labels.map(label => `<span class="label">${escapeHtml(label)}</span>`).join(' ') : '—'}</dd></div>
      <div><dt>Depende de</dt><dd>${ticket.dependsOn.length ? ticket.dependsOn.map(id => escapeHtml(id)).join(', ') : 'Nenhuma dependência'}</dd></div>
      <div><dt>Fonte</dt><dd><code>${escapeHtml(ticket.source || 'índice')}</code></dd></div>
    </dl>
  `;
  details.querySelector('.dialog-close').addEventListener('click', () => details.close());
  details.addEventListener('close', () => details.remove());
  document.body.append(details);
  details.showModal();
}

Promise.all([loadData(), loadBranch()]).then(([data, branch]) => render(data, branch)).catch(error => {
  document.querySelector('#app').innerHTML = `<main class="error"><h1>Planner indisponível</h1><p>${escapeHtml(error.message)}</p><p>Sirva o diretório do repositório por HTTP para carregar o índice local.</p></main>`;
});
