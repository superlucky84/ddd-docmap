import http from 'node:http';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createProjectStore } from './project-store.js';
import { searchDocuments } from '../collector/search.js';
import { HttpError, readDocument } from './documents.js';
import { createFileAccess } from './files.js';
import { createReferenceResolver } from './references.js';
import { renderMarkdown } from './render.js';

const ASSETS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/reader.js', ['reader.js', 'text/javascript; charset=utf-8']],
  ['/search.js', ['search.js', 'text/javascript; charset=utf-8']],
  ['/live.js', ['live.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};

export async function startServer({ root = process.cwd(), port = 0 } = {}) {
  const store = await createProjectStore(root);
  const events = new Set();
  const imageAssets = new Map();
  function registerAsset(relativePath, contentType, sequence) {
    const snapshot = store.current.snapshot;
    const id = createHash('sha256').update(snapshot.project.id + '\0' + relativePath).digest('hex');
    imageAssets.set(id, { relativePath, contentType });
    return '/api/asset?id=' + id + '&v=' + sequence;
  }
  const assets = new Map();
  try {
    for (const [route, [name, contentType]] of ASSETS) {
      assets.set(route, { body: await fs.readFile(new URL('../web/' + name, import.meta.url)), contentType });
    }
  } catch (cause) {
    await store.close();
    throw cause;
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
      const generation = store.current;
      const { snapshot, documents, redirects, sequence } = generation;
      if (assets.has(url.pathname)) {
        const asset = assets.get(url.pathname);
        send(request, response, 200, asset.body, asset.contentType);
      } else if (url.pathname === '/api/map') {
        send(request, response, 200, JSON.stringify({ ...snapshot, ...store.status() }));
      } else if (url.pathname === '/api/search') {
        if (url.searchParams.getAll('q').length !== 1 || url.searchParams.get('q').length > 200) {
          throw new HttpError(400, 'Provide one search query of at most 200 characters.');
        }
        send(request, response, 200, JSON.stringify({
          ...searchDocuments(generation.searchIndex, url.searchParams.get('q')), sequence, revision: snapshot.revision
        }));
      } else if (url.pathname === '/api/events') {
        response.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
        if (request.method === 'HEAD') { response.end(); return; }
        response.flushHeaders();
        const write = (type, value) => {
          if (!response.destroyed) response.write('event: ' + type + '\ndata: ' + JSON.stringify(value) + '\n\n');
        };
        const unsubscribe = store.subscribe(write);
        const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000);
        events.add(response);
        response.once('close', () => { unsubscribe(); clearInterval(heartbeat); events.delete(response); });
        write('ready', store.status());
      } else if (url.pathname === '/api/document') {
        if (url.searchParams.getAll('id').length !== 1) {
          throw new HttpError(400, 'Provide one document id.');
        }
        const requestedId = url.searchParams.get('id');
        const document = documents.get(redirects.get(requestedId) || requestedId);
        const access = await createFileAccess(snapshot.project.rootLabel);
        const markdown = await readDocument(snapshot.project.rootLabel, document, access, generation.contents.get(document?.id));
        const rendered = await renderMarkdown(markdown, createReferenceResolver({
          document, documents, redirects, access,
          registerAsset: (relative, type) => registerAsset(relative, type, sequence)
        }));
        send(request, response, 200, JSON.stringify({
          sequence, revision: snapshot.revision, id: document.id, title: document.title, relativePath: document.relativePath, markdown, ...rendered
        }));
      } else if (url.pathname === '/api/asset') {
        if (url.searchParams.getAll('id').length !== 1) throw new HttpError(400, 'Provide one image id.');
        const asset = imageAssets.get(url.searchParams.get('id'));
        if (!asset) throw new HttpError(404, 'This image is not registered by a document.');
        const access = await createFileAccess(snapshot.project.rootLabel);
        send(request, response, 200, await access.read(asset.relativePath, { binary: true }), asset.contentType);
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

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port }, () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (cause) {
    await store.close();
    throw cause;
  }
  let closing;
  return {
    url: 'http://127.0.0.1:' + server.address().port + '/',
    get snapshot() { return store.current.snapshot; },
    close() {
      if (!closing) {
        closing = (async () => {
          await store.close();
          for (const response of events) response.end();
          await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
            server.closeAllConnections();
          });
        })();
      }
      return closing;
    }
  };
}
