import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { run } from '../src/cli.js';
import { createBasicProject, createProject } from './helpers/projects.js';
import { cliPath, startCli } from './helpers/cli.js';

test('help, version, invalid arguments, and invalid roots exit without a server', async t => {
  const { root } = await createProject(t);
  for (const [args, code, expected] of [
    [['--help'], 0, 'Press Ctrl+C'],
    [['--version'], 0, '0.0.0-dev.0'],
    [['--unknown'], 2, '--help'],
    [['--root'], 2, 'argument'],
    [['--root', './missing', '--no-open'], 2, 'root']
  ]) {
    const result = spawnSync(process.execPath, [cliPath, ...args], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, code, result.stderr);
    assert.ok((result.stdout + result.stderr).includes(expected), result.stderr);
  }
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
