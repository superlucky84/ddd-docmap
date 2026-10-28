// Recreates the README screenshot from a synthetic sample project.
// Usage: node scripts/screenshot.js [--project <empty dir>] [--out <png>] [--executable-path <browser>]
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/server/index.js';

const repository = fileURLToPath(new URL('../', import.meta.url));
const tick = '`';

const CHECKOUT_DESIGN = `# Checkout — Design

One-page checkout built on the shared cart and payments contracts.

## Decision checklist

- [x] DC-1: Guest checkout uses a signed session cookie. Chosen over email links for fewer steps. Validated by M-1.
- [x] DC-2: Taxes come from the pricing service at lock time. Validated by M-2.
- [ ] DC-3: Retry policy for payment timeouts — **TBD**.

## Contracts

| Call | Owner | Notes |
| --- | --- | --- |
| ${tick}POST /cart/lock${tick} | cart | Returns ${tick}lockId${tick} and expiry |
| ${tick}POST /payments/intent${tick} | payments | See [payments design](./payments/DESIGN.md) |
| ${tick}POST /orders${tick} | checkout | Idempotent on ${tick}lockId${tick} |

## Flow

1. The cart service locks prices for 15 minutes.
2. The page collects address and shipping, then asks payments for an intent.
3. Confirmation clears the cart only after payments reports success.

## Error handling

${tick.repeat(3)}js
if (result.status === 'declined') {
  return keepCart({ lockId, address });
}
${tick.repeat(3)}
`;

const FILES = {
  'docs/checkout/REQUIREMENTS.md': `# Checkout — Requirements

Let signed-in and guest shoppers pay for a cart in one page.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| RQ-1 | Guests can check out without an account. | M-1 |
| RQ-2 | Totals show tax and shipping before payment. | M-2 |
| RQ-3 | A failed payment keeps the cart and the entered address. | M-3 |

Non-goals: saved payment methods, gift cards.
`,
  'docs/checkout/DESIGN.md': CHECKOUT_DESIGN,
  'docs/checkout/IMPLEMENT.md': `# Checkout — Implementation plan

Phases with baseline tests and exit criteria.

- [x] Phase 1 — Cart lock and totals
- [x] Phase 2 — Guest session
- [ ] Phase 3 — Payment intent
- [ ] Phase 4 — Test Hardening
- [ ] Phase 5 — Integration Test

## Handoff

- Done: Phases 1–2. Next: Phase 3. Blockers: DC-3. Latest commit: 4f2c1ab.
`,
  'docs/checkout/MANUAL_TEST_CHECKLIST.md': `# Checkout — Manual checks

Release-facing checks with pass/fail criteria.

- [ ] M-1: A guest completes an order without signing in.
- [ ] M-2: Tax and shipping appear before the pay button.
- [ ] M-3: A declined card keeps the cart and address.
`,
  'docs/checkout/payments/REQUIREMENTS.md': '# Payments — Requirements\n\nCard and wallet payments for checkout.\n',
  'docs/checkout/payments/DESIGN.md': '# Payments — Design\n\nPayment intents, webhooks, and idempotency keys.\n',
  'docs/checkout/payments/IMPLEMENT.md': '# Payments — Implementation plan\n\nProvider adapter first, then webhooks.\n',
  'docs/checkout/shipping/DESIGN.md': '# Shipping — Design\n\nRates by weight and region, cached per cart lock.\n',
  'docs/catalog/REQUIREMENTS.md': '# Catalog — Requirements\n\nBrowse products by category with stock and price.\n',
  'docs/catalog/DESIGN.md': '# Catalog — Design\n\nRead models built from the product service events.\n',
  'docs/catalog/IMPLEMENT.md': '# Catalog — Implementation plan\n\nCategory pages, then product detail.\n',
  'docs/catalog/MANUAL_TEST_CHECKLIST.md': '# Catalog — Manual checks\n\nCategory browsing and stock display.\n',
  'docs/catalog/search/DESIGN.md': '# Search — Design\n\nFull-text product search with typo tolerance.\n',
  'docs/catalog/search/IMPLEMENT.md': '# Search — Implementation plan\n\nIndexer, query API, then ranking.\n',
  'docs/shared/README.md': '# Shared contracts\n\nCart, pricing, and order contracts used by several features.\n',
  'docs/shared/CONTRACTS.md': '# Cart and order contracts\n\nRequest and response shapes shared across services.\n',
  'services/notifications/docs/REQUIREMENTS.md': '# Notifications — Requirements\n\nOrder emails and delivery updates.\n',
  'services/notifications/docs/DESIGN.md': '# Notifications — Design\n\nQueue consumers with per-channel templates.\n',
  'services/notifications/docs/IMPLEMENT.md': '# Notifications — Implementation plan\n\nEmail first, then SMS.\n',
  'web/account/docs/REQUIREMENTS.md': '# Account — Requirements\n\nOrder history and saved addresses.\n',
  'web/account/docs/DESIGN.md': '# Account — Design\n\nPages reuse the order contract.\n'
};

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    out: { type: 'string', default: path.join(repository, '.github/assets/document-map.png') },
    'executable-path': { type: 'string' }
  }
});

async function createSampleProject(directory) {
  const existing = await fs.readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (existing.length) {
    throw new Error('Choose an empty or missing --project directory: ' + directory);
  }
  for (const [relative, content] of Object.entries(FILES)) {
    const filename = path.join(directory, relative);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, content);
  }
}

const temporary = values.project ? null : await fs.mkdtemp(path.join(os.tmpdir(), 'docatlas-screenshot-'));
const project = path.resolve(values.project || path.join(temporary, 'sample-shop'));
let app;
let browser;
try {
  await createSampleProject(project);
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
