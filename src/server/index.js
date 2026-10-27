import http from 'node:http';
import fs from 'node:fs/promises';
import { collectProject } from '../collector/index.js';
import { HttpError, readDocument } from './documents.js';

const ASSETS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};

export async function startServer({ root = process.cwd(), port = 0 } = {}) {
  const snapshot = await collectProject(root);
  const documents = new Map(snapshot.documents.map(document => [document.id, document]));
  const assets = new Map();
  for (const [route, [name, contentType]] of ASSETS) {
    assets.set(route, { body: await fs.readFile(new URL('../web/' + name, import.meta.url)), contentType });
  }
  const server = http.createServer((request, response) => {
    void handle(request, response).catch(() => response.destroy());
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;

  function send(request, response, status, body, contentType = 'application/json; charset=utf-8', extra = {}) {
    if (response.destroyed || response.writableEnded) return;
    const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
    response.writeHead(status, {
      ...HEADERS, 'Content-Type': contentType, 'Content-Length': bytes.length, ...extra
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  }

  async function handle(request, response) {
    try {
      const host = '127.0.0.1:' + server.address().port;
      const origin = 'http://' + host;
      if (request.headers.host !== host) {
        throw new HttpError(421, 'Use the local address printed by ddd-docmap.');
      }
      if (request.headers.origin && request.headers.origin !== origin) {
        throw new HttpError(403, 'Requests from other origins are not allowed.');
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        send(request, response, 405, JSON.stringify({ error: 'Only GET and HEAD are supported.' }),
          undefined, { Allow: 'GET, HEAD' });
        return;
      }
      const url = new URL(request.url, origin);
      if (assets.has(url.pathname)) {
        const asset = assets.get(url.pathname);
        send(request, response, 200, asset.body, asset.contentType);
      } else if (url.pathname === '/api/map') {
        send(request, response, 200, JSON.stringify(snapshot));
      } else if (url.pathname === '/api/document') {
        if (url.searchParams.getAll('id').length !== 1) {
          throw new HttpError(400, 'Provide one document id.');
        }
        const document = documents.get(url.searchParams.get('id'));
        const markdown = await readDocument(snapshot.project.rootLabel, document);
        send(request, response, 200, JSON.stringify({
          id: document.id, title: document.title, relativePath: document.relativePath, markdown
        }));
      } else {
        throw new HttpError(404, 'This page does not exist.');
      }
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        const status = error instanceof HttpError ? error.status : 500;
        send(request, response, status, JSON.stringify({
          error: status === 500 ? 'The document could not be opened.' : error.message
        }));
      }
    }
  }

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  let closing;
  return {
    url: 'http://127.0.0.1:' + server.address().port + '/',
    snapshot,
    close() {
      if (!closing) {
        closing = new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
      return closing;
    }
  };
}
