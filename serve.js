#!/usr/bin/env node
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// Servidores estáticos genéricos costumam bloquear diretórios iniciados por ponto. Este servidor
// expõe somente o que a UI precisa: a própria UI, o diretório .planner e o branch em .git/HEAD.
function isAllowed(relativePath) {
  return relativePath === '.git/HEAD'
    || relativePath.startsWith('planner/')
    || relativePath.startsWith('.planner/');
}

function createPlannerServer(root, assetsRoot = path.join(root, 'planner')) {
  return http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }

    if (pathname === '/' || pathname === '/planner') {
      response.writeHead(302, { Location: '/planner/' }).end();
      return;
    }

    const isPlannerAsset = pathname === '/planner/' || pathname.startsWith('/planner/');
    const contentRoot = isPlannerAsset ? assetsRoot : root;
    const contentPath = isPlannerAsset ? pathname.slice('/planner/'.length) : pathname.slice(1);
    const filePath = path.resolve(contentRoot, contentPath || 'index.html');
    const relativePath = path.relative(contentRoot, filePath).split(path.sep).join('/');
    const routePath = isPlannerAsset ? `planner/${relativePath}` : relativePath;
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !isAllowed(routePath)) {
      response.writeHead(404).end();
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    });
  });
}

if (require.main === module) {
  const root = path.resolve(process.env.PLANNER_ROOT || process.cwd());
  const port = Number(process.env.PLANNER_PORT || 4400);
  createPlannerServer(root, __dirname).listen(port, '127.0.0.1', () => {
    console.log(`Planner disponível em http://localhost:${port}/planner/`);
  });
}

module.exports = { createPlannerServer };
