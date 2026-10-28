import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { run } from '../src/cli.js';
import { startServer } from '../src/server/index.js';
import { createProject } from './helpers/projects.js';
import { LANGUAGE_FILES, SOURCE_DOCUMENTS } from './helpers/languages.js';
import { PNG } from './helpers/reading.js';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../', import.meta.url));
const prefix = '한글 프로젝트 with spaces';
const documentId = 'docs/설계 문서.md';
const files = {
  ...LANGUAGE_FILES,
  [documentId]: '# 한글 설계\r\n\r\nInitialPlatformToken.\r\n\r\n[관련 문서](sub/README.md)\r\n\r\n![그림](assets/diagram.png)\r\n\r\n[생성 문서](../target/generated-docs/docs/README.md)\r\n\r\n![생성 이미지](../target/diagram.png)\r\n',
  'docs/sub/README.md': '# Related document\r\n',
  'docs/assets/diagram.png': PNG,
  'target/diagram.png': PNG,
  'notes/추가 문서.md': '# Additional document',
  'docatlas.config.json': JSON.stringify({ version: 1, redirects: { 'docs/old.md': documentId } })
};

async function fixture(t) {
  const cleanups = [];
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const project = await createProject({ after: fn => cleanups.push(fn) },
    Object.fromEntries(Object.entries(files).map(([name, body]) => [prefix + '/' + name, body])));
  const root = await fs.realpath(path.join(project.root, prefix));
  return { root, after: fn => cleanups.push(fn), write: (name, body) => project.write(prefix + '/' + name, body) };
}

async function eventually(read, predicate) {
  const deadline = Date.now() + 10000;
  do {
    const value = await read();
    if (predicate(value)) return value;
    await delay(50);
  } while (Date.now() < deadline);
  assert.fail('The platform fixture did not publish the expected update.');
}

async function controlledCli(project, implementation = run) {
  const signals = new EventEmitter();
  let stdout = '';
  let stderr = '';
  let ready;
  let failed;
  const started = new Promise((resolve, reject) => { ready = resolve; failed = reject; });
  const timer = setTimeout(() => failed(new Error('Platform CLI did not become ready.')), 10000);
  const execution = implementation(['--root', project.root, '--docs-dir', 'notes', '--no-open'], {
    signals,
    opener: () => { throw new Error('--no-open must not open a browser'); },
    stdout: { write(value) {
      stdout += value;
      const match = stdout.match(/Document map: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) { clearTimeout(timer); ready(match[1]); }
    } },
    stderr: { write(value) { stderr += value; } }
  });
  void execution.then(() => { clearTimeout(timer); failed(new Error('Platform CLI stopped before ready: ' + stderr)); }, error => {
    clearTimeout(timer); failed(error);
  });
  project.after(async () => { signals.emit('SIGINT'); await execution; });
  return { url: await started, signals, execution, output: () => ({ stdout, stderr }) };
}

test('native Unicode paths, CRLF, indexed links and raster assets work and SIGINT handler releases the server', async t => {
  const project = await fixture(t);
  const other = await startServer({ root: project.root });
  project.after(() => other.close());
  const cli = await controlledCli(project);
  const map = await (await fetch(cli.url + 'api/map')).json();
  assert.equal(map.project.rootLabel, project.root);
  assert.equal(map.documents.length, Object.keys(SOURCE_DOCUMENTS).length + 3);
  assert.ok(map.documents.every(document => !document.id.includes('\\') && !/^[a-z]:/i.test(document.id)));
  const document = await (await fetch(cli.url + 'api/document?id=' + encodeURIComponent(documentId))).json();
  assert.match(document.markdown, /\r\n/);
  assert.equal(document.references.find(reference => reference.type === 'document').targetId, 'docs/sub/README.md');
  const image = document.references.find(reference => reference.type === 'image');
  assert.deepEqual(Buffer.from(await (await fetch(new URL(image.src, cli.url))).arrayBuffer()), PNG);
  assert.equal(document.references.filter(reference => reference.type === 'blocked').length, 2);
  const previous = await (await fetch(cli.url + 'api/document?id=docs/old.md')).json();
  assert.equal(previous.id, documentId);
  const abort = new AbortController();
  const stream = await fetch(cli.url + 'api/events', { signal: abort.signal });
  const reader = stream.body.getReader();
  await reader.read();
  // This checks application cleanup through its signal handler, not native console delivery.
  cli.signals.emit('SIGINT');
  assert.equal(await cli.execution, 0);
  assert.equal((await reader.read()).done, true);
  abort.abort();
  assert.equal(cli.signals.listenerCount('SIGINT'), 0);
  assert.equal(cli.signals.listenerCount('SIGTERM'), 0);
  assert.equal(cli.output().stderr, '');
  await assert.rejects(fetch(cli.url + 'api/map'));
  assert.equal((await fetch(other.url + 'api/map')).status, 200);
  t.diagnostic(JSON.stringify({ platform: process.platform, node: process.version, nativeRoot: project.root,
    consoleCtrlC: 'requires separate manual validation' }));
});

