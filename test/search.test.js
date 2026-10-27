import test from 'node:test';
import assert from 'node:assert/strict';
import { scanProject } from '../src/collector/scan.js';
import { createSearchIndex, searchDocuments } from '../src/collector/search.js';
import { createProject } from './helpers/projects.js';

async function search(t, files) {
  const { root } = await createProject(t, files);
  return createSearchIndex(await scanProject(root));
}

test('search combines fields with AND, prioritizes metadata, and normalizes Korean and case', async t => {
  const index = await search(t, {
    'docs/a/DESIGN.md': '# 결제 — Design\n\nPayment gateway.\n\n~~~js\nconst refundToken = true;\n~~~',
    'docs/b/DESIGN.md': '# Notes\n\nPayment gateway in the body with 결제.',
    'docs/c/DESIGN.md': '# Other\n\nA separate document.'
  });
  assert.deepEqual(searchDocuments(index, 'PAYMENT 결제').results.map(row => row.id), ['docs/a/DESIGN.md', 'docs/b/DESIGN.md']);
  assert.equal(searchDocuments(index, '결제'.normalize('NFD')).total, 2);
  const code = searchDocuments(index, 'refundtoken').results[0];
  assert.equal(code.matchedField, 'body');
  assert.match(code.snippet, /refundToken/);
  assert.equal(searchDocuments(index, 'payment absent').total, 0);
  assert.equal(searchDocuments(index, '   ').total, 0);
  assert.equal(searchDocuments(index, 'docs/c').results[0].title, 'Other');
});

test('search caps result payloads and uses stable path order for equal scores', async t => {
  const files = Object.fromEntries(Array.from({ length: 55 }, (_, index) =>
    ['docs/item-' + String(index).padStart(2, '0') + '.md', '# Shared title\n\n' + 'context '.repeat(80) + 'needle end.']));
  const index = await search(t, files);
  const result = searchDocuments(index, 'needle');
  assert.equal(result.total, 55);
  assert.equal(result.results.length, 50);
  assert.equal(result.results[0].id, 'docs/item-00.md');
  assert.ok(result.results.every(row => row.snippet.length <= 162 && !('markdown' in row)));
});
