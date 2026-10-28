import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify, parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { collectProject } from '../src/collector/index.js';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createProjectStore } from '../src/server/project-store.js';
import { startServer } from '../src/server/index.js';
import { createScaleProject } from '../test/helpers/scale.js';

const { values } = parseArgs({ options: { browser: { type: 'boolean' }, worker: { type: 'string' }, root: { type: 'string' } } });
const memory = () => Object.fromEntries(['rss', 'heapUsed'].map(key => [key + 'MiB', +(process.memoryUsage()[key] / 1024 ** 2).toFixed(2)]));
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values.length, p50Ms: +sorted[Math.ceil(sorted.length * .5) - 1].toFixed(2),
    p95Ms: +sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2), maxMs: +sorted.at(-1).toFixed(2) };
};
const timed = async fn => { const start = performance.now(); const value = await fn(); return { ms: performance.now() - start, value }; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function collection(root) {
  const first = await timed(() => collectProject(root));
  assert.equal(first.value.documents.length, 300);
  const samples = [];
  for (let i = 0; i < 5; i++) samples.push((await timed(() => collectProject(root))).ms);
  const indexed = await timed(async () => createSearchIndex(await scanProject(root)));
  const queries = ['검색바늘', 'uniqueToken74', '공통 기능', 'docs/영역', 'nothing-matches', 'documentation original', 'Feature 24'];
  const searches = [];
  for (let i = 0; i < 70; i++) searches.push((await timed(() => searchDocuments(indexed.value, queries[i % queries.length]))).ms);
  assert.equal(searchDocuments(indexed.value, 'uniqueToken74').total, 4);
  return { firstCollectionMs: +first.ms.toFixed(2), collection: summary(samples),
    scanAndSearchIndexMs: +indexed.ms.toFixed(2), search: summary(searches), memory: memory() };
}

async function live(root) {
  const started = await timed(() => createProjectStore(root));
  const store = started.value;
  try {
    await wait(800);
    const cpu = process.cpuUsage();
    const idleStart = performance.now();
    await wait(5000);
    const idle = process.cpuUsage(cpu);
    const idleMs = performance.now() - idleStart;
    const idleMemory = memory();
    const id = store.current.snapshot.documents[1].id;
    const original = await fs.readFile(path.join(root, id), 'utf8');
    const updates = [];
    for (let i = 0; i < 5; i++) {
      const token = 'liveBenchmarkToken' + i;
      const start = performance.now();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { unsubscribe(); reject(new Error('Live update timeout')); }, 20000);
        const unsubscribe = store.subscribe((_type, status) => {
          if (status.error || searchDocuments(store.current.searchIndex, token).total !== 1) return;
          clearTimeout(timeout); unsubscribe(); resolve();
        });
        void fs.writeFile(path.join(root, id), original + '\n\n' + token)
          .catch(error => { clearTimeout(timeout); unsubscribe(); reject(error); });
      });
      updates.push(performance.now() - start);
    }
    return { storeStartupMs: +started.ms.toFixed(2),
      idle: { wallMs: +idleMs.toFixed(2), cpuMs: +((idle.user + idle.system) / 1000).toFixed(2),
        percentOfOneCore: +((idle.user + idle.system) / (idleMs * 10)).toFixed(2), memory: idleMemory },
      saveToPublishedIndex: summary(updates), memoryAfterUpdates: memory() };
  } finally { await store.close(); }
}

async function browserMetrics(root) {
  const { chromium } = await import('@playwright/test');
  const app = await startServer({ root });
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.DOCMAP_BROWSER_CHANNEL || 'chrome' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const started = performance.now();
    await page.goto(app.url);
    await page.waitForFunction(() => document.getElementById('map-count').textContent.includes('300 documents'));
    const result = { version: browser.version(), mapReadyMs: +(performance.now() - started).toFixed(2) };
    const searchStart = performance.now();
    await page.getByRole('searchbox').fill('uniqueToken74');
    await page.waitForFunction(() => document.getElementById('search-status').textContent === '4 documents');
    result.searchInputToResultsMs = +(performance.now() - searchStart).toFixed(2);
    const selected = page.locator('.search-result').first();
    const openStart = performance.now();
    await selected.click();
    await page.waitForFunction(() => document.getElementById('document-content').textContent.includes('uniqueToken74'));
    result.openDocumentMs = +(performance.now() - openStart).toFixed(2);
    const id = await selected.getAttribute('data-document-id');
    const original = await fs.readFile(path.join(root, id), 'utf8');
    const saveStart = performance.now();
    await fs.writeFile(path.join(root, id), original + '\n\nBrowserFreshToken.');
    await page.waitForFunction(() => document.getElementById('document-content').textContent.includes('BrowserFreshToken'));
    result.saveToVisibleContentMs = +(performance.now() - saveStart).toFixed(2);
    if (process.env.DOCMAP_BENCHMARK_SCREENSHOT) await page.screenshot({ path: process.env.DOCMAP_BENCHMARK_SCREENSHOT });
    return result;
  } finally { await browser?.close(); await app.close(); }
}

if (values.worker) {
  assert.ok(values.root, 'Worker needs a root');
  const task = { collection, live, browser: browserMetrics }[values.worker];
  assert.ok(task, 'Unknown worker');
  const result = await task(values.root);
  result.maxRssMiB = +(process.resourceUsage().maxRSS / 1024).toFixed(2);
  console.log(JSON.stringify(result));
} else {
  const cleanups = [];
  const project = await createScaleProject({ after: fn => cleanups.push(fn) });
  try {
    const report = {
      environment: { node: process.version, platform: process.platform, release: os.release(), arch: process.arch,
        cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryGiB: +(os.totalmem() / 1024 ** 3).toFixed(1),
        ...(process.platform === 'darwin' ? { macOS: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim() } : {}) },
      fixture: { documents: 300, features: 75, documentBytes: project.documentBytes, noiseFiles: project.noiseFiles },
      method: 'Separate fresh Node workers; sequential, warm filesystem cache, no explicit GC. Browser metrics exclude server startup; RSS excludes Chrome processes.'
    };
    for (const worker of ['collection', 'live', ...(values.browser ? ['browser'] : [])]) {
      const result = await promisify(execFile)(process.execPath,
        [fileURLToPath(import.meta.url), '--worker', worker, '--root', project.root], { maxBuffer: 1024 * 1024 });
      report[worker] = JSON.parse(result.stdout);
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { for (const cleanup of cleanups) await cleanup(); }
}
