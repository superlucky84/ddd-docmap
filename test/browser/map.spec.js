import { test, expect } from '@playwright/test';
import { startServer } from '../../src/server/index.js';
import { createBasicProject, createProject } from '../helpers/projects.js';

let app;
const cleanups = [];

test.beforeAll(async () => {
  const project = await createBasicProject({ after: fn => cleanups.push(fn) });
  await project.write('docs/catalog/DESIGN.md',
    '# Catalog — Design\n\nCatalog architecture.\n\n<script>window.untrustedDocumentRan = true;</script>\n');
  app = await startServer({ root: project.root });
});

test.afterAll(async () => {
  if (app) await app.close();
  for (const cleanup of cleanups) await cleanup();
});

test.beforeEach(async ({ page }) => { await page.goto(app.url); });

test('cards reveal their four documents and render raw HTML as text', async ({ page }) => {
  await expect(page.locator('#map-count')).toHaveText('5 features · 8 documents');
  await expect(page.getByRole('button', { name: 'Show documents for Filters', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  const documents = page.getByRole('group', { name: 'Documents for Catalog', exact: true });
  await expect(documents.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Show documents for Filters', exact: true })).toBeHidden();
  await documents.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect(page.locator('#document-content')).toContainText('<script>');
  expect(await page.evaluate(() => window.untrustedDocumentRan)).toBeUndefined();
  await expect(page.locator('.source-label')).toHaveText('Reading');
  await page.getByRole('button', { name: 'View source', exact: true }).click();
  await expect(page.locator('#document-source')).toBeVisible();
  await expect(page.locator('#document-source')).toContainText('<script>');
  await page.getByRole('button', { name: 'Read document', exact: true }).click();
  await expect(page.locator('#document-content')).toBeVisible();
  if (process.env.DOCMAP_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.DOCMAP_SCREENSHOT_PATH, fullPage: true });
  }
});

test('hierarchy and document controls work independently with the keyboard', async ({ page }) => {
  const toggle = page.getByRole('button', { name: 'Expand Catalog', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Show documents for Filters', exact: true })).toBeVisible();
  const main = page.getByRole('button', { name: 'Show documents for Catalog', exact: true });
  await main.focus();
  await page.keyboard.press('Enter');
  const design = page.getByRole('group', { name: 'Documents for Catalog', exact: true })
    .getByRole('button', { name: 'Design', exact: true });
  await design.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#document-content')).toContainText('Catalog architecture');
  await page.getByRole('button', { name: 'Collapse Catalog', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Show documents for Filters', exact: true })).toBeHidden();
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
});

test('a narrow screen switches to the reader and returns to the selected map', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  await page.getByRole('group', { name: 'Documents for Catalog', exact: true })
    .getByRole('button', { name: 'Requirements', exact: true }).click();
  await expect(page.locator('#document-content')).toContainText('Browse available content');
  await expect(page.getByRole('complementary', { name: 'Document map', exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to map' }).click();
  await expect(page.getByRole('complementary', { name: 'Document map', exact: true })).toBeVisible();
  await expect(page.locator('.document-button[aria-current="page"]')).toHaveText('Requirements');
});

test('a missing document is explained and another document can still be opened', async ({ page }) => {
  await page.route('**/api/document?*', async route => {
    const id = new URL(route.request().url()).searchParams.get('id');
    if (id === 'docs/catalog/DESIGN.md') {
      await route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ error: 'This document no longer exists.' }) });
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  const documents = page.getByRole('group', { name: 'Documents for Catalog', exact: true });
  await documents.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-status')).toHaveText('This document no longer exists.');
  await documents.getByRole('button', { name: 'Requirements', exact: true }).click();
  await expect(page.locator('#document-content')).toContainText('Browse available content');
});

test('empty projects explain how to add documentation', async ({ page }) => {
  const localCleanups = [];
  const project = await createProject({ after: fn => localCleanups.push(fn) });
  const empty = await startServer({ root: project.root });
  try {
    await page.goto(empty.url);
    await expect(page.locator('#map-count')).toHaveText('0 features · 0 documents');
    await expect(page.locator('#map-message')).toContainText('No documentation found');
  } finally {
    await empty.close();
    for (const cleanup of localCleanups) await cleanup();
  }
});

test('a quick second selection stays selected when the first request is delayed', async ({ page }) => {
  let delayed;
  let resolveFirst;
  const first = new Promise(resolve => { resolveFirst = resolve; });
  await page.route('**/api/document?*', async route => {
    if (new URL(route.request().url()).searchParams.get('id') === 'docs/catalog/REQUIREMENTS.md') {
      delayed = route;
      resolveFirst();
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Show documents for Catalog', exact: true }).click();
  const documents = page.getByRole('group', { name: 'Documents for Catalog', exact: true });
  await documents.getByRole('button', { name: 'Requirements', exact: true }).click();
  await first;
  await documents.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('#document-content')).toContainText('Catalog architecture');
  await delayed.fulfill({ contentType: 'application/json', body: JSON.stringify({
    markdown: 'Stale content'
  }) }).catch(() => {});
  await expect(page.locator('#document-title')).toHaveText('Catalog — Design');
  await expect(page.locator('#document-content')).not.toContainText('Stale content');
});

test('long Korean titles stay compact and additional documents remain distinguishable', async ({ page }) => {
  const localCleanups = [];
  const title = '길이가 긴 기능 이름 '.repeat(12).trim();
  const project = await createProject({ after: fn => localCleanups.push(fn) }, {
    'docs/한글 기능/REQUIREMENTS.md': '# ' + title + ' — Requirements\n\n' + '설명 문장 '.repeat(30),
    'docs/한글 기능/notes.md': '# 검토 메모\n\n메모 내용입니다.\n',
    'docs/한글 기능/decisions.md': '# 설계 결정\n\n결정 내용입니다.\n'
  });
  const local = await startServer({ root: project.root });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(local.url);
    const card = page.getByRole('button', { name: 'Show documents for ' + title, exact: true });
    await expect(card).toBeVisible();
    expect((await card.locator('.card-title').boundingBox()).height).toBeLessThan(25);
    await card.click();
    await expect(page.getByRole('button', { name: /검토 메모/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /설계 결정/ })).toBeVisible();
    await page.getByRole('button', { name: /검토 메모/ }).click();
    await expect(page.locator('#document-content')).toContainText('메모 내용입니다.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await local.close();
    for (const cleanup of localCleanups) await cleanup();
  }
});
