import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../../src/server/index.js';
import { createReadingProject, READING_ID, READING_MARKDOWN } from '../helpers/reading.js';

let app;
let project;
const cleanups = [];

test.beforeAll(async () => {
  project = await createReadingProject({ after: fn => cleanups.push(fn) });
  for (let index = 0; index < 24; index++) {
    await project.write('docs/features/item-' + String(index).padStart(2, '0') + '/DESIGN.md',
      '# Feature ' + index + ' — Design\n\nA separate feature for navigation.\n');
  }
  app = await startServer({ root: project.root });
});
test.afterAll(async () => {
  if (app) await app.close();
  if (project) expect(await fs.readFile(path.join(project.root, READING_ID), 'utf8')).toBe(READING_MARKDOWN);
  for (const cleanup of cleanups) await cleanup();
});
test.beforeEach(async ({ page }) => { await page.goto(app.url); });

async function openDesign(page) {
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true })
    .getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-content h1')).toHaveText('Catalog — Design');
}

test('renders readable tables, code, task checks, images, and a heading outline', async ({ page }) => {
  await openDesign(page);
  await expect(page.locator('#document-content table')).toHaveCount(1);
  await expect(page.locator('#document-content table tr')).toHaveCount(3);
  await expect(page.locator('#document-content .code-language')).toHaveText('js');
  await expect(page.locator('#document-content pre code')).toContainText('console.log(document.title)');
  await expect(page.locator('#document-content input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('#document-content input[type="checkbox"]').first()).toBeChecked();
  await expect(page.locator('#document-content input[type="checkbox"]').first()).toBeDisabled();
  await expect(page.locator('#document-source')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'On this page', exact: true })).toBeVisible();
  await expect(page.locator('#document-content script')).toHaveCount(0);
  expect(await page.evaluate(() => window.untrustedDocumentRan)).toBeUndefined();
  const image = page.getByRole('img', { name: 'Build overview', exact: true });
  await expect.poll(() => image.evaluate(value => value.complete && value.naturalWidth > 0)).toBe(true);
  if (process.env.DOCMAP_READING_SCREENSHOT) {
    await page.screenshot({ path: process.env.DOCMAP_READING_SCREENSHOT, fullPage: true });
  }
});

test('outline navigation uses unique Unicode anchors', async ({ page }) => {
  await openDesign(page);
  const toc = page.getByRole('navigation', { name: 'On this page', exact: true });
  await toc.getByRole('link', { name: '한국어 사용법', exact: true }).nth(1).click();
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe('한국어-사용법-1');
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(500);
  await expect(page.locator('#heading-한국어-사용법-1')).toBeInViewport();
});

test('document links and browser back/forward restore the reader and map positions', async ({ page }) => {
  await openDesign(page);
  await expect.poll(() => page.getByRole('img', { name: 'Build overview', exact: true })
    .evaluate(value => value.complete)).toBe(true);
  const link = page.locator('#document-content').getByRole('link', { name: 'Read the filter design', exact: true });
  await link.scrollIntoViewIfNeeded();
  await page.locator('#map-scroll').evaluate(element => { element.scrollTop = 550; });
  const before = await page.evaluate(() => ({
    reader: document.getElementById('reader-scroll').scrollTop,
    map: document.getElementById('map-scroll').scrollTop
  }));
  await link.click();
  await expect(page.locator('#document-title')).toHaveText('Filters — Design');
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe('filter-behavior');
  await page.goBack();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect.poll(async () => Math.abs(await page.locator('#reader-scroll').evaluate(element => element.scrollTop) - before.reader)).toBeLessThan(3);
  await expect.poll(async () => Math.abs(await page.locator('#map-scroll').evaluate(element => element.scrollTop) - before.map)).toBeLessThan(3);
  await page.goForward();
  await expect(page.locator('#document-title')).toHaveText('Filters — Design');
});

