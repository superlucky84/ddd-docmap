import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { collectProject } from 'docatlas';

const repository = fileURLToPath(new URL('../', import.meta.url));
const example = fileURLToPath(new URL('../examples/sample-shop/', import.meta.url));

function group(snapshot, id) {
  const found = snapshot.groups.find(candidate => candidate.id === id);
  assert.ok(found, 'Missing group ' + id);
  return found;
}

test('the sample shop shows a full checkout set beside partial and nested features', async () => {
  const snapshot = await collectProject(example);
  assert.equal(snapshot.warnings.length, 0);
  assert.equal(snapshot.documents.length, 21);

  const checkout = group(snapshot, 'docs/checkout');
  assert.equal(checkout.title, 'Checkout');
  assert.deepEqual(checkout.documentIds, ['REQUIREMENTS', 'DESIGN', 'IMPLEMENT', 'MANUAL_TEST_CHECKLIST']
    .map(name => 'docs/checkout/' + name + '.md'));
  assert.deepEqual(checkout.childIds, ['docs/checkout/payments', 'docs/checkout/shipping']);

  assert.equal(group(snapshot, 'docs/checkout/shipping').documentIds.length, 1);
  assert.equal(group(snapshot, 'docs/shared').title, 'Shared contracts');
  assert.equal(group(snapshot, 'services/notifications/docs').title, 'Notifications');
  assert.equal(group(snapshot, 'web/account/docs').title, 'Account');
});

test('the repository map keeps its planning documents and leaves the example out', async () => {
  const snapshot = await collectProject(repository);
  const ids = snapshot.documents.map(document => document.id);
  assert.equal(snapshot.warnings.length, 0);
  assert.ok(ids.includes('docs/REQUIREMENTS.md'));
  assert.ok(ids.every(id => id.startsWith('docs/')), ids.join(', '));
});