test('native watcher reconfiguration restores and re-excludes language outputs without losing CLI scope', async t => {
  const project = await fixture(t);
  const cli = await controlledCli(project);
  const readMap = async () => (await fetch(cli.url + 'api/map')).json();
  await project.write(documentId, '# 한글 설계\r\n\r\nUpdatedPlatformToken.\r\n');
  await eventually(async () => (await fetch(cli.url + 'api/search?q=UpdatedPlatformToken')).json(), value => value.total === 1);
  await project.write('docatlas.config.json', '{"version":1,"exclude":[]}');
  await eventually(readMap, value => value.documents.some(document => document.id.startsWith('.venv/')));
  await project.write('docatlas.config.json', '{"version":1}');
  const restored = await eventually(readMap, value => !value.documents.some(document => document.id.startsWith('.venv/')));
  assert.ok(restored.documents.some(document => document.id === 'notes/추가 문서.md'));
  assert.ok(!restored.documents.some(document => document.id.startsWith('target/') || document.id.startsWith('.gradle/')));
  await project.write('notes/추가 문서.md', '# Additional document\n\nScopeStillWatchedToken.');
  await eventually(async () => (await fetch(cli.url + 'api/search?q=ScopeStillWatchedToken')).json(), value => value.total === 1);
});

async function fileHashes(root, directory = root, hashes = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await fileHashes(root, filename, hashes);
    else hashes[path.relative(root, filename)] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
  }
  return hashes;
}

test('installed production tarball exposes npm launchers and reads a manifest-free target without modifying files', { timeout: 120000 }, async t => {
  const project = await fixture(t);
  const temporary = await fs.mkdtemp(path.join(path.dirname(project.root), 'installed-tool-'));
  project.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, 'Run this suite with npm run test:platform or npm test.');
  async function npm(args, cwd) {
    const env = { ...process.env };
    if (env.DOCMAP_NPM_CACHE) env.npm_config_cache = env.DOCMAP_NPM_CACHE;
    return execute(process.execPath, [npmCli, ...args], { cwd, env, timeout: 60000, maxBuffer: 2 ** 20 });
  }
  const before = await fileHashes(project.root);
  const [pack] = JSON.parse((await npm(['pack', '--json', '--pack-destination', temporary], repository)).stdout);
  await fs.writeFile(path.join(temporary, 'package.json'), '{"private":true,"type":"module"}\n');
  // npm ci caches locked tarballs, but a new dependency tree can still need registry metadata.
  await npm(['install', '--prefer-offline', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(temporary, pack.filename)], temporary);
  for (const name of ['docatlas', 'docmap', 'ddd-docmap']) {
    const version = await npm(['exec', '--offline', '--', name, '--version'], temporary);
    assert.equal(version.stdout.trim(), pack.version);
    const help = await npm(['exec', '--offline', '--', name, '--help'], temporary);
    assert.match(help.stdout, /--docs-dir/);
    const launcher = path.join(temporary, 'node_modules/.bin', name + (process.platform === 'win32' ? '.cmd' : ''));
    await fs.access(launcher);
    if (process.platform === 'win32') assert.ok((await fs.stat(launcher)).isFile());
  }
  await assert.rejects(fs.access(path.join(project.root, 'package.json')), { code: 'ENOENT' });
  const installed = path.join(temporary, 'node_modules/docatlas');
  const { run: installedRun } = await import(pathToFileURL(path.join(installed, 'src/cli.js')));
  const cli = await controlledCli(project, installedRun);
  const map = await (await fetch(cli.url + 'api/map')).json();
  assert.equal(map.project.rootLabel, project.root);
  assert.ok(map.documents.some(document => document.id === documentId));
  assert.ok(!map.documents.some(document => document.id.startsWith('target/') || document.id.startsWith('.venv/')));
  const asset = await fetch(cli.url + 'styles.css');
  assert.equal(asset.status, 200);
  cli.signals.emit('SIGINT');
  assert.equal(await cli.execution, 0);
  assert.deepEqual(await fileHashes(project.root), before);
  t.diagnostic(JSON.stringify({ package: pack.name, version: pack.version, platform: process.platform,
    launchers: process.platform === 'win32' ? 'npm .cmd' : 'npm bin',
    installation: 'prefer-offline', launcherChecks: 'offline', originalFilesPreserved: true }));
});
