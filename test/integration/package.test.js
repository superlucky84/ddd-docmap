import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createReadingProject, READING_ID, READING_MARKDOWN } from '../helpers/reading.js';
import { BASIC_FILES } from '../helpers/projects.js';
import { startCli } from '../helpers/cli.js';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const digest = content => createHash('sha256').update(content).digest('hex');

async function npm(args, cwd) {
  const cli = process.env.npm_execpath;
  const command = cli ? process.execPath : 'npm';
  const env = { ...process.env };
  if (env.DOCMAP_NPM_CACHE) env.npm_config_cache = env.DOCMAP_NPM_CACHE;
  return execute(command, cli ? [cli, ...args] : args, { cwd, env, timeout: 60000, maxBuffer: 2 ** 20 });
}

async function filesIn(root, directory = root, result = {}) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (entry.isDirectory()) await filesIn(root, filename, result);
    else if (entry.isSymbolicLink()) result[relative] = 'link:' + await fs.readlink(filename);
    else result[relative] = digest(await fs.readFile(filename));
  }
  return result;
}

async function stop(cli, signal) {
  cli.child.kill(signal);
  let timeout;
  try {
    const result = await Promise.race([cli.exited, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Installed CLI did not exit after ' + signal)), 5000);
    })]);
    assert.deepEqual(result, { code: 0, signal: null });
  } finally { clearTimeout(timeout); }
}

