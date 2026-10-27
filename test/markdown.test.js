import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMetadata, groupTitle } from '../src/collector/markdown.js';

const tick = String.fromCharCode(96);

test('extracts a real H1 and narrative while skipping front matter, code, references, and tables', () => {
  const markdown = [
    '---', 'title: not the heading', '---', '',
    '> Reference only.', '',
    '~~~md', '# Fake heading', '~~~', '',
    '# **Catalog** and ' + tick + 'filters' + tick + ' — Design', '',
    '문서 기준: 2026-10-27.', '',
    '[Requirements](./REQUIREMENTS.md) · [Implementation](./IMPLEMENT.md)', '',
    '| Name | Meaning |', '| --- | --- |', '| a | b |', '',
    'Browse **available** content with [filters](./filters/DESIGN.md).'
  ].join('\n');
  const result = extractMetadata(markdown, 'DESIGN.md');
  assert.equal(result.title, 'Catalog and filters — Design');
  assert.equal(result.summary, 'Browse available content with filters.');
  assert.equal(groupTitle(result.title), 'Catalog and filters');
});

test('metadata-only documents have no invented summary', () => {
  const result = extractMetadata('# Design\n\nUpdated: today\n\n[Reference](./README.md)\n', 'DESIGN.md');
  assert.equal(result.summary, '');
});

test('an empty document falls back to filename with no heading', () => {
  const result = extractMetadata('', 'notes.md');
  assert.equal(result.title, 'notes.md');
  assert.equal(result.headingTitle, '');
  assert.equal(result.summary, '');
});

test('setext H1, inline HTML, and code spans produce text without executing HTML', () => {
  const result = extractMetadata('A <span>feature</span> with ' + tick + 'code' + tick + '\n===\n\nReadable paragraph.\n', 'README.md');
  assert.equal(result.title, 'A feature with code');
  assert.equal(result.summary, 'Readable paragraph.');
});

test('document suffix cleanup respects word boundaries and supports Korean labels', () => {
  assert.equal(groupTitle('Catalog — Requirements'), 'Catalog');
  assert.equal(groupTitle('내 서재 - 수동 테스트 체크리스트'), '내 서재');
  assert.equal(groupTitle('Redesign'), 'Redesign');
  assert.equal(groupTitle('설계'), '');
});
