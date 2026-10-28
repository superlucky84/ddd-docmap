import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { run } from '../src/cli.js';
import { createBasicProject, createProject } from './helpers/projects.js';
import { cliPath, startCli } from './helpers/cli.js';

test('help, version, invalid arguments, and invalid roots exit without a server', async t => {
  const { root } = await createProject(t);
  for (const [args, code, expected] of [
    [['--help'], 0, 'Press Ctrl+C'],
    [['--version'], 0, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version],
    [['--unknown'], 2, '--help'],
    [['--root'], 2, 'argument'],
    [['--docs-dir'], 2, 'argument'],
    [['--docs-dir', '../outside', '--no-open'], 2, 'project-relative'],
    [['--all-md=true'], 2, '--all-md'],
    [['--root', './missing', '--no-open'], 2, 'root']
  ]) {
    const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, code, result.stderr);
    assert.ok((result.stdout + result.stderr).includes(expected), result.stderr);
  }
});

test('help explains additional scope, configuration migration and every JSON field', async t => {
  const { root } = await createProject(t);
  const result = spawnSync(process.execPath, [cliPath, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0);
  for (const item of ['--docs-dir', '--all-md', 'docatlas.config.json', 'ddd-docmap.config.json',
    'version: 1', 'include', 'exclude', 'groups', 'redirects', 'node_modules']) assert.ok(result.stdout.includes(item), item);
});

test('repeated docs directories resolve against --root, not the CLI cwd', async t => {
  const project = await createProject(t, {
    'docs/DESIGN.md': '# Default', 'documentation/intro.md': '# Introduction', '팀 문서/guide.md': '# Guide'
  });
  const other = await createProject(t, { 'documentation/wrong.md': '# Wrong project' });
  const cli = await startCli(t, { cwd: other.root, args: ['--root', project.root,
    '--docs-dir', 'documentation', '--docs-dir', '팀 문서', '--no-open'] });
  const snapshot = await (await fetch(cli.url + 'api/map')).json();
  assert.deepEqual(snapshot.documents.map(doc => doc.id), ['docs/DESIGN.md', 'documentation/intro.md', '팀 문서/guide.md']);
  cli.child.kill('SIGINT');
  assert.deepEqual(await cli.exited, { code: 0, signal: null });
});

test('all-md overrides configured include but preserves exclusions in a running CLI', async t => {
  const { root } = await createProject(t, {
    'docatlas.config.json': '{"version":1,"include":[]}', 'README.md': '# Root', 'notes/idea.md': '# Idea',
    'node_modules/pkg/docs/hidden.md': '# Dependency', 'dist/docs/hidden.md': '# Output'
  });
  const cli = await startCli(t, { cwd: root, args: ['--all-md', '--docs-dir', 'notes', '--no-open'] });
  const snapshot = await (await fetch(cli.url + 'api/map')).json();
  assert.deepEqual(snapshot.documents.map(doc => doc.id), ['README.md', 'notes/idea.md']);
  cli.child.kill('SIGTERM');
  assert.deepEqual(await cli.exited, { code: 0, signal: null });
});

test('cwd starts a foreground server and SIGINT exits cleanly', async t => {
  const { root } = await createBasicProject(t);
  const cli = await startCli(t, { cwd: root, args: ['--no-open'] });
  const snapshot = await (await fetch(cli.url + 'api/map')).json();
  assert.equal(snapshot.project.rootLabel, root);
  assert.equal(snapshot.documents.length, 8);
  assert.equal(cli.child.exitCode, null);
  cli.child.kill('SIGINT');
  assert.deepEqual(await cli.exited, { code: 0, signal: null });
  await assert.rejects(fetch(cli.url));
});

test('--root overrides cwd and SIGTERM does not terminate another CLI server', async t => {
  const first = await createBasicProject(t);
  const second = await createProject(t, { 'docs/DESIGN.md': '# Another project\n' });
  const a = await startCli(t, { cwd: second.root, args: ['--root', first.root, '--no-open'] });
  const b = await startCli(t, { cwd: second.root, args: ['--no-open'] });
  assert.equal((await (await fetch(a.url + 'api/map')).json()).project.rootLabel, first.root);
  a.child.kill('SIGTERM');
  assert.deepEqual(await a.exited, { code: 0, signal: null });
  assert.equal((await (await fetch(b.url + 'api/map')).json()).documents.length, 1);
});

test('opens the browser only after the HTTP server is ready', async t => {
  const { root } = await createBasicProject(t);
  const signals = new EventEmitter();
  let opened = false;
  let failure;
  const execution = run(['--root', root], {
    signals, stdout: { write() {} }, stderr: { write() {} },
    opener: async url => {
      try {
        assert.equal((await fetch(url)).status, 200);
        opened = true;
      } catch (error) { failure = error; }
      finally { signals.emit('SIGINT'); }
    }
  });
  t.after(() => { signals.emit('SIGTERM'); return execution; });
  assert.equal(await execution, 0);
  assert.ifError(failure);
  assert.equal(opened, true);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('browser launch failure prints a usable address and keeps serving until stopped', async t => {
  const { root } = await createBasicProject(t);
  const signals = new EventEmitter();
  let url;
  let resolveWarning;
  const warning = new Promise(resolve => { resolveWarning = resolve; });
  const execution = run(['--root', root], {
    signals,
    stdout: { write(text) { url = text.match(/Document map: (http:\/\/127\.0\.0\.1:\d+\/)/)?.[1] || url; } },
    stderr: { write(text) { if (text.includes('Could not open')) resolveWarning(text); } },
    opener: async () => { throw new Error('No desktop available'); }
  });
  t.after(() => { signals.emit('SIGTERM'); return execution; });
  assert.match(await warning, /manually/);
  assert.equal((await fetch(url)).status, 200);
  signals.emit('SIGINT');
  assert.equal(await execution, 0);
});
