import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startServer } from '../src/server/index.js';
import { createProject } from './helpers/projects.js';
import { createReadingProject, READING_ID, PNG } from './helpers/reading.js';

async function readingServer(t) {
  const project = await createReadingProject(t);
  const app = await startServer({ root: project.root });
  t.after(() => app.close());
  const response = await fetch(app.url + 'api/document?id=' + encodeURIComponent(READING_ID));
  assert.equal(response.status, 200);
  return { ...project, app, document: await response.json() };
}

test('document API returns formatted content, navigation data, and a registered raster image', async t => {
  const { app, document } = await readingServer(t);
  assert.match(document.html, /<table>/);
  assert.ok(document.headings.some(heading => heading.id === '한국어-사용법-1'));
  assert.ok(document.references.some(reference => reference.type === 'document'));
  const image = document.references.find(reference => reference.type === 'image');
  const url = new URL(image.src, app.url);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await fetch(app.url + 'reader.js')).status, 200);
});

test('asset routes accept only image references actually registered by a document', async t => {
  const { app } = await readingServer(t);
  const svgId = createHash('sha256').update(app.snapshot.project.id + '\0docs/catalog/assets/vector.svg').digest('hex');
  assert.equal((await fetch(app.url + 'api/asset?id=' + svgId)).status, 404);
  assert.equal((await fetch(app.url + 'api/asset?id=../package.json')).status, 404);
  assert.equal((await fetch(app.url + 'api/asset')).status, 400);
  assert.equal((await fetch(app.url + 'api/asset?id=a&id=b')).status, 400);
  assert.equal((await fetch(app.url + 'docs/catalog/assets/overview.png')).status, 404);
});

test('registered images are rechecked against changed ignore rules and symbolic links', async t => {
  const { root, write, app, document } = await readingServer(t);
  const image = document.references.find(reference => reference.type === 'image');
  const url = new URL(image.src, app.url);
  await write('.gitignore', 'docs/catalog/assets/\n');
  assert.equal((await fetch(url)).status, 403);
  await fs.unlink(path.join(root, '.gitignore'));
  const outside = await createProject(t, { 'image.png': PNG });
  const filename = path.join(root, 'docs/catalog/assets/overview.png');
  await fs.unlink(filename);
  await fs.symlink(path.join(outside.root, 'image.png'), filename);
  assert.equal((await fetch(url)).status, 403);
  const current = await (await fetch(app.url + 'api/document?id=' + encodeURIComponent(READING_ID))).json();
  assert.ok(current.references.some(reference => reference.type === 'blocked'));
});

test('indexed documents also honor changed exclusion rules before reading content', async t => {
  const { write, app } = await readingServer(t);
  await write('ddd-docmap.config.json', JSON.stringify({
    version: 1, exclude: ['docs/catalog/DESIGN.md']
  }));
  assert.equal((await fetch(app.url + 'api/document?id=' + encodeURIComponent(READING_ID))).status, 403);
});

test('additional Markdown and raster reads honor canonical exclusions before a rescan', async t => {
  const cleanups = [];
  const scope = { after: fn => cleanups.push(fn) };
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const { root, write } = await createProject(scope, {
    'documentation/guide.md': '# Guide\n\n![Diagram](diagram.png)',
    'documentation/diagram.png': PNG,
    'ddd-docmap.config.json': JSON.stringify({ version: 1 })
  });
  const app = await startServer({ root, collectionOptions: { docsDirs: ['documentation'] } });
  scope.after(() => app.close());
  const url = app.url + 'api/document?id=documentation/guide.md';
  const document = await (await fetch(url)).json();
  const image = new URL(document.references.find(reference => reference.type === 'image').src, app.url);
  assert.equal((await fetch(image)).status, 200);
  await write('docatlas.config.json', JSON.stringify({ version: 1, exclude: ['documentation/**'] }));
  assert.equal((await fetch(url)).status, 403);
  assert.equal((await fetch(image)).status, 403);
});
