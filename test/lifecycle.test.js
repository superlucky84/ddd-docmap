import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createProjectStore } from '../src/server/project-store.js';
import { createProject } from './helpers/projects.js';

const deadline = (promise, message) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 1500); })])
    .finally(() => clearTimeout(timer));
};

// Exercise the documented watcher event/close interface, including unavailable OS events.
function controlledWatcher(ready = true) {
  const watcher = new EventEmitter();
  watcher.closed = false;
  watcher.close = async () => { watcher.closed = true; watcher.removeAllListeners(); };
  if (ready) queueMicrotask(() => watcher.emit('ready'));
  return watcher;
}

test('closing during watcher replacement cancels readiness and completes without publishing again', async t => {
  const { root, write } = await createProject(t, { 'docs/DESIGN.md': '# Design' });
  const watchers = [];
  let replacementStarted;
  const replaced = new Promise(resolve => { replacementStarted = resolve; });
  const store = await createProjectStore(root, { watcherFactory() {
    const watcher = controlledWatcher(watchers.length === 0);
    watchers.push(watcher);
    if (watchers.length === 2) replacementStarted();
    return watcher;
  } });
  let changes = 0;
  store.subscribe(() => { changes++; });
  await write('ddd-docmap.config.json', '{"version":1}');
  watchers[0].emit('all', 'change', root + '/ddd-docmap.config.json');
  await deadline(replaced, 'Watcher replacement did not start');
  await deadline(store.close(), 'Shutdown hung waiting for watcher readiness');
  assert.equal(changes, 0);
  assert.ok(watchers.every(watcher => watcher.closed));
  assert.equal(watchers[1].listenerCount('ready'), 0);
});

test('a watcher failure before readiness rejects startup and closes acquired resources', async t => {
  const { root } = await createProject(t, { 'docs/DESIGN.md': '# Design' });
  const watcher = controlledWatcher(false);
  await assert.rejects(createProjectStore(root, { watcherFactory() {
    queueMicrotask(() => watcher.emit('error', new Error('simulated EMFILE')));
    return watcher;
  } }), /EMFILE/);
  assert.equal(watcher.closed, true);
  assert.equal(watcher.listenerCount('error'), 0);
});

test('a runtime watcher error keeps the last good generation and a subsequent valid update clears it', async t => {
  const { root, write } = await createProject(t, { 'docs/DESIGN.md': '# Original' });
  let watcher;
  const store = await createProjectStore(root, { watcherFactory() { watcher = controlledWatcher(); return watcher; } });
  t.after(() => store.close());
  const revision = store.current.snapshot.revision;
  watcher.emit('error', new Error('simulated runtime failure'));
  assert.match(store.status().error, /runtime failure/);
  assert.equal(store.current.snapshot.revision, revision);
  const recovered = new Promise(resolve => store.subscribe((type, status) => {
    if (type === 'change' && !status.error) resolve();
  }));
  await write('docs/DESIGN.md', '# Recovered');
  watcher.emit('all', 'change', root + '/docs/DESIGN.md');
  await deadline(recovered, 'The store did not recover');
  assert.equal(store.current.snapshot.documents[0].title, 'Recovered');
  assert.equal(store.status().error, null);
});
