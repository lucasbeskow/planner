// Grafo de dependências em SVG, sem dependências externas. Cada coluna é uma camada: uma
// entidade fica à direita de tudo de que depende. Dependências inexistentes viram nós tracejados
// e arestas de ciclos ou para ids ausentes são destacadas.
import { escapeHtml } from './markdown.mjs';

const NODE_WIDTH = 190;
const NODE_HEIGHT = 46;
const COLUMN_GAP = 64;
const ROW_GAP = 14;
const PADDING = 12;

function truncate(text, length) {
  const value = String(text ?? '');
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function graphLayout(entities) {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const missing = [...new Set(entities.flatMap(entity => entity.dependsOn ?? []).filter(id => !byId.has(id)))];
  const nodes = [
    ...entities.map(entity => ({ id: entity.id, entity, missing: false })),
    ...missing.map(id => ({ id, entity: null, missing: true }))
  ];

  // Camada = maior caminho até uma entidade sem dependências. Uma aresta de volta a um nó ainda
  // em visita pertence a um ciclo e é ignorada no cálculo, para que o layout termine.
  const layers = new Map();
  const visiting = new Set();
  function layer(id) {
    if (layers.has(id)) return layers.get(id);
    if (visiting.has(id)) return -1;
    visiting.add(id);
    const dependencies = byId.get(id)?.dependsOn ?? [];
    const value = Math.max(-1, ...dependencies.map(layer)) + 1;
    visiting.delete(id);
    layers.set(id, value);
    return value;
  }
  nodes.forEach(node => layer(node.id));

  const columns = [];
  for (const node of [...nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const column = layers.get(node.id);
    (columns[column] ??= []).push(node);
  }
  columns.forEach((column, index) => column.forEach((node, row) => {
    node.x = PADDING + index * (NODE_WIDTH + COLUMN_GAP);
    node.y = PADDING + row * (NODE_HEIGHT + ROW_GAP);
  }));

  const position = new Map(nodes.map(node => [node.id, node]));
  const cycleLabels = entities.flatMap(entity => (entity.errors ?? []).filter(message => message.startsWith('ciclo de dependências:')));
  const edges = entities.flatMap(entity => (entity.dependsOn ?? []).map(dependency => {
    const inCycle = cycleLabels.some(label => label.includes(`${entity.id} -> ${dependency}`));
    return { from: position.get(dependency), to: position.get(entity.id), error: inCycle || !byId.has(dependency), cycle: inCycle };
  }));

  const rows = Math.max(1, ...columns.map(column => column?.length ?? 0));
  return {
    nodes,
    edges,
    width: PADDING * 2 + columns.length * NODE_WIDTH + Math.max(0, columns.length - 1) * COLUMN_GAP,
    // Espaço extra embaixo para as arestas de ciclo, que passam sob os nós.
    height: PADDING * 2 + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP + (edges.some(edge => edge.cycle) ? ROW_GAP + 10 : 0)
  };
}

function edgePath({ from, to }) {
  const startX = from.x + NODE_WIDTH;
  const startY = from.y + NODE_HEIGHT / 2;
  const endX = to.x;
  const endY = to.y + NODE_HEIGHT / 2;
  // Aresta para trás (ciclo): sai da base de um nó e entra na base do outro, por baixo.
  if (endX <= startX) {
    const fromX = from.x + NODE_WIDTH / 2;
    const toX = to.x + NODE_WIDTH / 2;
    const fromY = from.y + NODE_HEIGHT;
    const toY = to.y + NODE_HEIGHT;
    const bottom = Math.max(fromY, toY) + ROW_GAP + 10;
    return `M${fromX},${fromY} C${fromX},${bottom} ${toX},${bottom} ${toX},${toY}`;
  }
  const middle = (startX + endX) / 2;
  return `M${startX},${startY} C${middle},${startY} ${middle},${endY} ${endX},${endY}`;
}

export function renderGraph(entities) {
  if (!entities.length) return '';
  const layout = graphLayout(entities);
  const edges = layout.edges.map(edge => `
    <path class="graph-edge${edge.error ? ' error' : ''}" d="${edgePath(edge)}" marker-end="url(#${edge.error ? 'arrow-error' : 'arrow'})">
      <title>${escapeHtml(edge.to.id)} depende de ${escapeHtml(edge.from.id)}${edge.cycle ? ' (ciclo)' : edge.error ? ' (inexistente)' : ''}</title>
    </path>`).join('');

  const nodes = layout.nodes.map(node => {
    const entity = node.entity;
    const hasError = node.missing || (entity.errors ?? []).length > 0;
    const classes = ['graph-node', node.missing ? 'graph-missing' : `status-${entity.status}`, hasError ? 'error' : ''].filter(Boolean).join(' ');
    const title = node.missing ? 'entidade inexistente' : entity.title;
    const tooltip = node.missing ? `${node.id}: entidade inexistente` : [`${entity.id} · ${entity.title}`, ...(entity.errors ?? [])].join('\n');
    const interactive = node.missing ? '' : ` data-ticket="${escapeHtml(node.id)}" tabindex="0" role="button"`;
    return `
    <g class="${classes}" transform="translate(${node.x},${node.y})"${interactive}>
      <title>${escapeHtml(tooltip)}</title>
      <rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="8"></rect>
      <text x="12" y="18" class="graph-id">${escapeHtml(node.id)}</text>
      <text x="12" y="35" class="graph-title">${escapeHtml(truncate(title, 27))}</text>
    </g>`;
  }).join('');

  return `<svg class="graph" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="group" aria-label="Grafo de dependências">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="graph-arrow"></path></marker>
      <marker id="arrow-error" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="graph-arrow error"></path></marker>
    </defs>
    ${edges}
    ${nodes}
  </svg>`;
}
