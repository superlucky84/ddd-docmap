import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject, ProjectError } from '@superlucky84/ddd-docmap';
import { BASIC_DOCUMENTS, BASIC_FILES, createBasicProject, createProject } from './helpers/projects.js';

test('F-01: discovers exactly eight documents and excludes dependencies and output', async t => {
  const { root } = await createBasicProject(t);
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(document => document.id), BASIC_DOCUMENTS);
  assert.deepEqual(snapshot.warnings, []);
  assert.ok(snapshot.documents.every(document => !Object.hasOwn(document, 'body')));
});

test('F-01: a parent has its own four documents and an independent child group', async t => {
  const { root } = await createBasicProject(t);
  const { groups } = await collectProject(root);
  const catalog = groups.find(group => group.id === 'docs/catalog');
  assert.equal(catalog.title, 'Catalog');
  assert.equal(catalog.summary, 'Browse available content.');
  assert.deepEqual(catalog.documentIds, [
    'docs/catalog/REQUIREMENTS.md', 'docs/catalog/DESIGN.md',
    'docs/catalog/IMPLEMENT.md', 'docs/catalog/MANUAL_TEST_CHECKLIST.md'
  ]);
  assert.deepEqual(catalog.childIds, ['docs/catalog/filters']);
  assert.equal(groups.find(group => group.id === 'docs/catalog/filters').parentId, catalog.id);
  assert.equal(groups.find(group => group.id === 'docs').isStructural, true);
  assert.equal(groups.find(group => group.id === 'docs/shared').title, 'Shared contracts');
});

test('README is the group representative while document buttons keep standard ordering', async t => {
  const { root } = await createProject(t, {
    'docs/feature/README.md': '# Feature overview\n\nOverview first.\n',
    'docs/feature/REQUIREMENTS.md': '# Different requirements title\n\nRequirements summary.\n'
  });
  const group = (await collectProject(root)).groups.find(group => group.id === 'docs/feature');
  assert.equal(group.title, 'Feature overview');
  assert.equal(group.summary, 'Overview first.');
  assert.deepEqual(group.documentIds, ['docs/feature/REQUIREMENTS.md', 'docs/feature/README.md']);
});

test('F-02: Unicode, spaces, duplicate folder names, hidden paths, and file case remain distinct', async t => {
  const { root } = await createProject(t, {
    'docs/한글 폴더/Design.MD': '# 한글 기능 — 설계\n\n동작을 설명합니다.\n',
    'docs/first/shared/README.md': '# First shared\n',
    'docs/second/shared/README.md': '# Second shared\n',
    'docs/.hidden/notes.md': 'Hidden documentation.\n',
    'src/helper/requirements.MD': '# Outside docs\n'
  });
  const snapshot = await collectProject(root);
  assert.equal(snapshot.documents.length, 5);
  assert.equal(snapshot.documents.find(document => document.id.includes('한글')).kind, 'design');
  assert.ok(snapshot.groups.some(group => group.id === 'docs/first/shared'));
  assert.ok(snapshot.groups.some(group => group.id === 'docs/second/shared'));
  assert.ok(snapshot.documents.some(document => document.id.startsWith('src/')));
});

test('missing H1 uses a filename for the document and folder name for its group', async t => {
  const { root } = await createProject(t, { 'docs/example/DESIGN.md': 'Useful description.\n' });
  const snapshot = await collectProject(root);
  assert.equal(snapshot.documents[0].title, 'DESIGN.md');
  assert.equal(snapshot.groups.find(group => group.id === 'docs/example').title, 'example');
});

test('root-level standard documents belong to the project group', async t => {
  const { root } = await createProject(t, { 'REQUIREMENTS.md': '# Root requirements\n' });
  const snapshot = await collectProject(root);
  assert.equal(snapshot.documents[0].groupId, '.');
  assert.equal(snapshot.groups[0].parentId, null);
  assert.equal(snapshot.groups[0].isStructural, false);
});

test('F-03: an empty project is a valid empty snapshot', async t => {
  const { root } = await createProject(t);
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents, []);
  assert.equal(snapshot.groups.length, 1);
  assert.deepEqual(snapshot.groups[0].documentIds, []);
  assert.deepEqual(snapshot.warnings, []);
});