test('F-07: a production tarball runs independently and preserves both target projects', { timeout: 120000 }, async t => {
  const cleanups = [];
  const scope = { after: fn => cleanups.push(fn) };
  t.after(async () => { for (const cleanup of cleanups.reverse()) await cleanup(); });
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ddd-docmap-install-'));
  const installRoot = await fs.realpath(temporary);
  scope.after(() => fs.rm(installRoot, { recursive: true, force: true }));
  const { stdout } = await npm(['pack', '--json', '--pack-destination', installRoot], repository);
  const [pack] = JSON.parse(stdout);
  const packedFiles = new Set(pack.files.map(file => file.path));
  for (const filename of ['bin/ddd-docmap.js', 'src/collector/read.js', 'src/collector/index.js',
    'src/server/index.js', 'src/server/project-store.js', 'src/server/render.js',
    'src/web/index.html', 'src/web/app.js', 'src/web/reader.js', 'src/web/search.js', 'src/web/live.js', 'src/web/styles.css']) {
    assert.ok(packedFiles.has(filename), 'Missing runtime file: ' + filename);
  }
  assert.ok(!pack.files.some(file => /^(?:node_modules|test)\//.test(file.path)));
  await fs.writeFile(path.join(installRoot, 'package.json'), '{"private":true,"type":"module"}\n');
  await npm(['install', '--offline', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund',
    path.join(installRoot, pack.filename)], installRoot);
  const installed = path.join(installRoot, 'node_modules/@superlucky84/ddd-docmap');
  const executable = path.join(installed, 'bin/ddd-docmap.js');
  assert.ok(!(await fs.lstat(installed)).isSymbolicLink());
  await assert.rejects(fs.access(path.join(installRoot, 'node_modules/@playwright/test')), { code: 'ENOENT' });
  assert.equal((await execute(process.execPath, [executable, '--version'], { cwd: installRoot })).stdout.trim(), pack.version);

  const js = await createReadingProject(scope, {
    'package.json': '{"private":true,"scripts":{"build":"exit 99"}}',
    'docs/catalog/REQUIREMENTS.md': BASIC_FILES['docs/catalog/REQUIREMENTS.md'] + '\nJavaScriptOnlyToken.\n',
    'ddd-docmap.config.json': JSON.stringify({ version: 1, redirects: { 'docs/old/DESIGN.md': READING_ID } })
  });
  const nonJs = await createReadingProject(scope, {
    'main.py': 'print("This project needs no JavaScript build.")\n',
    'docs/catalog/REQUIREMENTS.md': BASIC_FILES['docs/catalog/REQUIREMENTS.md'] + '\nPythonOnlyToken.\n'
  });
  const beforeJs = await filesIn(js.root);
  const beforeNonJs = await filesIn(nonJs.root);
  const alias = path.join(installRoot, 'non-js-alias');
  await fs.symlink(nonJs.root, alias, 'dir');
  const first = await startCli(scope, { cwd: js.root, executable, args: ['--no-open'] });
  const second = await startCli(scope, { cwd: installRoot, executable, args: ['--root', alias, '--no-open'] });
  const browser = await chromium.launch({ channel: process.env.DOCMAP_BROWSER_CHANNEL || undefined });
  scope.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const otherPage = await browser.newPage();
  t.diagnostic(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
    chrome: browser.version(), packedFiles: packedFiles.size, packageBytes: pack.size, offline: true }));

  await t.test('installed API, cwd, explicit root, and packaged web assets agree', async () => {
    const api = await execute(process.execPath, ['--input-type=module', '-e',
      'import { collectProject } from "@superlucky84/ddd-docmap"; console.log(JSON.stringify(await collectProject(process.argv[1])));',
      js.root], { cwd: installRoot });
    const collected = JSON.parse(api.stdout);
    const map = await (await fetch(first.url + 'api/map')).json();
    const otherMap = await (await fetch(second.url + 'api/map')).json();
    assert.equal(map.documents.length, 9);
    assert.equal(otherMap.documents.length, 9);
    assert.equal(map.revision, collected.revision);
    assert.equal(map.project.rootLabel, js.root);
    assert.equal(otherMap.project.rootLabel, nonJs.root);
    assert.notEqual(map.project.id, otherMap.project.id);
    for (const asset of ['', 'app.js', 'reader.js', 'search.js', 'live.js', 'styles.css']) {
      const response = await fetch(first.url + asset);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).length > 0);
    }
    assert.equal((await fetch(first.url + 'package.json')).status, 404);
    assert.equal((await fetch(first.url + 'api/map', { headers: { Origin: 'https://example.com' } })).status, 403);
    await page.goto(first.url);
    await otherPage.goto(second.url);
    await expect(page.locator('#map-count')).toContainText('9 documents');
    await expect(otherPage.locator('#map-count')).toContainText('9 documents');
    await otherPage.getByRole('searchbox').fill('PythonOnlyToken');
    await expect(otherPage.locator('#search-status')).toHaveText('1 document');
    await otherPage.locator('.search-result').click();
    await expect(otherPage.locator('#document-content')).toContainText('PythonOnlyToken');
  });

  await t.test('installed reader selects all four kinds, resolves links, and renders safely', async () => {
    await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
    const group = page.getByRole('group', { name: 'Documents for Catalog', exact: true });
    for (const [kind, heading] of [['Requirements', 'Requirements'], ['Design', 'Design'],
      ['Implementation', 'Implementation'], ['Checks', 'Manual Test Checklist']]) {
      await group.getByRole('button', { name: kind, exact: true }).click();
      await expect(page.locator('#document-content h1')).toHaveText('Catalog — ' + heading);
    }
    await group.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.locator('#document-content table tr')).toHaveCount(3);
    await expect(page.locator('#document-content pre code')).toContainText('console.log(document.title)');
    await expect(page.locator('#document-content input[type="checkbox"]')).toHaveCount(2);
    await expect(page.locator('#document-content script')).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.untrustedDocumentRan), undefined);
    await expect.poll(() => page.getByRole('img', { name: 'Build overview', exact: true })
      .evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.locator('#document-content').getByRole('link', { name: 'Read the filter design', exact: true }).click();
    await expect(page.locator('#document-title')).toHaveText('Filters — Design');
    assert.equal(new URL(page.url()).hash, '#filter-behavior');
    await page.goBack();
    await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
    await page.locator('#document-content').getByRole('link', { name: '한글 문서', exact: true }).click();
    await expect(page.locator('#document-title')).toHaveText('사용 방법');
    await page.goto(first.url + '?doc=docs/old/DESIGN.md');
    await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
    await expect.poll(() => new URL(page.url()).searchParams.get('doc')).toBe(READING_ID);
  });

  await t.test('installed watcher preserves source state and closes only its own server', async () => {
    await page.getByRole('button', { name: 'View source', exact: true }).click();
    await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 250; });
    const changed = READING_MARKDOWN + '\nInstalledFreshToken.\n';
    await js.write(READING_ID, changed);
    beforeJs[READING_ID] = digest(changed);
    await expect(page.locator('#document-source')).toContainText('InstalledFreshToken');
    await expect(page.getByRole('button', { name: 'Read document', exact: true })).toBeVisible();
    await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(250);
    await page.getByRole('searchbox').fill('InstalledFreshToken');
    await expect(page.locator('#search-status')).toHaveText('1 document');
    await expect(otherPage.getByRole('searchbox')).toHaveValue('PythonOnlyToken');
    await expect(otherPage.locator('#document-content')).toContainText('PythonOnlyToken');
    const abort = new AbortController();
    const stream = await fetch(first.url + 'api/events', { signal: abort.signal });
    const reader = stream.body.getReader();
    await reader.read();
    await stop(first, 'SIGINT');
    assert.equal((await reader.read()).done, true);
    abort.abort();
    await assert.rejects(fetch(first.url + 'api/map'));
    assert.equal((await fetch(second.url + 'api/map')).status, 200);
    const secondChange = READING_MARKDOWN + '\nSurvivingServerToken.\n';
    await nonJs.write(READING_ID, secondChange);
    beforeNonJs[READING_ID] = digest(secondChange);
    await otherPage.getByRole('searchbox').fill('SurvivingServerToken');
    await expect(otherPage.locator('#search-status')).toHaveText('1 document');
    await stop(second, 'SIGTERM');
    assert.deepEqual(await filesIn(js.root), beforeJs);
    assert.deepEqual(await filesIn(nonJs.root), beforeNonJs);
  });
});
