import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { startServer } from '../src/server/index.js';
import { createProject } from './helpers/projects.js';
import { startCli } from './helpers/cli.js';

async function stream(url) {
  const abort = new AbortController();
  const response = await fetch(url + 'api/events', { signal: abort.signal });
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: ready/);
  return { reader, abort };
}

function deadline(promise, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 4000); })])
    .finally(() => clearTimeout(timer));
}

test('repeated servers close active and aborted SSE streams, reuse their port, and honor HEAD', async t => {
  const { root } = await createProject(t, { 'docs/DESIGN.md': '# Shutdown' });
  let port = 0;
  for (let i = 0; i < 3; i++) {
    const app = await startServer({ root, port });
    t.after(() => app.close());
    port = Number(new URL(app.url).port);
    const head = await fetch(app.url + 'api/events', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const active = await stream(app.url);
    const cancelled = await stream(app.url);
    cancelled.abort.abort();
    await deadline(Promise.all([app.close(), app.close()]), 'Server did not close active SSE');
    assert.equal((await active.reader.read()).done, true);
  }
});

test('CLI exits cleanly with an SSE client during a settings update and another server stays live', async t => {
  const project = await createProject(t, { 'docs/DESIGN.md': '# Signal test' });
  const other = await startServer({ root: project.root });
  t.after(() => other.close());
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const cli = await startCli(t, { cwd: project.root, args: ['--no-open'] });
    const active = await stream(cli.url);
    await project.write('ddd-docmap.config.json', '{"version":1}');
    cli.child.kill(signal);
    assert.deepEqual(await deadline(cli.exited, 'CLI did not release watcher and SSE'), { code: 0, signal: null });
    const end = await deadline(active.reader.read(), 'SSE did not end');
    assert.equal(end.done, true);
    active.abort.abort();
    assert.equal((await fetch(other.url + 'api/map')).status, 200);
  }
});

test('registered raster reads reject a parent swapped outside after path inspection', async t => {
  const { root } = await createProject(t, { 'docs/DESIGN.md': '# Document\n\n![Diagram](assets/image.png)', 'docs/assets/image.png': Buffer.from([1]) });
  const outside = await createProject(t, { 'image.png': Buffer.from([9]) });
  const app = await startServer({ root });
  t.after(() => app.close());
  const data = await (await fetch(app.url + 'api/document?id=docs/DESIGN.md')).json();
  const image = data.references.find(ref => ref.type === 'image');
  const original = fs.realpath;
  let calls = 0;
  t.mock.method(fs, 'realpath', async (...args) => {
    const resolved = await original(...args);
    if (args[0] === root + '/docs/assets/image.png' && ++calls === 2) {
      await fs.rename(root + '/docs/assets', root + '/docs/moved-assets');
      await fs.symlink(outside.root, root + '/docs/assets');
    }
    return resolved;
  });
  const response = await fetch(new URL(image.src, app.url));
  assert.equal(response.status, 403);
});