test('snapshots are repeatable and body-only changes update revision', async t => {
  const { root, write } = await createProject(t, { 'docs/example.md': '# Example\n\nDescription.\n' });
  const first = await collectProject(root);
  assert.deepEqual(await collectProject(root), first);
  await write('docs/example.md', '# Example\n\nDescription.\n\nAdditional behavior.\n');
  const changed = await collectProject(root);
  assert.equal(changed.documents[0].summary, first.documents[0].summary);
  assert.notEqual(changed.documents[0].contentHash, first.documents[0].contentHash);
  assert.notEqual(changed.revision, first.revision);
});

test('nested ignore negation can restore a file, but not a file below an ignored parent', async t => {
  const { root } = await createProject(t, {
    '.gitignore': '*.md\nblocked/\n!blocked/keep.md\n',
    'docs/.gitignore': '!keep.md\n',
    'docs/keep.md': '# Kept\n',
    'docs/hidden.md': '# Hidden\n',
    'blocked/keep.md': '# Must stay ignored\n',
    'blocked/.gitignore': '!keep.md\n'
  });
  assert.deepEqual((await collectProject(root)).documents.map(document => document.id), ['docs/keep.md']);
});

test('gitignore rules are case-sensitive even though discovery globs are not', async t => {
  const { root } = await createProject(t, {
    '.gitignore': 'docs/hidden.md\n',
    'docs/HIDDEN.MD': '# Visible\n'
  });
  assert.equal((await collectProject(root)).documents.length, 1);
});

test('F-03: symbolic document and directory links are skipped; a root alias has the same identity', async t => {
  const { root } = await createProject(t, { 'docs/DESIGN.md': '# Local design\n' });
  const outside = await createProject(t, { 'DESIGN.md': '# Outside\n' });
  await fs.symlink(path.join(outside.root, 'DESIGN.md'), path.join(root, 'docs', 'linked.md'));
  await fs.symlink(outside.root, path.join(root, 'linked-directory'), 'dir');
  const alias = path.join(outside.root, 'root-alias');
  await fs.symlink(root, alias, 'dir');
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(document => document.id), ['docs/DESIGN.md']);
  assert.equal(snapshot.warnings.filter(warning => warning.code === 'SYMLINK_SKIPPED').length, 2);
  assert.deepEqual(await collectProject(alias), snapshot);
});

test('a failed document read leaves healthy documents and reports its relative path', async t => {
  const { root } = await createProject(t, {
    'docs/fail.md': '# Unreadable\n',
    'docs/healthy.md': '# Healthy\n'
  });
  const original = fs.readFile;
  t.mock.method(fs, 'readFile', async (filename, ...args) => {
    if (filename === path.join(root, 'docs', 'fail.md')) {
      throw Object.assign(new Error('simulated denial'), { code: 'EACCES' });
    }
    return original(filename, ...args);
  });
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(document => document.id), ['docs/healthy.md']);
  assert.equal(snapshot.warnings[0].code, 'DOCUMENT_READ_FAILED');
  assert.equal(snapshot.warnings[0].path, 'docs/fail.md');
});

test('unreadable ignore rules stop only their subtree', async t => {
  const { root } = await createProject(t, {
    'docs/healthy.md': '# Healthy\n',
    'docs/private/.gitignore': '*.md\n',
    'docs/private/secret.md': '# Not exposed\n'
  });
  const original = fs.readFile;
  t.mock.method(fs, 'readFile', async (filename, ...args) => {
    if (filename === path.join(root, 'docs', 'private', '.gitignore')) {
      throw Object.assign(new Error('simulated denial'), { code: 'EACCES' });
    }
    return original(filename, ...args);
  });
  const snapshot = await collectProject(root);
  assert.deepEqual(snapshot.documents.map(document => document.id), ['docs/healthy.md']);
  assert.equal(snapshot.warnings[0].code, 'IGNORE_READ_FAILED');
});

test('F-03: missing and non-directory roots fail with a project error', async t => {
  const { root } = await createProject(t, { 'file.md': '# File\n' });
  await assert.rejects(collectProject(path.join(root, 'missing')), ProjectError);
  await assert.rejects(collectProject(path.join(root, 'file.md')), ProjectError);
  await assert.rejects(collectProject(''), ProjectError);
});

test('collection preserves every original file and does not execute project configuration', async t => {
  const files = { ...BASIC_FILES, 'ddd-docmap.config.js': 'throw new Error("must not execute");\n' };
  const { root } = await createProject(t, files);
  await collectProject(root);
  for (const [relative, content] of Object.entries(files)) {
    assert.equal(await fs.readFile(path.join(root, relative), 'utf8'), content);
  }
});
