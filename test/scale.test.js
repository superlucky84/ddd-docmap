import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createScaleProject } from './helpers/scale.js';
import { createProject } from './helpers/projects.js';

test('F-08 collects 300 long documents and searches every canonical group with bounded payloads', async t => {
  const project = await createScaleProject(t);
  const scan = await scanProject(project.root);
  assert.equal(scan.snapshot.documents.length, 300);
  assert.equal(scan.snapshot.groups.filter(group => group.documentIds.length).length, 75);
  assert.deepEqual(scan.snapshot.warnings, []);
  assert.ok(project.documentBytes > 300 * 16 * 1024);
  const index = createSearchIndex(scan);
  assert.equal(searchDocuments(index, 'uniqueToken74').total, 4);
  assert.equal(searchDocuments(index, '검색바늘').total, 300);
  assert.equal(searchDocuments(index, '검색바늘').results.length, 50);
  assert.equal(searchDocuments(index, '공통 기능').total, 8);
  assert.ok(Buffer.byteLength(JSON.stringify(scan.snapshot)) < 300 * 1800);
});

test('generation reuse still notices changed bytes with identical size and mtime and applies new policies', async t => {
  const id = 'docs/DESIGN.md';
  const { root, write } = await createProject(t, { [id]: '# Before\n\nFirst token.', 'docs/keep.md': '# Keep' });
  const original = await fs.stat(path.join(root, id));
  const first = await scanProject(root);
  await write(id, '# After!\n\nFresh token.');
  await fs.utimes(path.join(root, id), original.atime, original.mtime);
  assert.equal((await fs.stat(path.join(root, id))).size, original.size);
  const second = await scanProject(root, { previous: first });
  assert.equal(second.snapshot.documents.find(doc => doc.id === id).title, 'After!');
  assert.equal(searchDocuments(createSearchIndex(second), 'Fresh').total, 1);
  assert.equal(searchDocuments(createSearchIndex(second), 'First').total, 0);
  await write('ddd-docmap.config.json', JSON.stringify({ version: 1, exclude: [id] }));
  const excluded = await scanProject(root, { previous: second });
  assert.equal(searchDocuments(createSearchIndex(excluded), 'Fresh').total, 0);
  assert.equal(excluded.contents.has(id), false);
  await write(id, '# Latest\n\nReincluded token.');
  await write('ddd-docmap.config.json', '{"version":1}');
  const restored = await scanProject(root, { previous: excluded });
  assert.equal(restored.snapshot.documents.find(doc => doc.id === id).title, 'Latest');
  assert.equal(searchDocuments(createSearchIndex(restored), 'Reincluded').total, 1);
});
