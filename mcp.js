#!/usr/bin/env node
const readline = require('node:readline');
const path = require('node:path');
const { buildIndex, contextFor, readEntities, validate } = require('./core/planner');

const root = path.resolve(process.env.PLANNER_ROOT || path.join(__dirname, '..'));
const serverInfo = { name: 'planner-local', version: '0.1.0' };

const tools = [
  {
    name: 'planner_status',
    description: 'Retorna o resumo atual da iniciativa Planner.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'planner_list',
    description: 'Lista entidades do Planner, opcionalmente filtradas por status.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', description: 'Status da entidade.' } },
      additionalProperties: false
    }
  },
  {
    name: 'planner_show',
    description: 'Mostra uma entidade do Planner pelo id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identificador da entidade.' } },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'planner_context',
    description: 'Retorna a entidade, suas dependências, dependentes e validações relacionadas.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identificador da entidade.' } },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'planner_validate',
    description: 'Valida entidades, referências e ciclos de dependência.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
];

function result(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function callTool(name, argumentsValue = {}) {
  const entities = readEntities(root);
  switch (name) {
    case 'planner_status':
      return result(buildIndex(root, entities).summary);
    case 'planner_list':
      return result(argumentsValue.status ? entities.filter(entity => entity.status === argumentsValue.status) : entities);
    case 'planner_show': {
      const entity = entities.find(item => item.id === argumentsValue.id);
      if (!entity) return errorResult(`Entidade não encontrada: ${argumentsValue.id || '(sem id)'}`);
      return result(entity);
    }
    case 'planner_context': {
      const context = contextFor(entities, argumentsValue.id);
      if (!context) return errorResult(`Entidade não encontrada: ${argumentsValue.id || '(sem id)'}`);
      return result(context);
    }
    case 'planner_validate': {
      const errors = validate(entities);
      return result({ valid: errors.length === 0, errors, total: entities.length });
    }
    default:
      return errorResult(`Ferramenta desconhecida: ${name}`);
  }
}

function respond(message) {
  if (message.method === 'notifications/initialized') return;

  let response;
  try {
    switch (message.method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo
          }
        };
        break;
      case 'tools/list':
        response = { jsonrpc: '2.0', id: message.id, result: { tools } };
        break;
      case 'tools/call':
        response = {
          jsonrpc: '2.0',
          id: message.id,
          result: callTool(message.params?.name, message.params?.arguments)
        };
        break;
      default:
        response = {
          jsonrpc: '2.0',
          id: message.id ?? null,
          error: { code: -32601, message: `Método não encontrado: ${message.method}` }
        };
    }
  } catch (error) {
    response = {
      jsonrpc: '2.0',
      id: message.id ?? null,
      error: { code: -32603, message: error.message }
    };
  }

  process.stdout.write(`${JSON.stringify(response)}\n`);
}

readline.createInterface({ input: process.stdin }).on('line', line => {
  if (!line.trim()) return;
  try {
    respond(JSON.parse(line));
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: error.message } })}\n`);
  }
});
