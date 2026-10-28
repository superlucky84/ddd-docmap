import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../../src/server/index.js';
import { createProject } from '../helpers/projects.js';

const folder = 'docs/zz-area/sub/한글 기능 \'경로\' [2026]';
const targetId = folder + '/two.md';
const readerId = 'docs/reader/DESIGN.md';
const key = (page, value) => page.locator('[data-focus-key=' + JSON.stringify(value) + ']');
const locate = (page, id) => page.getByRole('button', { name: 'Show ' + id + ' in document tree', exact: true });
let project;
let app;
let cleanups;

test.beforeEach(async ({ page }) => {
  cleanups = [];
  project = await createProject({ after: fn => cleanups.push(fn) }, {
    'DESIGN.md': '# Root contract\n\nRootOnlyToken.',
    [readerId]: '# Reader — Design\n\n' + 'Keep reading this original document.\n\n'.repeat(90),
    'docs/zz-area/DESIGN.md': '# Area — Design',
    'docs/zz-area/sub/DESIGN.md': '# Sub area — Design',
    [folder + '/one.md']: '# Same title\n\nNeedleOne.',
    [targetId]: '# Same title\n\nNeedleTwo.',
    ...Object.fromEntries(Array.from({ length: 24 }, (_, index) =>
      ['docs/filler-' + String(index).padStart(2, '0') + '/README.md', '# Filler ' + index]))
  });
  app = await startServer({ root: project.root });
  await page.goto(app.url);
  await expect(page.locator('#live-status')).toHaveText('Live updates');
});

test.afterEach(async () => {
  await app.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
});

async function expectLocated(page, id, { notice = true } = {}) {
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('#search-view')).toBeHidden();
  await expect(page.locator('#search-results')).toBeEmpty();
  await expect(page.locator('#map-tree')).toBeVisible();
  const target = key(page, 'doc:' + id);
  await expect(target).toBeVisible();
  await expect(target).toBeFocused();
  await expect(target).toHaveClass(/is-located/);
  const bounds = await target.boundingBox();
  const viewport = await page.locator('#map-scroll').boundingBox();
  expect(bounds.y).toBeGreaterThanOrEqual(viewport.y);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.y + viewport.height);
  if (notice) await expect(page.locator('#map-message')).toHaveText('Located in tree: ' + id);
}

test('a result path reveals collapsed ancestors and the exact duplicate document while preserving the reader', async ({ page }) => {
  await page.goto(app.url + '?doc=' + encodeURIComponent(readerId));
  await expect(page.locator('#document-title')).toHaveText('Reader — Design');
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 260; });
  await key(page, 'toggle:.').click();
  const before = await page.evaluate(() => ({ url: location.href, entries: history.length,
    scroll: document.getElementById('reader-scroll').scrollTop }));
  await page.getByRole('searchbox').fill('NeedleTwo');
  await expect(page.locator('.result-path-text')).toHaveText(targetId);
  await expect(locate(page, targetId)).toBeVisible();
  await expect(page.locator('.search-result button')).toHaveCount(0);
  await locate(page, targetId).click();
  await expectLocated(page, targetId);
  for (const group of ['.', 'docs/zz-area', 'docs/zz-area/sub']) {
    await expect(key(page, 'toggle:' + group)).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(key(page, 'doc:' + folder + '/one.md')).toBeVisible();
  await expect(page.locator('#document-title')).toHaveText('Reader — Design');
  await expect(page.locator('#document-source')).toBeVisible();
  expect(await page.evaluate(() => ({ url: location.href, entries: history.length,
    scroll: document.getElementById('reader-scroll').scrollTop }))).toEqual(before);
  await project.write(readerId, '# Reader — Design\n\n' + 'Keep reading this original document.\n\n'.repeat(90) + '\nUpdated reader tail.');
  await expect(page.locator('#document-source')).toContainText('Updated reader tail.');
  await expectLocated(page, targetId, { notice: false });
  expect(await page.evaluate(() => ({ url: location.href, entries: history.length,
    scroll: document.getElementById('reader-scroll').scrollTop }))).toEqual(before);
  await key(page, 'doc:' + targetId).click();
  await expect(page.locator('#document-content')).toContainText('NeedleTwo');
  await expect(key(page, 'doc:' + targetId)).not.toHaveClass(/is-located/);
  await page.goBack();
  await expect(page.locator('#document-title')).toHaveText('Reader — Design');
  await expect(page.locator('#document-source')).toBeVisible();
  await expect(key(page, 'doc:' + targetId)).toHaveClass(/is-located/);
  await expect(page.getByRole('searchbox')).toHaveValue('');
});

