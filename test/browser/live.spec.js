import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../../src/server/index.js';
import { createProject } from '../helpers/projects.js';
import { PNG } from '../helpers/reading.js';

let project;
let app;
let cleanups;
const longBody = Array.from({ length: 65 }, (_, index) => 'Paragraph ' + index + '. Read this long document and preserve the current position.').join('\n\n');
const design = '# Catalog — Design\n\nPayment architecture.\n\n## Details\n\n환불 검색토큰 PaymentToken.\n\n~~~js\nconst safeText = "<img onerror=window.badSearch=true>";\n~~~\n\n' + longBody;

test.beforeEach(async ({ page }) => {
  cleanups = [];
  project = await createProject({ after: fn => cleanups.push(fn) }, {
    'docs/catalog/REQUIREMENTS.md': '# Catalog — Requirements\n\nBrowse the catalog.\n\n[Old design](../old.md#details)',
    'docs/catalog/DESIGN.md': design,
    'docs/notes/README.md': '# Notes\n\nResearch decisions.'
  });
  app = await startServer({ root: project.root });
  await page.goto(app.url);
  await expect(page.locator('#live-status')).toHaveText('Live updates');
});

test.afterEach(async () => {
  await app.close();
  for (const cleanup of cleanups) await cleanup();
});

async function openDesign(page) {
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true }).getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-content')).toContainText('PaymentToken');
}

test('search finds Korean body, feature, path and code with safe highlighted context', async ({ page }) => {
  const input = page.getByRole('searchbox', { name: 'Search documentation' });
  await input.fill('환불 PAYMENTtoken');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await expect(page.locator('.result-snippet mark')).toHaveText(['환불', 'PaymentToken']);
  await page.locator('.search-result').click();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await input.fill('safeText');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await expect(page.locator('.result-snippet')).toContainText('<img onerror');
  await expect(page.locator('.result-snippet img')).toHaveCount(0);
  expect(await page.evaluate(() => window.badSearch)).toBeUndefined();
  await input.fill('docs/catalog requirements');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await expect(page.locator('.result-title')).toHaveText('Catalog — Requirements');
  await input.fill('nothing-matches');
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
  await input.press('Escape');
  await expect(page.locator('#map-tree')).toBeVisible();
});

test('IME composition waits to search and the slash shortcut works on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesign(page);
  await page.keyboard.press('/');
  const input = page.getByRole('searchbox');
  await expect(input).toBeFocused();
  let searches = 0;
  page.on('request', request => { if (request.url().includes('/api/search?')) searches++; });
  await input.dispatchEvent('compositionstart');
  await input.fill('환불');
  await page.waitForTimeout(260);
  expect(searches).toBe(0);
  await input.dispatchEvent('compositionend');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await input.press('ArrowDown');
  await expect(page.locator('.search-result')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#document-content')).toBeVisible();
});

test('a delayed previous query cannot replace the latest results', async ({ page }) => {
  let delayed;
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  await page.route('**/api/search?*', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'first') { delayed = route; ready(); }
    else await route.continue();
  });
  await page.getByRole('searchbox').fill('first');
  await started;
  await page.getByRole('searchbox').fill('Research');
  await expect(page.locator('.result-title')).toHaveText('Notes');
  await delayed.fulfill({ json: { sequence: 999, total: 1, results: [{ id: 'stale', title: 'Stale', groupTitle: '', relativePath: '', snippet: '' }] } }).catch(() => {});
  await expect(page.locator('.result-title')).toHaveText('Notes');
});

test('saving refreshes source, search and map while preserving mode, scroll and history length', async ({ page }) => {
  await openDesign(page);
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 380; });
  const before = await page.evaluate(() => ({ scroll: document.getElementById('reader-scroll').scrollTop, entries: history.length }));
  await page.getByRole('searchbox').fill('검색토큰');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await project.write('docs/catalog/DESIGN.md', design.replace('검색토큰', '최신토큰'));
  await expect(page.locator('#document-source')).toContainText('최신토큰');
  await expect(page.locator('#document-source')).toBeVisible();
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(before.scroll);
  expect(await page.evaluate(() => history.length)).toBe(before.entries);
  await page.getByRole('searchbox').fill('최신토큰');
  await expect(page.locator('.search-result[aria-current="page"]')).toHaveCount(1);
});

