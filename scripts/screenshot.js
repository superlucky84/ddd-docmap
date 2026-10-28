// Recreates the README screenshot from a copy of examples/sample-shop.
// Usage: node scripts/screenshot.js [--project <empty dir>] [--out <png>] [--executable-path <browser>]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server/index.js';

const repository = fileURLToPath(new URL('../', import.meta.url));
const example = path.join(repository, 'examples/sample-shop');

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    out: { type: 'string', default: path.join(repository, '.github/assets/document-map.png') },
    'executable-path': { type: 'string' }
  }
});

async function copyExample(directory) {
  const existing = await fs.readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (existing.length) {
    throw new Error('Choose an empty or missing --project directory: ' + directory);
  }
  await fs.cp(example, directory, { recursive: true });
}

const temporary = values.project ? null : await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-screenshot-'));
const project = path.resolve(values.project || path.join(temporary, 'sample-shop'));
let app;
let browser;
try {
  await copyExample(project);
  app = await startServer({ root: project });
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch({
    channel: process.env.DOCMAP_BROWSER_CHANNEL || undefined,
    executablePath: values['executable-path']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
  await page.goto(app.url);
  await page.getByRole('button', { name: 'Expand Checkout', exact: true }).click();
  await page.getByRole('button', { name: 'Show documents for Checkout', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Checkout', exact: true })
    .getByRole('button', { name: 'Design', exact: true }).click();
  await page.locator('#document-title').filter({ hasText: 'Checkout — Design' }).waitFor();
  await fs.mkdir(path.dirname(values.out), { recursive: true });
  await page.screenshot({ path: values.out });
  console.log('Saved ' + values.out + ' from ' + project);
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
}
