import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createProjectStore } from '../src/server/project-store.js';
import { startServer } from '../src/server/index.js';
import { searchDocuments } from '../src/collector/search.js';
import { createProject } from './helpers/projects.js';

function changed(store, predicate, action) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('No matching update: ' + JSON.stringify(store.status()))); }, 8000);
    const unsubscribe = store.subscribe(() => {
      try {
        if (!predicate(store.current, store.status())) return;
        clearTimeout(timer); unsubscribe(); resolve(store.current);
      } catch (error) { clearTimeout(timer); unsubscribe(); reject(error); }
    });
    Promise.resolve().then(action).catch(error => { clearTimeout(timer); unsubscribe(); reject(error); });
  });
}

async function liveProject(t, files) {
  const cleanups = [];
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const project = await createProject({ after: fn => cleanups.push(fn) }, files);
  return { ...project, after: fn => cleanups.push(fn) };
}

async function watched(t, files = {}, collectionOptions = {}) {
  const project = await liveProject(t, { 'docs/DESIGN.md': '# Initial\n\nFirst body.', ...files });
  const store = await createProjectStore(project.root, { collectionOptions });
  project.after(() => store.close());
  return { ...project, store };
}

test('new configuration creation, errors, replacement and removal preserve immutable directory options', async t => {
  const options = { docsDirs: ['documentation'] };
  const { root, write, store } = await watched(t, {
    'ddd-docmap.config.json': JSON.stringify({ version: 1, include: ['legacy/**/*.md'] }),
    'legacy/info.md': '# Legacy', 'current/info.md': '# Current',
    'documentation/guide.md': '# Added'
  }, options);
  options.docsDirs[0] = 'unselected';
  assert.ok(store.current.documents.has('legacy/info.md'));
  assert.ok(store.current.documents.has('documentation/guide.md'));
  await changed(store, current => current.documents.has('current/info.md') && !current.documents.has('legacy/info.md'),
    () => write('docatlas.config.json', JSON.stringify({ version: 1, include: ['current/**/*.md'] })));
  assert.ok(store.current.documents.has('documentation/guide.md'));
  const revision = store.current.snapshot.revision;
  await changed(store, (_current, status) => Boolean(status.error?.includes('docatlas.config.json')),
    () => write('docatlas.config.json', '{invalid'));
  assert.equal(store.current.snapshot.revision, revision);
  assert.ok(!store.current.documents.has('legacy/info.md'));
  await changed(store, (current, status) => !status.error && current.documents.has('documentation/guide.md'),
    () => write('docatlas.config.json', JSON.stringify({ version: 1, include: [] })));
  await changed(store, current => current.documents.has('legacy/info.md'),
    () => fs.unlink(path.join(root, 'docatlas.config.json')));
  assert.ok(store.current.documents.has('documentation/guide.md'));
  await changed(store, current => current.documents.has('docs/DESIGN.md'),
    () => fs.unlink(path.join(root, 'ddd-docmap.config.json')));
});

test('an additional directory can appear and disappear without retaining stale documents', async t => {
  const { root, write, store } = await watched(t, {}, { docsDirs: ['future'] });
  assert.ok(store.current.snapshot.warnings.some(warning => warning.code === 'DOCS_DIR_SKIPPED'));
  await changed(store, current => current.documents.has('future/guide.md'), () => write('future/guide.md', '# Created'));
  assert.ok(!store.current.snapshot.warnings.some(warning => warning.code === 'DOCS_DIR_SKIPPED'));
  await changed(store, current => current.contents.get('future/guide.md')?.includes('Updated'),
    () => write('future/guide.md', '# Updated'));
  await changed(store, current => !current.documents.has('future/guide.md'),
    () => fs.rm(path.join(root, 'future'), { recursive: true }));
  assert.ok(store.current.snapshot.warnings.some(warning => warning.code === 'DOCS_DIR_SKIPPED'));
  assert.equal(store.status().error, null);
});

test('all Markdown survives configuration watcher replacement while exclusions still change', async t => {
  const { write, store } = await watched(t, { 'notes/guide.md': '# Notes' }, { allMarkdown: true });
  await changed(store, current => !current.documents.has('notes/guide.md'),
    () => write('docatlas.config.json', JSON.stringify({ version: 1, include: [], exclude: ['notes/**'] })));
  assert.ok(store.current.documents.has('docs/DESIGN.md'));
  await changed(store, current => current.documents.has('notes/guide.md'),
    () => write('docatlas.config.json', JSON.stringify({ version: 1, include: [] })));
  await changed(store, current => current.contents.get('notes/guide.md')?.includes('Still watched'),
    () => write('notes/guide.md', '# Still watched'));
});

test('watch publishes coherent content/search generations for edit, addition, deletion and atomic save', async t => {
  const { root, write, store } = await watched(t);
  const first = store.current.sequence;
  await changed(store, current => current.contents.get('docs/DESIGN.md').includes('Updated'),
    () => write('docs/DESIGN.md', '# Updated\n\n검색 갱신 토큰.'));
  assert.ok(store.current.sequence > first);
  assert.equal(searchDocuments(store.current.searchIndex, '갱신').total, 1);
  await changed(store, current => current.documents.has('docs/new.md'), () => write('docs/new.md', '# New\n\nSecond.'));
  await changed(store, current => !current.documents.has('docs/new.md'), () => fs.unlink(path.join(root, 'docs/new.md')));
  await changed(store, current => current.contents.get('docs/DESIGN.md').includes('Atomic'), async () => {
    await write('docs/.save.tmp', '# Atomic\n\nLast save.');
    await fs.rename(path.join(root, 'docs/.save.tmp'), path.join(root, 'docs/DESIGN.md'));
  });
  assert.equal(searchDocuments(store.current.searchIndex, '갱신').total, 0);
});