test('added documents appear and selected deletion clears the body while another document opens', async ({ page }) => {
  await openDesign(page);
  await project.write('docs/new/README.md', '# New area\n\nNewly added searchable material.');
  await expect(page.locator('#map-count')).toHaveText('3 features · 4 documents');
  await page.getByRole('searchbox').fill('newly');
  await expect(page.locator('.result-title')).toHaveText('New area');
  await fs.unlink(path.join(project.root, 'docs/catalog/DESIGN.md'));
  await expect(page.locator('#document-status')).toContainText('removed from the map');
  await expect(page.locator('#document-content')).toBeEmpty();
  await expect(page.locator('#document-source')).toBeEmpty();
  await page.locator('.search-result').click();
  await expect(page.locator('#document-content')).toContainText('Newly added');
});

test('bad settings retain the last good map and recover after fixing JSON', async ({ page }) => {
  await openDesign(page);
  await project.write('ddd-docmap.config.json', '{invalid');
  await expect(page.locator('#live-status')).toContainText('Updates paused:');
  await expect(page.locator('#map-count')).toHaveText('2 features · 3 documents');
  await expect(page.locator('#document-content')).toContainText('PaymentToken');
  await page.getByRole('searchbox').fill('Research');
  await expect(page.locator('.result-title')).toHaveText('Notes');
  await project.write('ddd-docmap.config.json', JSON.stringify({ version: 1, exclude: ['docs/notes/**'] }));
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  await expect(page.locator('#map-count')).toHaveText('1 features · 2 documents');
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
});

test('explicit redirects work from an absent previous URL, search path and relative link', async ({ page }) => {
  await project.write('ddd-docmap.config.json', JSON.stringify({ version: 1, redirects: { 'docs/old.md': 'docs/catalog/DESIGN.md' } }));
  await expect.poll(async () => (await (await page.request.get(app.url + 'api/map')).json()).redirects.length).toBe(1);
  await page.goto(app.url + '?doc=' + encodeURIComponent('docs/old.md') + '#details');
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect(page).toHaveURL(/doc=docs%2Fcatalog%2FDESIGN.md#details$/);
  await page.getByRole('searchbox').fill('old.md');
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await expect(page.locator('.result-path-text')).toHaveText('docs/catalog/DESIGN.md');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true }).getByRole('button', { name: 'Requirements', exact: true }).click();
  await page.getByRole('link', { name: 'Old design', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect(page.locator('#map-count')).toHaveText('2 features · 3 documents');
});

test('a save during a delayed user navigation preserves the user selection and fetches fresh content', async ({ page }) => {
  await openDesign(page);
  let delayed;
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  await page.route('**/api/document?*', async route => {
    if (new URL(route.request().url()).searchParams.get('id') === 'docs/catalog/REQUIREMENTS.md' && !delayed) {
      delayed = route; ready();
    } else await route.continue();
  });
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true }).getByRole('button', { name: 'Requirements', exact: true }).click();
  await started;
  await project.write('docs/catalog/REQUIREMENTS.md', '# Catalog — Requirements\n\nFresh user target.');
  await expect.poll(async () => (await (await page.request.get(app.url + 'api/search?q=Fresh')).json()).total).toBe(1);
  await delayed.continue();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Requirements');
  await expect(page.locator('#document-content')).toContainText('Fresh user target');
});

test('search and selections are independent across tabs and project servers', async ({ page, context }) => {
  const other = await createProject({ after: fn => cleanups.push(fn) }, { 'docs/DESIGN.md': '# Other project\n\nIndependent token.' });
  const second = await startServer({ root: other.root });
  const tab = await context.newPage();
  const same = await context.newPage();
  try {
    await tab.goto(second.url);
    await same.goto(app.url);
    await page.getByRole('searchbox').fill('환불');
    await tab.getByRole('searchbox').fill('Independent');
    await expect(page.locator('.result-title')).toHaveText('Catalog — Design');
    await expect(tab.locator('.result-title')).toHaveText('Other project');
    await expect(same.getByRole('searchbox')).toHaveValue('');
    await same.getByRole('searchbox').fill('Research');
    await expect(same.locator('.result-title')).toHaveText('Notes');
    await expect(page.getByRole('searchbox')).toHaveValue('환불');
  } finally { await tab.close(); await same.close(); await second.close(); }
});

