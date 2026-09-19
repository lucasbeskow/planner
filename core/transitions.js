// Regras de mudança de status, declaradas só aqui. Seguem o fluxo do PRD:
//
//   draft → planned → in_progress → done
//                       ↓      ↑
//                      blocked
//   (qualquer estado não final) → canceled
//
// done e canceled são finais: reabrir exige --force, que ignora estas regras mas não a validação.
const TRANSITIONS = {
  draft: ['planned', 'canceled'],
  planned: ['in_progress', 'canceled'],
  in_progress: ['done', 'blocked', 'canceled'],
  blocked: ['in_progress', 'canceled'],
  done: [],
  canceled: []
};

const RESOLVED = ['done', 'canceled'];

// Iniciativas agrupam tickets e só terminam depois deles, então não contam como dependência
// aberta ao concluir um ticket.
function openDependencies(entities, entity) {
  const dependsOn = Array.isArray(entity.dependsOn) ? entity.dependsOn : [];
  return dependsOn
    .map(id => entities.find(item => item.id === id))
    .filter(dependency => dependency && dependency.type !== 'initiative' && !RESOLVED.includes(dependency.status));
}

// Retorna os motivos que impedem a mudança; lista vazia significa transição permitida.
function transitionIssues(entities, entity, nextStatus) {
  const current = entity.status;
  if (!current || current === nextStatus) return [];

  const issues = [];
  const allowed = TRANSITIONS[current];
  if (allowed && !allowed.includes(nextStatus)) {
    issues.push(allowed.length
      ? `${entity.id}: transição ${current} → ${nextStatus} não permitida (a partir de ${current}: ${allowed.join(', ')})`
      : `${entity.id}: ${current} é um status final; use --force para reabrir`);
  }

  if (nextStatus === 'done') {
    const open = openDependencies(entities, entity);
    if (open.length) {
      issues.push(`${entity.id}: não pode ser concluído com dependências abertas: ${open.map(item => `${item.id} [${item.status}]`).join(', ')}`);
    }
  }
  return issues;
}

module.exports = { TRANSITIONS, transitionIssues };