test('bad configuration keeps the last good index and recovers after a policy change', async t => {
  const { write, store } = await watched(t, { 'dist/docs/hidden.md': '# Generated' });
  const revision = store.current.snapshot.revision;
  await changed(store, (_current, status) => Boolean(status.error), () => write('ddd-docmap.config.json', '{invalid'));
  assert.equal(store.current.snapshot.revision, revision);
  assert.equal(searchDocuments(store.current.searchIndex, 'First').total, 1);
  await changed(store, (current, status) => !status.error && current.documents.has('dist/docs/hidden.md'),
    () => write('ddd-docmap.config.json', JSON.stringify({ version: 1, exclude: [] })));
  await changed(store, current => current.contents.get('dist/docs/hidden.md')?.includes('Recrawled'),
    () => write('dist/docs/hidden.md', '# Recrawled'));
});

test('changing ignore rules recrawls newly visible folders and later changes there are watched', async t => {
  const { write, store } = await watched(t, { '.gitignore': 'docs/private/\n', 'docs/private/info.md': '# Hidden' });
  assert.ok(!store.current.documents.has('docs/private/info.md'));
  await changed(store, current => current.documents.has('docs/private/info.md'), () => write('.gitignore', ''));
  await changed(store, current => current.contents.get('docs/private/info.md')?.includes('Visible'),
    () => write('docs/private/info.md', '# Visible'));
  await changed(store, current => !current.documents.has('docs/private/info.md'), () => write('.gitignore', 'docs/private/\n'));
});

test('image changes advance the live generation without changing the Markdown revision', async t => {
  const { write, store } = await watched(t, { 'docs/image.png': Buffer.from([1]) });
  const { sequence, snapshot } = store.current;
  await changed(store, current => current.sequence > sequence, () => write('docs/image.png', Buffer.from([2])));
  assert.equal(store.current.snapshot.revision, snapshot.revision);
});

test('two stores isolate content and shutdown releases watchers', async t => {
  const one = await watched(t);
  const two = await watched(t);
  const revision = two.store.current.snapshot.revision;
  await changed(one.store, current => current.contents.get('docs/DESIGN.md').includes('Only one'),
    () => one.write('docs/DESIGN.md', '# Only one')).catch(error => { throw new Error('first store: ' + error.message); });
  assert.equal(two.store.current.snapshot.revision, revision);
  await one.store.close();
  await changed(two.store, current => current.contents.get('docs/DESIGN.md').includes('Still live'),
    () => two.write('docs/DESIGN.md', '# Still live')).catch(error => { throw new Error('second store after closing first: ' + error.message); });
});

test('HTTP search, explicit missing-path redirects, SSE, and document generations agree', async t => {
  const project = await liveProject(t, {
    'ddd-docmap.config.json': JSON.stringify({ version: 1, redirects: { 'docs/old.md': 'docs/current.md' } }),
    'docs/current.md': '# Current\n\nBody needle.\n\n[Previous](old.md#current)'
  });
  const { root, write } = project;
  const app = await startServer({ root });
  project.after(() => app.close());
  const read = async route => (await fetch(new URL(route, app.url))).json();
  const map = await read('api/map');
  const search = await read('api/search?q=old.md');
  assert.equal(search.sequence, map.sequence);
  assert.equal(search.results[0].id, 'docs/current.md');
  const document = await read('api/document?id=docs/old.md');
  assert.equal(document.id, 'docs/current.md');
  assert.equal(document.references[0].targetId, 'docs/current.md');
  assert.equal(document.sequence, map.sequence);
  assert.equal((await fetch(new URL('api/search?q=' + 'x'.repeat(201), app.url))).status, 400);
  assert.equal((await fetch(new URL('api/search?q=a&q=b', app.url))).status, 400);
  const abort = new AbortController();
  const response = await fetch(new URL('api/events', app.url), { signal: abort.signal });
  assert.match(response.headers.get('content-type'), /event-stream/);
  const stream = response.body.getReader();
  const decoder = new TextDecoder();
  assert.match(decoder.decode((await stream.read()).value), /event: ready/);
  await write('docs/current.md', '# New generation\n\nFresh token.');
  const next = await Promise.race([
    stream.read(), new Promise((_, reject) => setTimeout(() => reject(new Error('No SSE change')), 8000).unref())
  ]);
  assert.match(decoder.decode(next.value), /event: change/);
  abort.abort();
  const fresh = await read('api/search?q=fresh');
  assert.equal(fresh.total, 1);
  assert.ok(fresh.sequence > map.sequence);
  assert.equal((await read('api/document?id=docs/current.md')).sequence, fresh.sequence);
  await fs.unlink(path.join(root, 'docs/current.md'));
  assert.equal((await fetch(new URL('api/document?id=docs/current.md', app.url))).status, 404);
});


test('rapid saves settle on the latest coherent document and search contents', async t => {
  const { write, store } = await watched(t);
  await changed(store, current => current.contents.get('docs/DESIGN.md').includes('Final token'), async () => {
    for (let index = 0; index < 12; index++) await write('docs/DESIGN.md', '# Intermediate ' + index);
    await write('docs/DESIGN.md', '# Final token');
  });
  assert.equal(searchDocuments(store.current.searchIndex, 'Final token').total, 1);
  assert.equal(searchDocuments(store.current.searchIndex, 'Intermediate').total, 0);
});