test('read/source modes keep their own position and survive document history', async ({ page }) => {
  await openDesign(page);
  await expect.poll(() => page.getByRole('img', { name: 'Build overview', exact: true })
    .evaluate(value => value.complete)).toBe(true);
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 350; });
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await expect(page.locator('#document-source')).toBeVisible();
  await page.locator('#reader-scroll').evaluate(element => { element.scrollTop = 450; });
  await page.getByRole('button', { name: 'Read document', exact: true }).click();
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(350);
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(450);
  await page.getByRole('button', { name: 'Expand Catalog', exact: true }).click();
  await page.getByRole('button', { name: 'Show documents for Filters', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Filters', exact: true })
    .getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('Filters — Design');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Read document', exact: true })).toBeVisible();
  await expect(page.locator('#document-source')).toBeVisible();
  await expect.poll(() => page.locator('#reader-scroll').evaluate(element => element.scrollTop)).toBe(450);
});

test('code, unindexed, and missing references explain the target without leaving the document', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDesign(page);
  const article = page.locator('#document-content');
  const previousUrl = page.url();
  await article.getByRole('link', { name: 'Source module', exact: true }).click();
  await expect(page.locator('#link-path')).toHaveText('src/example.js#L2');
  await page.getByRole('button', { name: 'Copy path', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('src/example.js#L2');
  await article.getByRole('link', { name: 'Loose notes', exact: true }).click();
  await expect(page.locator('#link-message')).toContainText('outside the current collection');
  await article.getByRole('link', { name: 'Missing document', exact: true }).click();
  await expect(page.locator('#link-message')).toContainText('no longer exists');
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  expect(page.url()).toBe(previousUrl);
  const external = article.getByRole('link', { name: 'External reference', exact: true });
  await expect(external).toHaveAttribute('href', 'https://example.com/guide');
  await expect(external).toHaveAttribute('target', '_blank');
  await expect(external).toHaveAttribute('rel', 'noopener noreferrer');
});

test('Unicode and space links also work as direct document/anchor URLs', async ({ page }) => {
  await openDesign(page);
  await page.locator('#document-content').getByRole('link', { name: '한글 문서', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('사용 방법');
  expect(new URL(page.url()).searchParams.get('doc')).toBe('docs/guide/사용 방법.md');
  expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe('시작하기');
  await page.reload();
  await expect(page.locator('#document-content')).toContainText('원본 디렉터리를 기준으로 이동합니다.');
  await expect(page.locator('.document-button[aria-current="page"]')).toHaveText('사용 방법');
});

test('an image removed after rendering has a readable fallback', async ({ page }) => {
  await page.route('**/api/asset?*', route => route.fulfill({
    status: 404, contentType: 'application/json', body: '{"error":"Image removed"}'
  }));
  await openDesign(page);
  await expect(page.locator('#document-content')).toContainText('Image could not be loaded: Build overview');
  await expect(page.locator('#document-content')).toContainText('External images are not loaded');
  await expect(page.locator('#document-content img[src^="https:"]')).toHaveCount(0);
});

test('mobile reading keeps wide content inside the reader and offers a collapsible outline', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDesign(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.table-scroll').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await expect(page.locator('#toc-details')).not.toHaveAttribute('open');
  await page.locator('#toc-details summary').click();
  await page.getByRole('navigation', { name: 'On this page', exact: true })
    .getByRole('link', { name: 'Usage examples', exact: true }).click();
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe('usage-examples');
  await expect(page.locator('#heading-usage-examples')).toBeInViewport();
  await page.getByRole('button', { name: /Back to map/ }).click();
  await expect(page.getByRole('complementary', { name: 'Document map', exact: true })).toBeVisible();
});

test('a missing section keeps the current content and route', async ({ page }) => {
  await openDesign(page);
  await page.route('**/api/document?*', async route => {
    const response = await route.fetch();
    const result = await response.json();
    if (result.id === 'docs/catalog/filters/DESIGN.md') result.headings = [];
    await route.fulfill({ response, json: result });
  });
  const previousUrl = page.url();
  await page.locator('#document-content').getByRole('link', { name: 'Read the filter design', exact: true }).click();
  await expect(page.locator('#link-message')).toContainText('Section not found');
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  expect(page.url()).toBe(previousUrl);
});
