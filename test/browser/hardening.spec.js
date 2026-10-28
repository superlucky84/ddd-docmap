import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startServer } from '../../src/server/index.js';
import { createProject } from '../helpers/projects.js';

let project;
let app;
let cleanups;
const folder = 'docs/' + '긴 한글 경로 '.repeat(6).trim() + '/공통 기능';
const table = '| Name | Long content |\n| --- | --- |\n' + Array.from({ length: 120 }, (_, i) => '| row-' + i + ' | ' + 'very-long-cell-'.repeat(15) + ' |').join('\n');

test.beforeEach(async ({ page }) => {
  cleanups = [];
  project = await createProject({ after: fn => cleanups.push(fn) }, {
    [folder + '/one.md']: '# Same title\n\nFirst distinct document.\n\n' + table,
    [folder + '/two.md']: '# Same title\n\nSecond distinct document.',
    'docs/notes/README.md': '# Notes\n\nUnrelated document.'
  });
  app = await startServer({ root: project.root });
  await page.goto(app.url);
  await expect(page.locator('#live-status')).toHaveText('Live updates');
});
test.afterEach(async () => { await app.close(); for (const cleanup of cleanups) await cleanup(); });

test('duplicate titles in a long Korean path remain distinct through keyboard navigation', async ({ page }) => {
  const card = page.getByRole('button', { name: 'Show documents for Same title', exact: true });
  // Reveal the structural ancestors with native keyboard controls.
  const hiddenToggle = page.locator('.chevron[aria-expanded="false"]').first();
  if (await hiddenToggle.count()) { await hiddenToggle.focus(); await page.keyboard.press('Enter'); }
  await card.focus();
  await page.keyboard.press('Enter');
  const first = page.getByRole('button', { name: 'Same title — ' + folder + '/one.md', exact: true });
  const second = page.getByRole('button', { name: 'Same title — ' + folder + '/two.md', exact: true });
  await first.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#document-content')).toContainText('First distinct document');
  await second.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#document-content')).toContainText('Second distinct document');
  await expect(page.locator('#document-path')).toHaveText(folder + '/two.md');
  await expect(second).toHaveAttribute('aria-current', 'page');
});

test('a 120-row wide table and long path stay inside a narrow reader', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(app.url + '?doc=' + encodeURIComponent(folder + '/one.md'));
  await expect(page.locator('#document-content tbody tr')).toHaveCount(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const table = page.locator('.table-scroll');
  await expect(table).toHaveCount(1);
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Back to map' }).click();
  await expect(page.getByRole('searchbox')).toBeVisible();
});

test('focused search results survive refresh and return focus to search when removed', async ({ page }) => {
  await page.getByRole('searchbox').fill('Same title');
  await expect(page.locator('#search-status')).toHaveText('2 documents');
  const first = page.locator('.search-result').first();
  const id = await first.getAttribute('data-document-id');
  await first.focus();
  await project.write('docs/addition.md', '# Unrelated addition');
  await expect(page.locator('#map-count')).toContainText('4 documents');
  await expect(page.locator('.search-result[data-document-id="' + id + '"]')).toBeFocused();
  await fs.unlink(path.join(project.root, id));
  await expect(page.locator('#search-status')).toHaveText('1 document');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

test('a temporary map refresh failure retries without needing another file save', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/map', async route => {
    if (++requests === 1) await route.fulfill({ status: 503, json: { error: 'temporary failure' } });
    else await route.continue();
  });
  await project.write('docs/retry.md', '# Recovered update');
  await expect(page.locator('#live-status')).toContainText('Updates paused:');
  await expect(page.locator('#map-count')).toContainText('4 documents');
  expect(requests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#live-status')).toHaveText('Live updates');
});
