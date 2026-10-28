import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { collectProject, CollectionOptionsError } from 'docatlas';
import { BASIC_DOCUMENTS, createBasicProject, createProject } from './helpers/projects.js';

const ids = snapshot => snapshot.documents.map(document => document.id);

test('additional directories preserve defaults and treat repeated, Unicode and glob-like paths literally', async t => {
  const project = await createBasicProject(t);
  const added = ['documentation/intro.md', 'documentation/nested/notes.MD', '팀 문서[2026]/소개.md'];
  for (const id of [...added, 'documentation-other/hidden.md', '팀 문서2/hidden.md']) await project.write(id, '# Extra');
  assert.deepEqual(ids(await collectProject(project.root)), BASIC_DOCUMENTS);
  const options = { docsDirs: ['./documentation/', 'documentation', '팀 문서[2026]'] };
  const snapshot = await collectProject(project.root, options);
  assert.deepEqual(ids(snapshot), [...BASIC_DOCUMENTS, ...added].sort());
  assert.deepEqual(snapshot.warnings, []);
  assert.deepEqual(options.docsDirs, ['./documentation/', 'documentation', '팀 문서[2026]']);
});

test('additional directories union with configured include instead of restoring default includes', async t => {
  const { root } = await createProject(t, {
    'docatlas.config.json': '{"version":1,"include":["notes/**/*.md"]}',
    'notes/idea.md': '# Idea', 'documentation/guide.md': '# Guide', 'docs/DESIGN.md': '# Default'
  });
  assert.deepEqual(ids(await collectProject(root, { docsDirs: ['documentation'] })), ['documentation/guide.md', 'notes/idea.md']);
});

test('all Markdown overrides include while protected, ignored and default output paths remain excluded', async t => {
  const files = {
    'docatlas.config.json': '{"version":1,"include":["docs/**/*.md"]}',
    '.gitignore': 'notes/private/\n', 'README.md': '# Root', 'notes/IDEA.md': '# Idea',
    'docs/DESIGN.md': '# Design', 'notes/private/secret.md': '# Excluded by ignore',
    'node_modules/pkg/docs/hidden.md': '# Dependency', 'vendor/Node_Modules/pkg/docs/hidden.md': '# Nested dependency',
    '.git/docs/hidden.md': '# Git'
  };
  const outputIds = ['dist', 'build', 'coverage', '.docatlas', '.ddd-docmap'].map(dir => dir + '/docs/hidden.md');
  for (const id of outputIds) files[id] = '# Output';
  const project = await createProject(t, files);
  const expected = ['README.md', 'docs/DESIGN.md', 'notes/IDEA.md'];
  assert.deepEqual(ids(await collectProject(project.root)), ['docs/DESIGN.md']);
  const snapshot = await collectProject(project.root, { allMarkdown: true, docsDirs: ['node_modules'] });
  assert.deepEqual(ids(snapshot), expected);
  assert.ok(snapshot.warnings.some(warning => warning.code === 'DOCS_DIR_SKIPPED' && warning.path === 'node_modules'));
  await project.write('docatlas.config.json', '{"version":1,"include":[],"exclude":[]}');
  assert.deepEqual(ids(await collectProject(project.root, { allMarkdown: true })), [...expected, ...outputIds].sort());
});

test('missing, excluded and file-valued additional paths warn without failing healthy documents', async t => {
  const { root } = await createProject(t, {
    'docatlas.config.json': '{"version":1,"exclude":["filtered/**"]}',
    'docs/DESIGN.md': '# Design', 'filtered/notes.md': '# Filtered'
  });
  const snapshot = await collectProject(root, { docsDirs: ['future', 'filtered', 'docs/DESIGN.md'] });
  assert.deepEqual(ids(snapshot), ['docs/DESIGN.md']);
  assert.deepEqual(snapshot.warnings.map(warning => [warning.code, warning.path]), [
    ['DOCS_DIR_SKIPPED', 'docs/DESIGN.md'], ['DOCS_DIR_SKIPPED', 'filtered'], ['DOCS_DIR_SKIPPED', 'future']
  ]);
});

test('a root directory selection still excludes symbolic links and cannot read outside documents', async t => {
  const { root } = await createProject(t, { 'README.md': '# Root', 'docs/DESIGN.md': '# Design' });
  const outside = await createProject(t, { 'secret.md': '# Outside confidential text' });
  await fs.symlink(outside.root, path.join(root, 'linked'));
  await fs.symlink(path.join(outside.root, 'secret.md'), path.join(root, 'docs/linked.md'));
  const snapshot = await collectProject(root, { docsDirs: ['.', 'linked'], allMarkdown: true });
  assert.deepEqual(ids(snapshot), ['README.md', 'docs/DESIGN.md']);
  assert.ok(snapshot.warnings.some(warning => warning.code === 'DOCS_DIR_SKIPPED' && warning.path === 'linked'));
  assert.ok(!JSON.stringify(snapshot).includes('Outside confidential text'));
});

test('invalid collection options fail separately from JSON configuration and root errors', async t => {
  const { root } = await createProject(t);
  for (const options of [null, [], { unknown: true }, { docsDirs: 'notes' }, { allMarkdown: 'true' },
    ...[null, '', '   ', '../notes', 'folder/../notes', '/notes', 'C:notes', 'notes\\sub', 'bad\0path'].map(value => ({ docsDirs: [value] }))]) {
    await assert.rejects(collectProject(root, options), error => {
      assert.ok(error instanceof CollectionOptionsError);
      assert.equal(error.code, 'INVALID_COLLECTION_OPTIONS');
      return true;
    });
  }
});