test('keyboard path activation reveals a root document and mobile keeps the map visible for a long path', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('searchbox').fill('RootOnlyToken');
  await expect(locate(page, 'DESIGN.md')).toBeVisible();
  await page.getByRole('searchbox').press('ArrowDown');
  await expect(page.locator('.search-result')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(locate(page, 'DESIGN.md')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectLocated(page, 'DESIGN.md');
  await page.getByRole('searchbox').fill('NeedleTwo');
  await expect(locate(page, targetId)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await locate(page, targetId).focus();
  await page.keyboard.press('Space');
  await expectLocated(page, targetId);
  await expect(page.getByRole('complementary', { name: 'Document map', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#reader-empty')).toBeAttached();
  expect(new URL(page.url()).searchParams.get('doc')).toBe(null);
});

test('clearing through a path cancels a pending search and a pending document open', async ({ page }) => {
  let documentRoute;
  let searchRoute;
  let documentStarted;
  let searchStarted;
  const opening = new Promise(resolve => { documentStarted = resolve; });
  const searching = new Promise(resolve => { searchStarted = resolve; });
  await page.route('**/api/document?*', async route => {
    documentRoute = route;
    documentStarted();
  });
  await page.route('**/api/search?*', async route => {
    if (new URL(route.request().url()).searchParams.get('q') === 'delayed') {
      searchRoute = route;
      searchStarted();
    } else await route.continue();
  });
  await page.getByRole('searchbox').fill('NeedleTwo');
  await page.locator('.search-result').click();
  await opening;
  await page.getByRole('searchbox').fill('delayed');
  await searching;
  await locate(page, targetId).click();
  await expectLocated(page, targetId);
  await documentRoute.continue().catch(() => {});
  await searchRoute.fulfill({ json: { sequence: 999, total: 0, results: [] } }).catch(() => {});
  await expect(page.locator('#document-view')).toBeHidden();
  await expect(page.locator('#search-view')).toBeHidden();
  await expect(key(page, 'doc:' + targetId)).toBeFocused();
});

test('refresh retains the path action focus, then returns focus to search after removal', async ({ page }) => {
  await page.getByRole('searchbox').fill('NeedleTwo');
  await locate(page, targetId).focus();
  await project.write(targetId, '# Same title\n\nNeedleTwo changed.');
  await expect(page.locator('.result-snippet')).toContainText('changed');
  await expect(locate(page, targetId)).toBeFocused();
  await fs.unlink(path.join(project.root, targetId));
  await expect(page.locator('#search-status')).toHaveText('No matching documents.');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('a removed result cannot reveal a different document before its search refresh arrives', async ({ page }) => {
  await page.getByRole('searchbox').fill('NeedleTwo');
  await expect(locate(page, targetId)).toBeVisible();
  // Hold refresh results so the old result remains available after the map updates.
  let delayed;
  await page.route('**/api/search?*', async route => { delayed = route; });
  await fs.unlink(path.join(project.root, targetId));
  await expect(page.locator('#map-count')).toContainText('29 documents');
  await expect.poll(() => Boolean(delayed)).toBe(true);
  await locate(page, targetId).click();
  await expect(page.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('#map-tree')).toBeVisible();
  await expect(page.locator('#map-message')).toContainText('no longer in the map');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('#document-view')).toBeHidden();
  await delayed.continue().catch(() => {});
});

test('an old path search reveals the current root document without changing the URL', async ({ page }) => {
  await project.write('docatlas.config.json', JSON.stringify({ version: 1, redirects: { 'docs/old-contract.md': 'DESIGN.md' } }));
  await page.getByRole('searchbox').fill('old-contract.md');
  await expect(locate(page, 'DESIGN.md')).toBeVisible();
  await locate(page, 'DESIGN.md').click();
  await expectLocated(page, 'DESIGN.md');
  expect(page.url()).toBe(app.url);
});
