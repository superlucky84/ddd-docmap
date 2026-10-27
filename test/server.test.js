import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { startServer } from '../src/server/index.js';
import { createBasicProject, createProject } from './helpers/projects.js';

async function basicServer(t) {
  const project = await createBasicProject(t);
  const app = await startServer({ root: project.root });
  t.after(() => app.close());
  return { ...project, app };
}

test('serves the static UI and a body-free map from loopback', async t => {
  const { app } = await basicServer(t);
  assert.match(app.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  const index = await fetch(app.url);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(index.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await index.text(), /id="map-tree"/);
  for (const asset of ['app.js', 'styles.css']) {
    const response = await fetch(app.url + asset);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 0);
  }
  const map = await (await fetch(app.url + 'api/map')).json();
  assert.equal(map.documents.length, 8);
  assert.ok(map.documents.every(document => !Object.hasOwn(document, 'markdown')));
});

test('opens only an indexed document and supports HEAD without a body', async t => {
  const { app } = await basicServer(t);
  const url = app.url + 'api/document?id=' + encodeURIComponent('docs/catalog/DESIGN.md');
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.equal(document.id, 'docs/catalog/DESIGN.md');
  assert.match(document.markdown, /Catalog architecture/);
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('rejects unknown files, traversal ids, duplicate ids, and write methods', async t => {
  const { app } = await basicServer(t);
  for (const id of ['../README.md', '/etc/passwd', 'README.md', 'package.json']) {
    assert.equal((await fetch(app.url + 'api/document?id=' + encodeURIComponent(id))).status, 404);
  }
  assert.equal((await fetch(app.url + 'api/document')).status, 400);
  assert.equal((await fetch(app.url + 'api/document?id=a&id=b')).status, 400);
  assert.equal((await fetch(app.url + 'package.json')).status, 404);
  assert.equal((await fetch(app.url + 'api/map', { method: 'POST' })).status, 405);
});

test('rejects a foreign origin and a foreign Host header', async t => {
  const { app } = await basicServer(t);
  assert.equal((await fetch(app.url + 'api/map', {
    headers: { Origin: 'https://example.com' }
  })).status, 403);
  const status = await new Promise((resolve, reject) => {
    const request = http.get(app.url, { headers: { Host: 'example.com' } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('error', reject);
  });
  assert.equal(status, 421);
});

test('detects a deleted document after the map was created', async t => {
  const { root, app } = await basicServer(t);
  await fs.unlink(path.join(root, 'docs/catalog/DESIGN.md'));
  const response = await fetch(app.url + 'api/document?id=docs%2Fcatalog%2FDESIGN.md');
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /no longer exists/);
});

test('rechecks both file and ancestor symlinks before opening a document', async t => {
  const { root, app } = await basicServer(t);
  const outside = await createProject(t, { 'DESIGN.md': '# Must not be returned\n' });
  const filename = path.join(root, 'docs/catalog/DESIGN.md');
  await fs.unlink(filename);
  await fs.symlink(path.join(outside.root, 'DESIGN.md'), filename);
  const url = app.url + 'api/document?id=docs%2Fcatalog%2FDESIGN.md';
  assert.equal((await fetch(url)).status, 403);
  await fs.rename(path.join(root, 'docs'), path.join(root, 'moved-docs'));
  await fs.symlink(outside.root, path.join(root, 'docs'), 'dir');
  assert.equal((await fetch(url)).status, 403);
});

test('closing one project leaves the other project running', async t => {
  const first = await basicServer(t);
  const project = await createProject(t, { 'docs/DESIGN.md': '# Second project\n' });
  const second = await startServer({ root: project.root });
  t.after(() => second.close());
  assert.notEqual(first.app.url, second.url);
  assert.notEqual(first.app.snapshot.project.id, second.snapshot.project.id);
  await first.app.close();
  await first.app.close();
  await assert.rejects(fetch(first.app.url));
  assert.equal((await (await fetch(second.url + 'api/map')).json()).documents.length, 1);
});

test('an occupied port fails without affecting the existing server', async t => {
  const { root, app } = await basicServer(t);
  await assert.rejects(startServer({ root, port: Number(new URL(app.url).port) }), { code: 'EADDRINUSE' });
  assert.equal((await fetch(app.url)).status, 200);
});
