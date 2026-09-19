const STATUS = [
  ['planned', 'Planejado'],
  ['in_progress', 'Em andamento'],
  ['blocked', 'Bloqueado'],
  ['done', 'Concluído']
];

const statusLabel = new Map(STATUS);

async function loadData() {
  const response = await fetch('../.planner/index.json');
  if (!response.ok) {
    throw new Error(`Não foi possível carregar o índice (${response.status})`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render(data) {
  const tickets = data.tickets;
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">${escapeHtml(data.repository.name)} / planner</p>
          <h1>${escapeHtml(data.repository.initiative)}</h1>
          <p class="muted">Branch atual: <code>${escapeHtml(data.repository.branch)}</code></p>
        </div>
        <span class="local-badge">LOCAL · GIT-NATIVE</span>
      </header>

      <section class="summary-grid" aria-label="Resumo da iniciativa">
        ${STATUS.map(([key, label]) => `
          <article class="summary-card status-${key}">
            <span>${label}</span>
            <strong>${data.summary[toSummaryKey(key)] ?? 0}</strong>
          </article>
        `).join('')}
      </section>

      <section class="workspace">
        <div class="section-heading">
          <div>
            <p class="eyebrow">M0 · leitura e visualização</p>
            <h2>Backlog da iniciativa</h2>
          </div>
          <span class="muted">${tickets.length} entidades indexadas</span>
        </div>
        <div class="board">
          ${STATUS.map(([key, label]) => `
            <section class="column" aria-labelledby="column-${key}">
              <div class="column-heading">
                <h3 id="column-${key}">${label}</h3>
                <span>${tickets.filter(ticket => ticket.status === key).length}</span>
              </div>
              <div class="ticket-list">
                ${tickets.filter(ticket => ticket.status === key).map(ticketCard).join('') || '<p class="empty">Nenhum item</p>'}
              </div>
            </section>
          `).join('')}
        </div>
      </section>
    </main>
  `;

  app.querySelectorAll('[data-ticket]').forEach(card => {
    card.addEventListener('click', () => showDetails(tickets.find(ticket => ticket.id === card.dataset.ticket)));
  });
}

function toSummaryKey(status) {
  return { planned: 'planned', in_progress: 'inProgress', blocked: 'blocked', done: 'done' }[status];
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
      <div><dt>Status</dt><dd>${escapeHtml(statusLabel.get(ticket.status))}</dd></div>
      <div><dt>Prioridade</dt><dd>${escapeHtml(ticket.priority)}</dd></div>
      <div><dt>Fase</dt><dd>${escapeHtml(ticket.phase)}</dd></div>
      <div><dt>Labels</dt><dd>${ticket.labels.map(label => `<span class="label">${escapeHtml(label)}</span>`).join(' ')}</dd></div>
      <div><dt>Depende de</dt><dd>${ticket.dependsOn.length ? ticket.dependsOn.map(id => escapeHtml(id)).join(', ') : 'Nenhuma dependência'}</dd></div>
    </dl>
  `;
  details.querySelector('.dialog-close').addEventListener('click', () => details.close());
  details.addEventListener('close', () => details.remove());
  document.body.append(details);
  details.showModal();
}

loadData().then(render).catch(error => {
  document.querySelector('#app').innerHTML = `<main class="error"><h1>Planner indisponível</h1><p>${escapeHtml(error.message)}</p><p>Sirva o diretório do repositório por HTTP para carregar o índice local.</p></main>`;
});