test('SSE reconnect ready catches changes missed while disconnected', async ({ page }) => {
  await page.goto('about:blank');
  await page.addInitScript(() => {
    const NativeSource = window.EventSource;
    window.EventSource = class extends NativeSource {
      constructor(...args) { super(...args); window.testEventSource = this; }
    };
  });
  await page.goto(app.url);
  await expect(page.locator('#live-status')).toHaveText('Live updates');
  await page.evaluate(() => window.testEventSource.close());
  await project.write('docs/missed.md', '# Missed update\n\nDisconnected change.');
  await expect.poll(async () => (await (await page.request.get(app.url + 'api/search?q=Disconnected')).json()).total).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('#map-count')).toHaveText('3 features · 4 documents');
});


test('a moved selection follows an explicit redirect without adding a history entry', async ({ page }) => {
  await openDesign(page);
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  const entries = await page.evaluate(() => history.length);
  await project.write('docs/new/DESIGN.md', design.replace('Payment architecture.', 'Moved architecture.'));
  await project.write('ddd-docmap.config.json', JSON.stringify({ version: 1, redirects: {
    'docs/catalog/DESIGN.md': 'docs/new/DESIGN.md'
  } }));
  await fs.unlink(path.join(project.root, 'docs/catalog/DESIGN.md'));
  await expect(page.locator('#document-path')).toHaveText('docs/new/DESIGN.md');
  await expect(page.locator('#document-source')).toBeVisible();
  await expect(page.locator('#document-source')).toContainText('Moved architecture');
  await expect(page).toHaveURL(/doc=docs%2Fnew%2FDESIGN.md$/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await expect(page.locator('.document-button[aria-current]')).toHaveCount(1);
});

test('typing and scrolling during an automatic document refresh keeps the latest UI state', async ({ page }) => {
  await openDesign(page);
  let pending;
  let resolvePending;
  const started = new Promise(resolve => { resolvePending = resolve; });
  await page.route('**/api/document?*', async route => {
    if (!pending) { pending = route; resolvePending(); }
    else await route.continue();
  });
  await project.write('docs/catalog/DESIGN.md', design + '\n\nChanged automatically.');
  await started;
  await page.getByRole('searchbox').fill('Research');
  await expect(page.locator('.result-title')).toHaveText('Notes');
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 440; });
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 220; });
  await pending.continue();
  await expect(page.locator('#document-source')).toContainText('Changed automatically');
  await expect(page.getByRole('searchbox')).toHaveValue('Research');
  await expect(page.locator('#document-source')).toBeVisible();
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(220);
});


test('image-only saves refresh registered image URLs and deletion updates the reader', async ({ page }) => {
  await project.write('docs/catalog/image.png', PNG);
  await project.write('docs/catalog/DESIGN.md', design + '\n\n![Local diagram](image.png)');
  await page.goto(app.url + '?doc=' + encodeURIComponent('docs/catalog/DESIGN.md'));
  const image = page.getByRole('img', { name: 'Local diagram', exact: true });
  await expect(image).toBeAttached();
  const previous = await image.getAttribute('src');
  await project.write('docs/catalog/image.png', Buffer.concat([PNG, Buffer.from([0])]));
  await expect.poll(() => image.getAttribute('src')).not.toBe(previous);
  await fs.unlink(path.join(project.root, 'docs/catalog/image.png'));
  await expect(page.locator('#document-content img')).toHaveCount(0);
  await expect(page.locator('.image-unavailable')).toContainText('Local diagram');
});

test('back and forward restore the search state captured when each document was left', async ({ page }) => {
  await page.getByRole('searchbox').fill('PaymentToken');
  await page.locator('.search-result').click();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await page.getByRole('searchbox').fill('Research');
  await expect(page.locator('.result-title')).toHaveText('Notes');
  await page.locator('.search-result').click();
  await expect(page.locator('#document-title')).toHaveText('Notes');
  await page.getByRole('searchbox').fill('No-match-here');
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
  await page.goBack();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect(page.getByRole('searchbox')).toHaveValue('Research');
  await expect(page.locator('.result-title')).toHaveText('Notes');
  await page.goForward();
  await expect(page.locator('#document-title')).toHaveText('Notes');
  await expect(page.getByRole('searchbox')).toHaveValue('No-match-here');
});
