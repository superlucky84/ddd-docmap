import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject, ConfigurationError } from 'docatlas';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createProject } from './helpers/projects.js';

const config = redirects => JSON.stringify({ version: 1, redirects });

test('explicit redirects flatten missing paths and stubs into one canonical card and search result', async t => {
  const { root } = await createProject(t, {
    'ddd-docmap.config.json': config({ 'docs/old.md': 'docs/stub.md', 'docs/stub.md': 'docs/current.md' }),
    'docs/stub.md': '# Stub\n\nMoved elsewhere.',
    'docs/current.md': '# Current\n\nCanonical content.',
    'docs/unrelated.md': '# Unrelated\n\nMoved to current.md (ordinary prose).'
  });
  const scan = await scanProject(root);
  const { snapshot } = scan;
  assert.deepEqual(snapshot.redirects, [
    { source: 'docs/old.md', targetId: 'docs/current.md' },
    { source: 'docs/stub.md', targetId: 'docs/current.md' }
  ]);
  assert.equal(snapshot.documents.find(doc => doc.id === 'docs/stub.md').canonicalId, 'docs/current.md');
  assert.equal(snapshot.documents.find(doc => doc.id === 'docs/unrelated.md').canonicalId, null);
  assert.deepEqual(snapshot.groups.find(group => group.id === 'docs').documentIds, ['docs/current.md', 'docs/unrelated.md']);
  const results = searchDocuments(createSearchIndex(scan), 'old.md').results;
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'docs/current.md');
  assert.equal(results[0].matchedField, 'previous path');
  assert.ok(!JSON.stringify(snapshot).includes('Canonical content.\n'));
});

test('cycles, self references, missing targets, exclusions and symbolic sources warn without guessing', async t => {
  const redirects = {
    'docs/a.md': 'docs/b.md', 'docs/b.md': 'docs/a.md', 'docs/self.md': 'docs/self.md',
    'docs/missing.md': 'docs/absent.md', 'node_modules/docs/old.md': 'docs/good.md',
    'docs/ignored.md': 'docs/good.md', 'docs/link/old.md': 'docs/good.md'
  };
  const { root } = await createProject(t, {
    'ddd-docmap.config.json': config(redirects), '.gitignore': 'docs/ignored.md\n',
    'docs/a.md': '# A', 'docs/b.md': '# B', 'docs/self.md': '# Self', 'docs/good.md': '# Good'
  });
  const outside = await createProject(t);
  await fs.symlink(outside.root, path.join(root, 'docs/link'));
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.redirects, []);
  assert.equal(snapshot.warnings.filter(warning => warning.code === 'INVALID_REDIRECT').length, 7);
  assert.ok(snapshot.documents.every(doc => doc.canonicalId === null));
});

for (const redirects of [{ '../old.md': 'docs/a.md' }, { 'docs/a.md': '/out.md' },
  { 'docs/a.md': 42 }, { 'docs/a.md': 'docs/a.png' }, { 'docs/a.md': 'docs/b.md', 'docs/./a.md': 'docs/b.md' }]) {
  test('redirect schema rejects malformed paths and normalized duplicates: ' + JSON.stringify(redirects), async t => {
    const { root } = await createProject(t, { 'ddd-docmap.config.json': config(redirects) });
    await assert.rejects(collectProject(root), ConfigurationError);
  });
}
